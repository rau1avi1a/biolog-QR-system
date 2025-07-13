// app/(pages)/files/components/PDFEditor/hooks/state/permissions/permissions.state.js
'use client';

import { useCallback } from 'react';

/**
 * Permissions State Hook
 * Handles permission checks, status-based UI logic, and access control
 */
export function usePermissions(core, doc, mobileModeActive = false) {

  const isTabletOrMobile = mobileModeActive || (typeof window !== 'undefined' && window.innerWidth < 1024);
  const compact = isTabletOrMobile;

    console.log('🔍 Permissions Debug:', {
    mobileModeActive,
    windowWidth: typeof window !== 'undefined' ? window.innerWidth : 'undefined',
    isTabletOrMobile,
    compact,
    isInReview: core.isInReview
  });

  // === STATUS BADGE LOGIC ===
  const getStatusBadgeProps = useCallback(() => {
    const status = core.status;
    
    const getStatusColor = () => {
      switch (status) {
        case 'Draft': return 'bg-gray-100 text-gray-800';
        case 'In Progress': return 'bg-amber-100 text-amber-800';
        case 'Review': return 'bg-blue-100 text-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getDisplayText = () => {
      if (compact) {
        switch (status) {
          case 'In Progress': return 'In Progress';
          case 'Review': return 'Review';
          default: return status.slice(0, 8);
        }
      }
      return status;
    };

    return {
      className: `text-xs shrink-0 ${getStatusColor()}`,
      text: getDisplayText(),
      title: `Document Status: ${status}`
    };
  }, [core.status, compact]);

  // === COMPLETION INDICATORS ===
  const getCompletionIndicators = useCallback(() => {
    const indicators = [];

    // Completion indicator
    if (core.isCompleted || core.isArchived) {
      indicators.push({
        type: 'completed',
        className: 'text-green-600 flex items-center gap-1 text-xs',
        icon: 'CheckCircle',
        text: compact ? (core.isArchived ? 'Arc' : 'Done') : (core.isArchived ? 'Archived' : 'Completed'),
        title: core.isArchived ? 'This document is archived' : 'This document is completed'
      });
    }

    return indicators;
  }, [core.isCompleted, core.isArchived, compact]);

  // === BUTTON PERMISSIONS ===
  const getButtonConfig = useCallback(() => {
    if (core.isOriginal || core.isDraft) {
      return {
        action: 'create_work_order',
        text: compact ? 'Create WO' : 'Create Work Order',
        icon: 'Package',
        variant: 'default',
        disabled: core.isSaving || core.isCreatingWorkOrder,
        loading: core.isCreatingWorkOrder,
        title: 'Create work order and scale recipe'
      };
    }
    
    if (core.isInProgress) {
      return [
        {
          action: 'save',
          text: compact ? 'Save' : 'Save',
          icon: 'Save',
          variant: 'outline',
          disabled: core.isSaving,
          title: 'Save current progress'
        },
        {
          action: 'submit_review',
          text: compact ? 'Submit' : 'Submit for Review',
          icon: 'ArrowRightCircle',
          variant: 'outline',
          disabled: core.isSaving,
          title: 'Submit for review and create solution'
        }
      ];
    }
    
    if (core.isInReview) {
      return [
        {
          action: 'save',
          text: compact ? '' : 'Save', // ✅ FIX: Empty text in compact mode
          icon: 'Save',
          variant: 'outline',
          disabled: core.isSaving,
          title: 'Save current progress'
        },
        {
          action: 'reject',
          text: compact ? '' : 'Reject', // ✅ FIX: Empty text in compact mode
          icon: 'XCircle',
          variant: 'outline',
          disabled: core.isSaving,
          className: 'text-red-600 hover:text-red-700',
          title: 'Reject and return to In Progress'
        },
        {
          action: 'complete',
          text: compact ? '' : 'Complete', // ✅ FIX: Empty text in compact mode
          icon: 'CheckCircle',
          variant: 'outline',
          disabled: core.isSaving,
          className: 'text-green-600 hover:text-green-700',
          title: 'Complete work order and archive'
        }
      ];
    }
    
    return null;
  }, [core.isOriginal, core.isDraft, core.isInProgress, core.isInReview, core.isSaving, core.isCreatingWorkOrder, compact]);

  // === ACCESS CONTROL ===
  const getAccessControl = useCallback(() => {
    return {
      canEdit: !core.isCompleted && !core.isArchived,
      canDraw: core.canDraw(),
      canSave: !core.isCompleted && !core.isArchived,
      canCreateWorkOrder: core.isOriginal || core.isDraft,
      canSubmitReview: core.isInProgress,
      canReject: core.isInReview,
      canComplete: core.isInReview,
      isReadOnly: core.isOriginal || core.isCompleted || core.isArchived
    };
  }, [core.canDraw, core.isOriginal, core.isDraft, core.isInProgress, core.isInReview, core.isCompleted, core.isArchived]);

  // === WORKFLOW VALIDATION ===
  const getWorkflowValidation = useCallback(() => {
    const validation = {
      canProceed: true,
      blockers: [],
      warnings: []
    };

    // Check for setup requirements
    if ((core.isOriginal || core.isDraft) && (!doc?.snapshot?.components?.length && !doc?.components?.length)) {
      validation.canProceed = false;
      validation.blockers.push('Recipe components must be defined before creating a work order');
    }

    // Check for work order requirements
    if (core.isInProgress && !core.workOrderInfo) {
      validation.warnings.push('No work order found for this batch');
    }

    // Check for completion requirements
    if (core.isInReview && (!doc?.solutionCreated && !doc?.chemicalsTransacted)) {
      validation.warnings.push('Solution and chemicals should be processed before completion');
    }

    return validation;
  }, [core.isOriginal, core.isDraft, core.isInProgress, core.isInReview, core.workOrderInfo, doc?.snapshot?.components, doc?.components, doc?.solutionCreated, doc?.chemicalsTransacted]);

  // === PERMISSION MESSAGES ===
  const getPermissionMessages = useCallback(() => {
    const messages = [];

    if (core.isOriginal) {
      messages.push({
        type: 'info',
        message: 'This is an original file. Create a work order to enable editing and drawing.',
        icon: 'Info'
      });
    }

    if (core.isCompleted) {
      messages.push({
        type: 'success',
        message: 'This batch is completed and archived. No further changes are allowed.',
        icon: 'CheckCircle'
      });
    }

    if (core.isArchived) {
      messages.push({
        type: 'warning',
        message: 'This document is archived and cannot be modified.',
        icon: 'Archive'
      });
    }

    return messages;
  }, [core.isOriginal, core.isCompleted, core.isArchived]);

  return {
    // === UI CONFIGURATION ===
    statusBadgeProps: getStatusBadgeProps(),
    completionIndicators: getCompletionIndicators(),
    buttonConfig: getButtonConfig(),
    
    // === ACCESS CONTROL ===
    accessControl: getAccessControl(),
    workflowValidation: getWorkflowValidation(),
    permissionMessages: getPermissionMessages(),

    // === STATUS FLAGS ===
    isReadOnly: core.isOriginal || core.isCompleted || core.isArchived,
    canEdit: !core.isCompleted && !core.isArchived,
    showWorkflowButtons: !core.isCompleted && !core.isArchived
  };
}