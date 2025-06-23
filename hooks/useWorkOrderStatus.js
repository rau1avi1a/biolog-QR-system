// hooks/useWorkOrderStatus.js - Enhanced polling hook for real-time updates
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for polling work order status with smart polling intervals
 * Automatically polls when work order is in 'creating' status
 */
export function useWorkOrderStatus(batchId, enabled = true) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const pollCountRef = useRef(0);

  // Check work order status
  const checkStatus = async () => {
    if (!batchId || !enabled) return;

    try {
      setLoading(true);
      // Add extra cache busting measures
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      console.log('Polling work order status for batch ID:', batchId, 'at', new Date().toISOString());
      
      const response = await fetch(`/api/batches/${batchId}/workorder-status?t=${timestamp}&r=${randomId}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'If-None-Match': '*',
          'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT'
        }
      });
      
      // Force response to be fresh
      const data = await response.json();

      // Add debug logging
      console.log('API Response from /workorder-status:', data);

      if (!mountedRef.current) return;

      if (data.success) {
        const newStatus = data.data;
        
        // Log what we received
        console.log('Work order status received:', {
          status: newStatus.status,
          workOrderNumber: newStatus.workOrderNumber,
          displayId: newStatus.displayId,
          created: newStatus.created,
          fullData: newStatus
        });
        
        setStatus(newStatus);
        setError(null);
        
        // Reset poll count when we get a successful response
        pollCountRef.current = 0;
        
        // Stop polling if:
        // 1. Status is explicitly 'created' or 'failed'
        // 2. We have a workOrderNumber (tranId like "WO12824")
        // 3. We have a displayId that looks like a work order number
        const hasWorkOrderNumber = newStatus.workOrderNumber && 
                                  !newStatus.workOrderNumber.startsWith('PENDING-') && 
                                  !newStatus.workOrderNumber.startsWith('LOCAL-');
        const hasDisplayId = newStatus.displayId && 
                           !newStatus.displayId.startsWith('PENDING-') && 
                           !newStatus.displayId.startsWith('LOCAL-');
        
        console.log('Polling decision factors:', {
          status: newStatus.status,
          hasWorkOrderNumber,
          hasDisplayId,
          workOrderNumber: newStatus.workOrderNumber,
          displayId: newStatus.displayId
        });
        
        if (newStatus.status === 'created' || 
            newStatus.status === 'failed' || 
            hasWorkOrderNumber || 
            hasDisplayId) {
          console.log('Work order status resolved, stopping polling:', {
            reason: newStatus.status === 'created' ? 'status=created' :
                   newStatus.status === 'failed' ? 'status=failed' :
                   hasWorkOrderNumber ? `workOrderNumber=${newStatus.workOrderNumber}` :
                   `displayId=${newStatus.displayId}`
          });
          stopPolling();
        }
      } else {
        console.log('API returned error:', data.error);
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      console.log('Fetch error:', err.message);
      if (mountedRef.current) {
        setError(err.message);
        pollCountRef.current++;
        
        // Stop polling after too many failures
        if (pollCountRef.current > 10) {
          console.log('Too many polling failures, stopping');
          stopPolling();
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // Smart polling with adaptive intervals
  const startPolling = () => {
    if (intervalRef.current) return; // Already polling

    console.log('Starting work order status polling...');
    
    // Start with shorter intervals, then increase
    let pollInterval = 3000; // Start with 3 seconds (slightly longer for DB updates)
    
    const poll = () => {
      checkStatus();
      
      // Gradually increase interval to reduce server load
      if (pollCountRef.current > 5) pollInterval = 6000;  // 6 seconds after 5 polls
      if (pollCountRef.current > 15) pollInterval = 12000; // 12 seconds after 15 polls
      
      intervalRef.current = setTimeout(poll, pollInterval);
    };
    
    // Start first poll after a small delay to let background job complete
    setTimeout(poll, 2000); // Wait 2 seconds before first poll
  };

  // Stop polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
      console.log('Work order polling stopped');
    }
  };

  // Initial check
  useEffect(() => {
    if (enabled && batchId) {
      checkStatus();
    }
  }, [batchId, enabled]);

  // Auto-start/stop polling based on status
  useEffect(() => {
    if (!status) return;

    // Start polling if work order is being created
    if (status.status === 'creating' && status.created) {
      console.log('Work order creating, starting polling...');
      startPolling();
    } 
    // Stop polling if work order is complete, failed, or has a tranId (NetSuite work order number)
    else if (status.status === 'created' || status.status === 'failed' || status.workOrderNumber) {
      console.log('Work order status final, stopping polling...', { 
        status: status.status, 
        workOrderNumber: status.workOrderNumber 
      });
      stopPolling();
    }

    return () => stopPolling();
  }, [status?.status, status?.created, status?.workOrderNumber]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, []);

  // Retry failed work order creation
  const retryCreation = async (quantity = 1000) => {
    if (!batchId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/batches/${batchId}/workorder-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });

      const data = await response.json();

      if (data.success) {
        // Restart polling
        pollCountRef.current = 0;
        startPolling();
        setError(null);
        return data.data;
      } else {
        setError(data.error || 'Failed to retry work order creation');
        return null;
      }
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    status,
    loading,
    error,
    isPolling: !!intervalRef.current,
    checkStatus: () => checkStatus(), // Expose manual check function
    retryCreation,
    // Helper properties for easy status checking
    isCreating: status?.status === 'creating',
    isCreated: status?.status === 'created',
    isFailed: status?.status === 'failed',
    workOrderNumber: status?.workOrderNumber || status?.displayId,
    displayId: status?.displayId,
    hasWorkOrder: status?.created
  };
}