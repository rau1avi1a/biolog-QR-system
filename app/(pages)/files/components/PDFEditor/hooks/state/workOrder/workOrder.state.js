// app/(pages)/files/components/PDFEditor/hooks/state/workOrder/workOrder.state.js - Enhanced with Assembly Build support
'use client';

import { useCallback } from 'react';

/**
 * Work Order State Hook - Enhanced with Assembly Build support
 * Handles work order AND assembly build UI state, badge logic, and conditional rendering
 */
export function useWorkOrder(core, doc, mobileModeActive = false) {
  const compact = mobileModeActive;

  // ENHANCED: getWorkOrderBadgeProps with Assembly Build priority
  const getWorkOrderBadgeProps = useCallback(() => {
    const workOrderInfo = core.workOrderInfo;
    
    if (!workOrderInfo && !core.isCreatingWorkOrder && !core.userInitiatedCreation) {
      return null;
    }

    // 🆕 NEW: Check for assembly build status first (higher priority)
    const getBadgeColor = () => {
      // PRIORITY 1: Assembly Build status
      if (doc?.assemblyBuildStatus === 'failed') {
        return 'bg-red-50 text-red-700 border-red-200';
      }
      
      if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
        return 'bg-green-50 text-green-700 border-green-200';
      }
      
      if (doc?.assemblyBuildStatus === 'creating') {
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      }
      
      // PRIORITY 2: Work Order status (fallback)
      if (workOrderInfo?.isFailed) {
        return 'bg-red-50 text-red-700 border-red-200';
      }
      
      // Green for completed work orders (but not assembly builds)
      if (doc?.workOrderCompleted && !doc?.assemblyBuildCreated) {
        return 'bg-green-50 text-green-700 border-green-200';
      }
      
      if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation) {
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      }
      
      if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber) {
        return workOrderInfo.isNetSuite ? 
          'bg-blue-50 text-blue-700 border-blue-200' : 
          'bg-green-50 text-green-700 border-green-200';
      }
      
      return 'bg-gray-50 text-gray-700 border-gray-200';
    };

    const getDisplayText = () => {
      // 🆕 PRIORITY 1: Show Assembly Build number/status if relevant
      if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
        const assemblyBuildNumber = doc.assemblyBuildTranId;
        return compact ? assemblyBuildNumber : `${assemblyBuildNumber}`;
      }
      
      if (doc?.assemblyBuildStatus === 'creating') {
        return compact ? 'Creating AB...' : 'Creating Assembly Build';
      }
      
      if (doc?.assemblyBuildStatus === 'failed') {
        return compact ? 'AB Failed' : 'Assembly Build Failed';
      }
      
      // PRIORITY 2: Show Work Order number/status (fallback)
      if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber && !workOrderInfo?.isPending) {
        const number = workOrderInfo.workOrderNumber;
        return compact ? number : `${number}`;
      }
      
      // PRIORITY 3: Show creating status
      if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation || core.workOrderLoading) {
        return compact ? 'Creating...' : 'Creating Work Order';
      }
      
      // PRIORITY 4: Show failed status
      if (workOrderInfo?.isFailed) {
        return compact ? 'WO Failed' : 'Work Order Failed';
      }
      
      // Fallback
      return compact ? 'WO' : 'Work Order';
    };

    const getIcon = () => {
      // 🆕 Assembly Build icons
      if (doc?.assemblyBuildStatus === 'failed') return '❌';
      
      if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
        return '🏗️'; // Different icon for assembly builds
      }
      
      if (doc?.assemblyBuildStatus === 'creating') {
        return '⏳';
      }
      
      // Work Order icons (fallback)
      if (workOrderInfo?.isFailed) return '❌';
      
      if (doc?.workOrderCompleted && !doc?.assemblyBuildCreated) {
        return '✅';
      }
      
      if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation || core.workOrderLoading) {
        return '⏳';
      }
      
      if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber) {
        return workOrderInfo.isNetSuite ? '🔗' : '📝';
      }
      
      return '📋';
    };

    const getTitle = () => {
      // 🆕 Assembly Build titles
      if (doc?.assemblyBuildStatus === 'failed') {
        return `Assembly build creation failed: ${doc?.assemblyBuildError || 'Unknown error'}`;
      }
      
      if (doc?.assemblyBuildCreated && doc?.assemblyBuildTranId) {
        return `Assembly Build Completed: ${doc.assemblyBuildTranId} (from Work Order: ${workOrderInfo?.workOrderNumber || 'Unknown'})`;
      }
      
      if (doc?.assemblyBuildStatus === 'creating') {
        return 'Assembly build is being created in NetSuite...';
      }
      
      // Work Order titles (fallback)
      if (workOrderInfo?.isFailed) {
        return `Work order creation failed: ${workOrderInfo.error || 'Unknown error'}`;
      }
      
      if (doc?.workOrderCompleted && !doc?.assemblyBuildCreated) {
        return `Work Order Completed: ${workOrderInfo?.workOrderNumber || 'Unknown'}`;
      }
      
      if (workOrderInfo?.isPending || core.isCreatingWorkOrder || core.userInitiatedCreation) {
        return 'Work order is being created in NetSuite...';
      }
      
      if (workOrderInfo?.isCreated && workOrderInfo?.workOrderNumber) {
        return workOrderInfo.isNetSuite ? 
          `NetSuite Work Order: ${workOrderInfo.workOrderNumber}` : 
          `Local Work Order: ${workOrderInfo.workOrderNumber}`;
      }
      
      return 'Work Order';
    };

    const isAnimating = workOrderInfo?.isPending || 
                       core.isCreatingWorkOrder || 
                       core.userInitiatedCreation || 
                       core.workOrderLoading ||
                       doc?.assemblyBuildStatus === 'creating'; // 🆕 Add assembly build animation

    return {
      className: `text-xs flex items-center gap-1 shrink-0 ${getBadgeColor()} transition-colors duration-200`,
      title: getTitle(),
      isAnimating: isAnimating,
      icon: getIcon(),
      text: getDisplayText()
    };
  }, [
    core.workOrderInfo, 
    core.isCreatingWorkOrder, 
    core.userInitiatedCreation,
    core.workOrderStatus, 
    core.workOrderLoading,
    doc?.assemblyBuildCreated,        // 🆕 NEW
    doc?.assemblyBuildTranId,         // 🆕 NEW
    doc?.assemblyBuildStatus,         // 🆕 NEW
    doc?.assemblyBuildError,          // 🆕 NEW
    doc?.workOrderCompleted,
    compact
  ]);

  // === WORK ORDER STATUS INDICATORS ===
  const getWorkOrderStatusIndicators = useCallback(() => {
    const indicators = [];

    // Work order badge - always show if there's work order info or creation in progress
    const workOrderBadge = getWorkOrderBadgeProps();
    if (workOrderBadge) {
      indicators.push({
        type: 'work_order',
        ...workOrderBadge
      });
    }

    // Rejection indicator
    if (doc?.wasRejected && !compact) {
      indicators.push({
        type: 'rejected',
        className: 'text-xs bg-red-50 text-red-700',
        icon: 'AlertTriangle',
        text: 'Rejected',
        title: 'This batch was rejected and returned to In Progress'
      });
    }

    return indicators;
  }, [getWorkOrderBadgeProps, doc?.wasRejected, compact]);

  // === WORK ORDER BUTTON CONFIGURATION ===
  const getWorkOrderButtonConfig = useCallback(() => {
    if (core.isOriginal || core.isDraft) {
      return {
        action: 'create_work_order',
        text: compact ? 'Create WO' : 'Create Work Order',
        icon: 'Package',
        variant: 'default',
        disabled: core.isSaving || core.isCreatingWorkOrder,
        loading: core.isCreatingWorkOrder,
        title: 'Create a work order and scale the recipe'
      };
    }

    return null;
  }, [core.isOriginal, core.isDraft, core.isSaving, core.isCreatingWorkOrder, compact]);

  return {
    // === UI CONFIGURATION ===
    workOrderBadgeProps: getWorkOrderBadgeProps(),
    workOrderStatusIndicators: getWorkOrderStatusIndicators(),
    workOrderButtonConfig: getWorkOrderButtonConfig(),

    // === STATUS ===
    isCreatingWorkOrder: core.isCreatingWorkOrder,
    workOrderLoading: core.workOrderLoading,
    hasWorkOrder: !!core.workOrderInfo,
    workOrderFailed: core.workOrderInfo?.isFailed || false,
    
    // 🆕 NEW: Assembly Build status
    isCreatingAssemblyBuild: doc?.assemblyBuildStatus === 'creating',
    assemblyBuildLoading: doc?.assemblyBuildStatus === 'creating',
    hasAssemblyBuild: !!doc?.assemblyBuildCreated,
    assemblyBuildFailed: doc?.assemblyBuildStatus === 'failed',
    assemblyBuildCompleted: doc?.assemblyBuildCreated && doc?.assemblyBuildTranId
  };
}