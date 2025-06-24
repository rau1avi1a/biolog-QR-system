// hooks/useWorkOrderStatus.js - FIXED: Better polling and cache busting
import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook for polling work order status with smart polling intervals
 * FIXED: Better cache busting and polling logic
 */
export function useWorkOrderStatus(batchId, enabled = true) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const pollCountRef = useRef(0);
  const lastStatusRef = useRef(null); // Track last status to detect changes

  // Enhanced status checking with better cache busting
  const checkStatus = async (forceRefresh = false) => {
    if (!batchId || !enabled) return;

    try {
      setLoading(true);
      
      // ENHANCED: Aggressive cache busting for production
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const buildNumber = process.env.NEXT_PUBLIC_BUILD_NUMBER || Date.now();
      
      console.log('🔍 Polling work order status:', {
        batchId,
        timestamp: new Date().toISOString(),
        pollCount: pollCountRef.current,
        forceRefresh
      });
      
      const response = await fetch(`/api/batches/${batchId}/workorder-status?t=${timestamp}&r=${randomId}&b=${buildNumber}&force=${forceRefresh}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'If-None-Match': '*',
          'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
          // Add build number to headers for additional cache busting
          'X-Build-Number': buildNumber,
          'X-Request-Time': timestamp.toString()
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📡 API Response:', data);

      if (!mountedRef.current) return;

      if (data.success) {
        const newStatus = data.data;
        
        // ENHANCED: Detect actual status changes
        const statusChanged = !lastStatusRef.current || 
          lastStatusRef.current.status !== newStatus.status ||
          lastStatusRef.current.workOrderNumber !== newStatus.workOrderNumber ||
          lastStatusRef.current.workOrderId !== newStatus.workOrderId;

        if (statusChanged) {
          console.log('📈 Status changed detected:', {
            old: lastStatusRef.current,
            new: newStatus
          });
        }
        
        setStatus(newStatus);
        setError(null);
        lastStatusRef.current = newStatus;
        
        // Reset poll count when we get a successful response
        pollCountRef.current = 0;
        
        // ENHANCED: Better completion detection
        const isCompleted = (
          newStatus.status === 'created' || 
          newStatus.status === 'failed' ||
          (newStatus.workOrderNumber && 
           !newStatus.workOrderNumber.startsWith('PENDING-') && 
           !newStatus.workOrderNumber.startsWith('LOCAL-')) ||
          (newStatus.workOrderId && 
           !newStatus.workOrderId.startsWith('PENDING-') && 
           !newStatus.workOrderId.startsWith('LOCAL-'))
        );
        
        if (isCompleted) {
          console.log('✅ Work order completed, stopping polling:', {
            status: newStatus.status,
            workOrderNumber: newStatus.workOrderNumber,
            workOrderId: newStatus.workOrderId
          });
          stopPolling();
        }
        
      } else {
        console.log('❌ API returned error:', data.error);
        setError(data.error || 'Failed to fetch status');
      }
    } catch (err) {
      console.log('💥 Fetch error:', err.message);
      if (mountedRef.current) {
        setError(err.message);
        pollCountRef.current++;
        
        // Stop polling after too many failures
        if (pollCountRef.current > 10) {
          console.log('🛑 Too many polling failures, stopping');
          stopPolling();
        }
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  // ENHANCED: Smart polling with adaptive intervals and better timing
  const startPolling = () => {
    if (intervalRef.current) {
      console.log('⏸️ Polling already active, not starting new one');
      return;
    }

    console.log('▶️ Starting work order status polling...');
    pollCountRef.current = 0;
    
    const poll = () => {
      checkStatus();
      
      // Adaptive polling intervals
      let pollInterval = 2000; // Start with 2 seconds
      
      if (pollCountRef.current > 3) pollInterval = 4000;   // 4 seconds after 3 polls
      if (pollCountRef.current > 8) pollInterval = 6000;   // 6 seconds after 8 polls
      if (pollCountRef.current > 15) pollInterval = 10000; // 10 seconds after 15 polls
      
      console.log(`⏰ Next poll in ${pollInterval}ms (poll #${pollCountRef.current + 1})`);
      
      intervalRef.current = setTimeout(poll, pollInterval);
    };
    
    // Start first poll immediately, then use interval
    checkStatus(true); // Force refresh on first poll
    intervalRef.current = setTimeout(poll, 3000); // Wait 3 seconds before first interval poll
  };

  // Stop polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
      console.log('⏹️ Work order polling stopped');
    }
  };

  // Initial check when component mounts or batchId changes
  useEffect(() => {
    if (enabled && batchId) {
      console.log('🚀 Initial status check for batch:', batchId);
      checkStatus(true); // Force refresh on mount
    }
  }, [batchId, enabled]);

  // ENHANCED: Auto-start/stop polling based on status with better logic
  useEffect(() => {
    if (!status) return;

    console.log('🤔 Evaluating polling need for status:', status);

    // Start polling if work order is being created
    if (status.status === 'creating' && status.created && !intervalRef.current) {
      console.log('🔄 Work order creating, starting polling...');
      startPolling();
    } 
    // Stop polling if work order is complete or has a real work order number
    else if (
      status.status === 'created' || 
      status.status === 'failed' ||
      (status.workOrderNumber && 
       !status.workOrderNumber.startsWith('PENDING-') && 
       !status.workOrderNumber.startsWith('LOCAL-'))
    ) {
      console.log('✅ Work order final status reached, stopping polling:', {
        status: status.status,
        workOrderNumber: status.workOrderNumber
      });
      stopPolling();
    }

    return () => {
      // Don't automatically stop polling in cleanup unless component unmounting
    };
  }, [status?.status, status?.created, status?.workOrderNumber]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Component unmounting, cleaning up polling');
      mountedRef.current = false;
      stopPolling();
    };
  }, []);

  // Manual refresh function
  const refreshStatus = async () => {
    console.log('🔄 Manual status refresh requested');
    await checkStatus(true);
  };

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
        lastStatusRef.current = null;
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
    checkStatus: refreshStatus,
    retryCreation,
    // Helper properties for easy status checking
    isCreating: status?.status === 'creating',
    isCreated: status?.status === 'created',
    isFailed: status?.status === 'failed',
    workOrderNumber: status?.workOrderNumber || status?.displayId,
    displayId: status?.displayId,
    hasWorkOrder: status?.created,
    // Debug info
    pollCount: pollCountRef.current,
    lastPolled: lastStatusRef.current
  };
}