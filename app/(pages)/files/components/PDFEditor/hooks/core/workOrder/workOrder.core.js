// app/(pages)/files/components/PDFEditor/hooks/core/workOrder/workOrder.core.js - Enhanced with Assembly Build polling
'use client';

import { useState, useRef, useCallback, useMemo } from 'react';

export function useWorkOrder(doc, refreshFiles, setCurrentDoc) {
  // === WORK ORDER STATE (from your working original) ===
  const [workOrderStatus, setWorkOrderStatus] = useState(null);
  const [workOrderLoading, setWorkOrderLoading] = useState(false);
  const [workOrderError, setWorkOrderError] = useState(null);
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [lastWorkOrderNumber, setLastWorkOrderNumber] = useState(null);
  const [userInitiatedCreation, setUserInitiatedCreation] = useState(false);

  // === 🆕 ASSEMBLY BUILD STATE ===
  const [assemblyBuildStatus, setAssemblyBuildStatus] = useState(null);
  const [assemblyBuildLoading, setAssemblyBuildLoading] = useState(false);
  const [assemblyBuildError, setAssemblyBuildError] = useState(null);
  const [isCreatingAssemblyBuild, setIsCreatingAssemblyBuild] = useState(false);
  const [lastAssemblyBuildNumber, setLastAssemblyBuildNumber] = useState(null);

  // === POLLING REFS ===
  const intervalRef = useRef(null);
  const pollCountRef = useRef(0);
  const pollingActiveRef = useRef(false);
  const assemblyBuildPollCountRef = useRef(0);
  const assemblyBuildPollingActiveRef = useRef(false);

  // === WORK ORDER METHODS (exact copy from your working original) ===
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
        
        if (shouldContinue && pollingActiveRef.current && pollCountRef.current < 50) {
          let delay = 2000;
          if (pollCountRef.current > 5) delay = 3000;
          if (pollCountRef.current > 15) delay = 5000;
          if (pollCountRef.current > 30) delay = 8000;
          
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
  
  const stopWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      pollingActiveRef.current = false;
    }
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // === 🆕 ASSEMBLY BUILD METHODS (same pattern as work order) ===
  const checkAssemblyBuildStatus = useCallback(async () => {
    if (!doc?._id || !doc?.isBatch) {
      console.log('❌ Skipping assembly build check: not a batch or missing ID');
      return false;
    }

    try {
      console.log('🔍 Checking assembly build status for batch:', doc._id);
      setAssemblyBuildLoading(true);
      
      const timestamp = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`/api/batches?id=${doc._id}&action=assemblybuild-status&t=${timestamp}`, {
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
      console.log('📊 Assembly build status API response:', result);

      if (result.success && result.data) {
        const statusData = result.data;
        
        // Update the assembly build status state
        setAssemblyBuildStatus(statusData);
        setAssemblyBuildError(null);
        
        // Better completion detection
        const isComplete = statusData.created === true && 
                          statusData.assemblyBuildTranId &&
                          !statusData.assemblyBuildTranId.startsWith('PENDING-');
        
        const isFailed = statusData.status === 'failed';
        const isStillCreating = statusData.status === 'creating' ||
                               statusData.created === false ||
                               (statusData.assemblyBuildId && statusData.assemblyBuildId.startsWith('PENDING-AB-'));
        
        console.log('🔍 Assembly build status analysis:', { 
          isComplete, 
          isFailed, 
          isStillCreating,
          created: statusData.created,
          assemblyBuildTranId: statusData.assemblyBuildTranId,
          assemblyBuildId: statusData.assemblyBuildId,
          status: statusData.status
        });
        
        if (isComplete) {
          console.log('🎉 Assembly build completed successfully:', statusData.assemblyBuildTranId);
          setLastAssemblyBuildNumber(statusData.assemblyBuildTranId);
          setIsCreatingAssemblyBuild(false);
          
          // 🔥 CRITICAL FIX: Update the document state directly
          if (setCurrentDoc && doc) {
            console.log('🔄 Updating document state with assembly build completion...');
            const updatedDoc = {
              ...doc,
              status: 'Review',
              assemblyBuildCreated: true,
              assemblyBuildTranId: statusData.assemblyBuildTranId,
              assemblyBuildId: statusData.assemblyBuildId,
              assemblyBuildStatus: 'created',
              workOrderCompleted: statusData.workOrderCompleted || doc.workOrderCompleted,
              // Add a flag to prevent document reset
              _skipDocumentReset: true,
              _assemblyBuildJustCompleted: true,
              _preserveStatus: true
            };
            
            setCurrentDoc(updatedDoc);
            
            // Also try refreshFiles as backup
            if (refreshFiles) {
              setTimeout(() => {
                console.log('🔄 Also calling refreshFiles as backup...');
                refreshFiles();
              }, 1000);
            }
          }
          
          return false; // Stop polling
        } else if (isFailed) {
          console.log('❌ Assembly build creation failed:', statusData.error);
          setAssemblyBuildError(statusData.error || 'Assembly build creation failed');
          setIsCreatingAssemblyBuild(false);
          return false; // Stop polling
        } else if (isStillCreating) {
          console.log('⏳ Assembly build still being created...');
          assemblyBuildPollCountRef.current++;
          return assemblyBuildPollCountRef.current < 30; // Continue polling
        } else {
          console.log('🛑 Unknown assembly build status:', statusData.status);
          return assemblyBuildPollCountRef.current < 20;
        }
      } else {
        console.error('❌ Assembly build status API error:', result.error);
        setAssemblyBuildError(result.error || 'Failed to get assembly build status');
        assemblyBuildPollCountRef.current++;
        return assemblyBuildPollCountRef.current < 10;
      }
    } catch (err) {
      console.error('❌ Assembly build status check error:', err);
      setAssemblyBuildError(err.message);
      assemblyBuildPollCountRef.current++;
      return assemblyBuildPollCountRef.current < 10;
    } finally {
      setAssemblyBuildLoading(false);
    }
  }, [doc?._id, doc?.isBatch, doc, setCurrentDoc, refreshFiles]); 


  const startAssemblyBuildPolling = useCallback(() => {
    if (assemblyBuildPollingActiveRef.current) {
      return;
    }
  
    assemblyBuildPollingActiveRef.current = true;
    assemblyBuildPollCountRef.current = 0;
    
    const poll = async () => {
      if (!assemblyBuildPollingActiveRef.current) {
        return;
      }
      
      try {
        const shouldContinue = await checkAssemblyBuildStatus();
        
        if (shouldContinue && assemblyBuildPollingActiveRef.current && assemblyBuildPollCountRef.current < 30) {
          let delay = 2000;
          if (assemblyBuildPollCountRef.current > 5) delay = 3000;
          if (assemblyBuildPollCountRef.current > 15) delay = 5000;
          
          console.log(`🔄 Scheduling next assembly build poll in ${delay}ms (attempt ${assemblyBuildPollCountRef.current + 1}/30)`);
          setTimeout(poll, delay);
        } else {
          console.log('🛑 Assembly build polling stopped');
          assemblyBuildPollingActiveRef.current = false;
          
          if (assemblyBuildPollCountRef.current >= 30) {
            setIsCreatingAssemblyBuild(false);
            setAssemblyBuildError('Assembly build creation timed out after 5+ minutes');
          }
        }
      } catch (error) {
        console.error('❌ Assembly build poll iteration failed:', error);
        assemblyBuildPollingActiveRef.current = false;
      }
    };
    
    poll();
  }, [checkAssemblyBuildStatus]);


  const stopAssemblyBuildPolling = useCallback(() => {
    if (assemblyBuildPollingActiveRef.current) {
      assemblyBuildPollingActiveRef.current = false;
    }
  }, []);

  // === FIXED: shouldPoll - Back to working original pattern ===
const shouldPoll = useCallback(() => {
  const shouldPollWorkOrder = doc?._id && 
         doc?.isBatch && 
         (isCreatingWorkOrder || 
          userInitiatedCreation || 
          (doc?.workOrderCreated && doc?.workOrderStatus === 'creating'));

  // FIXED: Better assembly build polling detection
  const shouldPollAssemblyBuild = doc?._id && 
         doc?.isBatch && 
         (isCreatingAssemblyBuild || 
          doc?.assemblyBuildStatus === 'creating' ||
          // FIXED: Also poll if status just changed to Review and assembly build is pending
          (doc?.status === 'Review' && doc?.assemblyBuildId && 
           doc?.assemblyBuildId.startsWith('PENDING-AB-') && 
           !doc?.assemblyBuildCreated));

  console.log('🔍 shouldPoll analysis:', {
    docId: doc?._id,
    isBatch: doc?.isBatch,
    workOrder: {
      isCreatingWorkOrder,
      userInitiatedCreation,
      workOrderCreated: doc?.workOrderCreated,
      workOrderStatus: doc?.workOrderStatus,
      shouldPoll: shouldPollWorkOrder
    },
    assemblyBuild: {
      isCreatingAssemblyBuild,
      assemblyBuildStatus: doc?.assemblyBuildStatus,
      assemblyBuildId: doc?.assemblyBuildId,
      assemblyBuildCreated: doc?.assemblyBuildCreated,
      statusIsReview: doc?.status === 'Review',
      hasPendingId: doc?.assemblyBuildId?.startsWith('PENDING-AB-'),
      shouldPoll: shouldPollAssemblyBuild
    }
  });

  return { shouldPollWorkOrder, shouldPollAssemblyBuild };
}, [
  doc?._id, 
  doc?.isBatch, 
  doc?.workOrderCreated, 
  doc?.workOrderStatus, 
  doc?.assemblyBuildStatus,
  doc?.assemblyBuildId,        // FIXED: Added this
  doc?.assemblyBuildCreated,   // FIXED: Added this
  doc?.status,                 // FIXED: Added this
  isCreatingWorkOrder, 
  userInitiatedCreation,
  isCreatingAssemblyBuild
]);


  // === WORK ORDER INFO (enhanced with assembly build) ===
  const workOrderInfo = useMemo(() => {
    if (!doc?.isBatch) return null;
    
    // Priority: Assembly Build > Work Order
    if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
      return {
        id: doc.assemblyBuildTranId,
        workOrderNumber: doc.assemblyBuildTranId,
        assemblyBuildNumber: doc.assemblyBuildTranId,
        internalId: doc.assemblyBuildId,
        status: 'assembly_build_created',
        isNetSuite: true,
        isLocal: false,
        isPending: false,
        isFailed: false,
        isCreated: true,
        isAssemblyBuild: true,
        isUpdating: assemblyBuildLoading || assemblyBuildPollingActiveRef.current,
        error: assemblyBuildError
      };
    }

    if (isCreatingAssemblyBuild || doc?.assemblyBuildStatus === 'creating') {
      return {
        id: 'pending-assembly-build',
        workOrderNumber: null,
        assemblyBuildNumber: null,
        internalId: null,
        status: 'creating_assembly_build',
        isNetSuite: false,
        isLocal: false,
        isPending: true,
        isFailed: false,
        isCreated: false,
        isAssemblyBuild: true,
        isUpdating: assemblyBuildLoading || assemblyBuildPollingActiveRef.current,
        error: assemblyBuildError
      };
    }

    if (doc?.assemblyBuildStatus === 'failed') {
      return {
        id: 'failed-assembly-build',
        workOrderNumber: null,
        assemblyBuildNumber: null,
        internalId: null,
        status: 'assembly_build_failed',
        isNetSuite: false,
        isLocal: false,
        isPending: false,
        isFailed: true,
        isCreated: false,
        isAssemblyBuild: true,
        isUpdating: false,
        error: doc?.assemblyBuildError || assemblyBuildError
      };
    }

    // Fall back to work order (original working logic)
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
        isAssemblyBuild: false,
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
        isAssemblyBuild: false,
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
    workOrderError,
    isCreatingAssemblyBuild,
    lastAssemblyBuildNumber,
    assemblyBuildLoading,
    assemblyBuildError
  ]);

return {
  // === WORK ORDER STATE ===
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

    // === ASSEMBLY BUILD STATE ===
    assemblyBuildStatus,
    setAssemblyBuildStatus,
    assemblyBuildLoading,
    setAssemblyBuildLoading,
    assemblyBuildError,
    setAssemblyBuildError,
    isCreatingAssemblyBuild,
    setIsCreatingAssemblyBuild,
    lastAssemblyBuildNumber,
    setLastAssemblyBuildNumber,
    checkAssemblyBuildStatus,
    startAssemblyBuildPolling,

    // === REFS ===
    intervalRef,
    pollCountRef,
    pollingActiveRef,
    assemblyBuildPollCountRef,
    assemblyBuildPollingActiveRef,

    // === COMPUTED ===
    workOrderInfo,

    // === FUNCTIONS ===
    checkWorkOrderStatus,
    startWorkOrderPolling,
    stopWorkOrderPolling,
    checkAssemblyBuildStatus,
    startAssemblyBuildPolling,
    stopAssemblyBuildPolling,
    shouldPoll,
    resetWorkOrderCreation: useCallback(() => {
      setIsCreatingWorkOrder(false);
      setUserInitiatedCreation(false);
      setWorkOrderError(null);
    }, []),
    initializeWorkOrderCreation: useCallback(() => {
      setIsCreatingWorkOrder(true);
      setUserInitiatedCreation(true);
      setWorkOrderError(null);
    }, []),
    resetAssemblyBuildCreation: useCallback(() => {
      setIsCreatingAssemblyBuild(false);
      setAssemblyBuildError(null);
    }, []),
    initializeAssemblyBuildCreation: useCallback(() => {
      setIsCreatingAssemblyBuild(true);
      setAssemblyBuildError(null);
    }, [])
  };
}