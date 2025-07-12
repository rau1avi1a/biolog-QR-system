// app/files/components/PDFEditor/hooks/core/workOrder/workOrder.core.js
'use client';

import { useState, useRef, useCallback, useMemo } from 'react';

/**
 * Work Order Core Hook
 * Handles all work order functionality:
 * - Work order status checking and polling
 * - NetSuite integration and async lookup handling
 * - Polling management with adaptive intervals
 * - Work order creation state management
 * - Work order info computation and status analysis
 */
export function useWorkOrder(doc) {
  // === WORK ORDER STATE ===
  const [workOrderStatus, setWorkOrderStatus] = useState(null);
  const [workOrderLoading, setWorkOrderLoading] = useState(false);
  const [workOrderError, setWorkOrderError] = useState(null);
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [lastWorkOrderNumber, setLastWorkOrderNumber] = useState(null);
  const [userInitiatedCreation, setUserInitiatedCreation] = useState(false);

  // === POLLING REFS ===
  const intervalRef = useRef(null);
  const pollCountRef = useRef(0);
  const pollingActiveRef = useRef(false);

  // EXTRACTED: checkWorkOrderStatus function from your core.js
  const checkWorkOrderStatus = useCallback(async () => {
    if (!doc?._id || !doc?.isBatch) {
      console.log('❌ Skipping work order check: not a batch or missing ID');
      return false;
    }
  
    try {
      console.log('🔍 Checking work order status for batch:', doc._id);
      setWorkOrderLoading(true);
      
      const timestamp = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`/api/batches?id=${doc._id}&action=workorder-status&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📊 Work order status API response:', result);
  
      if (result.success && result.data) {
        const statusData = result.data;
        
        setWorkOrderStatus(statusData);
        setWorkOrderError(null);
        pollCountRef.current = 0;
        
        // FIXED: Account for the async NetSuite lookup
        // The status might be 'created' but workOrderNumber might still be pending lookup
        const isComplete = statusData.status === 'created' && statusData.workOrderNumber && !statusData.workOrderNumber.startsWith('PENDING-');
        const isFailed = statusData.status === 'failed';
        const shouldContinue = statusData.status === 'creating' || 
                              statusData.status === 'pending' ||
                              (statusData.status === 'created' && (!statusData.workOrderNumber || statusData.workOrderNumber.startsWith('PENDING-')));
        
        console.log('🔍 Status analysis (with async NetSuite lookup):', { 
          isComplete, 
          isFailed, 
          shouldContinue,
          workOrderNumber: statusData.workOrderNumber,
          isPendingLookup: statusData.workOrderNumber?.startsWith('PENDING-')
        });
        
        if (isComplete) {
          console.log('🎉 Work order created and NetSuite lookup complete:', statusData.workOrderNumber);
          setLastWorkOrderNumber(statusData.workOrderNumber);
          setIsCreatingWorkOrder(false);
          setUserInitiatedCreation(false);
          return false;
        } else if (isFailed) {
          console.log('❌ Work order creation failed:', statusData.error);
          setIsCreatingWorkOrder(false);
          setUserInitiatedCreation(false);
          return false;
        } else if (shouldContinue) {
          console.log('⏳ Work order still being created or NetSuite lookup in progress...');
          return true;
        } else {
          console.log('🛑 Unknown status, stopping polling:', statusData.status);
          return false;
        }
      } else {
        setWorkOrderError(result.error || 'Failed to get work order status');
        pollCountRef.current++;
        return pollCountRef.current < 10;
      }
    } catch (err) {
      setWorkOrderError(err.message);
      pollCountRef.current++;
      return pollCountRef.current < 10;
    } finally {
      setWorkOrderLoading(false);
    }
  }, [doc?._id, doc?.isBatch]);

  // EXTRACTED: startWorkOrderPolling function from your core.js
  const startWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      return;
    }
  
    pollingActiveRef.current = true;
    pollCountRef.current = 0;
    
    const poll = async () => {
      if (!pollingActiveRef.current) {
        return;
      }
      
      try {
        const shouldContinue = await checkWorkOrderStatus();
        
        if (shouldContinue && pollingActiveRef.current && pollCountRef.current < 50) { // Increased from 30 to 50 for NetSuite lookup
          // FIXED: Adaptive polling with longer intervals for NetSuite lookup
          let delay = 2000;
          if (pollCountRef.current > 5) delay = 3000;
          if (pollCountRef.current > 15) delay = 5000;
          if (pollCountRef.current > 30) delay = 8000; // Longer delay for NetSuite lookup phase
          
          console.log(`🔄 Scheduling next poll in ${delay}ms (attempt ${pollCountRef.current + 1}/50)`);
          pollCountRef.current++;
          setTimeout(poll, delay);
        } else {
          console.log('🛑 Polling stopped - shouldContinue:', shouldContinue, 'active:', pollingActiveRef.current, 'count:', pollCountRef.current);
          pollingActiveRef.current = false;
          
          if (pollCountRef.current >= 50) {
            setIsCreatingWorkOrder(false);
            setUserInitiatedCreation(false);
            setWorkOrderError('Work order creation timed out after 8+ minutes (including NetSuite lookup)');
          }
        }
      } catch (error) {
        console.error('❌ Poll iteration failed:', error);
        pollingActiveRef.current = false;
      }
    };
    
    poll();
  }, [checkWorkOrderStatus]);
  
  // EXTRACTED: stopWorkOrderPolling function from your core.js
  const stopWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      pollingActiveRef.current = false;
    }
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // EXTRACTED: workOrderInfo computation from your core.js
  const workOrderInfo = useMemo(() => {
    if (!doc?.isBatch) return null;
    
    if ((isCreatingWorkOrder || userInitiatedCreation) && !workOrderStatus?.workOrderNumber) {
      return {
        id: 'pending',
        workOrderNumber: null,
        internalId: null,
        status: 'creating',
        isNetSuite: false,
        isLocal: false,
        isPending: true,
        isFailed: false,
        isCreated: false,
        isUpdating: workOrderLoading || pollingActiveRef.current,
        error: workOrderError
      };
    }
    
    const currentStatus = workOrderStatus || {
      created: doc.workOrderCreated,
      status: doc.workOrderStatus,
      workOrderId: doc.workOrderId,
      workOrderNumber: doc.netsuiteWorkOrderData?.tranId || lastWorkOrderNumber
    };
    
    if (currentStatus.created || currentStatus.workOrderNumber || currentStatus.workOrderId) {
      const workOrderNumber = currentStatus.workOrderNumber || currentStatus.workOrderId || lastWorkOrderNumber;
      const isNetSuite = !!(workOrderNumber && !workOrderNumber.startsWith('LOCAL-') && !workOrderNumber.startsWith('PENDING-'));
      const isPending = currentStatus.status === 'creating' || 
                       currentStatus.status === 'pending' ||
                       workOrderNumber?.startsWith('PENDING-');
      const isLocal = workOrderNumber?.startsWith('LOCAL-WO-');
      const isFailed = currentStatus.status === 'failed';
      const isCreated = currentStatus.status === 'created' || (workOrderNumber && !isPending && !isFailed);
      
      return {
        id: workOrderNumber || 'Unknown',
        workOrderNumber: currentStatus.workOrderNumber || lastWorkOrderNumber,
        internalId: currentStatus.internalId,
        status: currentStatus.status || 'created',
        isNetSuite,
        isLocal,
        isPending,
        isFailed,
        isCreated,
        isUpdating: workOrderLoading || pollingActiveRef.current,
        error: currentStatus.error || workOrderError
      };
    }
    
    return null;
  }, [
    doc, 
    workOrderStatus, 
    lastWorkOrderNumber, 
    isCreatingWorkOrder, 
    userInitiatedCreation,
    workOrderLoading, 
    workOrderError
  ]);

  // Helper function to determine if polling should be active
  const shouldPoll = useCallback(() => {
    return doc?._id && 
           doc?.isBatch && 
           (isCreatingWorkOrder || 
            userInitiatedCreation || 
            (doc?.workOrderCreated && doc?.workOrderStatus === 'creating'));
  }, [doc?._id, doc?.isBatch, doc?.workOrderCreated, doc?.workOrderStatus, isCreatingWorkOrder, userInitiatedCreation]);

  // Reset work order creation state
  const resetWorkOrderCreation = useCallback(() => {
    setIsCreatingWorkOrder(false);
    setUserInitiatedCreation(false);
    setWorkOrderError(null);
  }, []);

  // Initialize work order creation
  const initializeWorkOrderCreation = useCallback(() => {
    setIsCreatingWorkOrder(true);
    setUserInitiatedCreation(true);
    setWorkOrderError(null);
  }, []);

  return {
    // === STATE ===
    workOrderStatus,
    setWorkOrderStatus,
    workOrderLoading,
    setWorkOrderLoading,
    workOrderError,
    setWorkOrderError,
    isCreatingWorkOrder,
    setIsCreatingWorkOrder,
    lastWorkOrderNumber,
    setLastWorkOrderNumber,
    userInitiatedCreation,
    setUserInitiatedCreation,

    // === REFS ===
    intervalRef,
    pollCountRef,
    pollingActiveRef,

    // === COMPUTED ===
    workOrderInfo,

    // === FUNCTIONS ===
    checkWorkOrderStatus,
    startWorkOrderPolling,
    stopWorkOrderPolling,
    shouldPoll,
    resetWorkOrderCreation,
    initializeWorkOrderCreation
  };
}