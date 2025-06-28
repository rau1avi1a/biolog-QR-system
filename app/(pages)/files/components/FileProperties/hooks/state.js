// app/files/components/FileProperties/hooks/state.js
'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * FileProperties State Hook
 * 
 * UI logic, event handlers, and conditional rendering logic:
 * - Dialog and drawer state management
 * - Form validation and error handling
 * - Component editing state
 * - Confirmation dialogs for destructive actions
 * - Search result formatting and display logic
 * - Mobile responsive behavior
 */
export function useComponentState(core, props) {
  const { open, onOpenChange } = props;

  // === UI-ONLY STATE ===
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [showComponentForm, setShowComponentForm] = useState(false);

  // === FORM VALIDATION STATE ===
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});

  // === VALIDATION LOGIC ===
  const getFieldError = useCallback((field, value) => {
    switch (field) {
      case 'fileName':
        if (!value || value.trim().length === 0) {
          return 'File name is required';
        }
        if (value.length > 255) {
          return 'File name must be less than 255 characters';
        }
        return null;
      
      case 'recipeQty':
        if (value && isNaN(parseFloat(value))) {
          return 'Recipe quantity must be a valid number';
        }
        if (value && parseFloat(value) < 0) {
          return 'Recipe quantity must be positive';
        }
        return null;
      
      case 'componentQty':
        if (!value || value.trim() === '') {
          return 'Quantity is required';
        }
        if (isNaN(parseFloat(value))) {
          return 'Quantity must be a valid number';
        }
        if (parseFloat(value) <= 0) {
          return 'Quantity must be greater than 0';
        }
        return null;
      
      default:
        return null;
    }
  }, []);

  const validateField = useCallback((field, value) => {
    const error = getFieldError(field, value);
    setFieldErrors(prev => ({
      ...prev,
      [field]: error
    }));
    return !error;
  }, [getFieldError]);

  const markFieldTouched = useCallback((field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  // === COMPUTED VALIDATION STATE ===
  const isFormValid = useMemo(() => {
    return core.isValid && Object.keys(fieldErrors).every(key => !fieldErrors[key]);
  }, [core.isValid, fieldErrors]);

  const getDisplayError = useCallback((field) => {
    return touched[field] ? fieldErrors[field] : null;
  }, [touched, fieldErrors]);

  // === TAB MANAGEMENT ===
  const tabs = useMemo(() => [
    { id: 'details', label: 'Details', icon: 'FileText' },
    { id: 'components', label: `Components (${core.totalComponents})`, icon: 'Beaker' },
    { id: 'solution', label: 'Solution', icon: 'FlaskRound' }
  ], [core.totalComponents]);

  const currentTab = useMemo(() => 
    tabs.find(tab => tab.id === activeTab) || tabs[0], 
    [tabs, activeTab]
  );

  // === EVENT HANDLERS ===
  const handleFieldChange = useCallback((field, value) => {
    core.handleFieldChange(field, value);
    markFieldTouched(field);
    validateField(field, value);
  }, [core.handleFieldChange, markFieldTouched, validateField]);

  const handleFieldBlur = useCallback((field, value) => {
    markFieldTouched(field);
    validateField(field, value);
  }, [markFieldTouched, validateField]);

  const handleSave = useCallback(async () => {
    // Validate all fields before saving
    const fields = ['fileName', 'recipeQty'];
    let hasErrors = false;

    fields.forEach(field => {
      const value = field === 'fileName' ? core.fileName : 
                   field === 'recipeQty' ? core.recipeQty : '';
      markFieldTouched(field);
      if (!validateField(field, value)) {
        hasErrors = true;
      }
    });

    if (hasErrors) {
      core.setError('Please fix the form errors before saving');
      return;
    }

    try {
      await core.save();
    } catch (error) {
      // Error is handled in core
    }
  }, [core, markFieldTouched, validateField]);

  const handleDelete = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    try {
      await core.deleteFile();
      setShowDeleteConfirm(false);
      onOpenChange?.(false);
    } catch (error) {
      // Error is handled in core
      setShowDeleteConfirm(false);
    }
  }, [core.deleteFile, onOpenChange]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  const handleClose = useCallback(() => {
    if (core.hasChanges) {
      const shouldClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close without saving?'
      );
      if (!shouldClose) return;
    }
    onOpenChange?.(false);
  }, [core.hasChanges, onOpenChange]);

  // === COMPONENT MANAGEMENT HANDLERS ===
  const handleAddComponent = useCallback((item) => {
    core.addComponent(item);
    setShowComponentForm(false);
  }, [core.addComponent]);

  const handleEditComponent = useCallback((component) => {
    core.startEditingComponent(component);
    setShowComponentForm(true);
  }, [core.startEditingComponent]);

  const handleUpdateComponent = useCallback((componentId, updates) => {
    // Validate component quantity
    if (updates.qty !== undefined) {
      markFieldTouched('componentQty');
      const isValid = validateField('componentQty', updates.qty);
      if (!isValid) return;
    }

    core.updateComponent(componentId, updates);
    core.stopEditingComponent();
    setShowComponentForm(false);
  }, [core, markFieldTouched, validateField]);

  const handleRemoveComponent = useCallback((componentId) => {
    const shouldRemove = window.confirm('Are you sure you want to remove this component?');
    if (shouldRemove) {
      core.removeComponent(componentId);
    }
  }, [core.removeComponent]);

  const handleCancelComponentEdit = useCallback(() => {
    core.stopEditingComponent();
    setShowComponentForm(false);
  }, [core.stopEditingComponent]);

  // === SEARCH RESULT HANDLERS ===
  const handleSelectSearchResult = useCallback((item) => {
    handleAddComponent(item);
    core.setSearchResults([]);
  }, [handleAddComponent, core.setSearchResults]);

  const handleSelectSolutionResult = useCallback((solution) => {
    core.selectSolution(solution);
    core.setSolutionResults([]);
  }, [core.selectSolution, core.setSolutionResults]);

  // === SEARCH RESULT FORMATTING ===
  const getFormattedSearchResults = useCallback(() => {
    return core.searchResults.map(item => ({
      ...item,
      displayText: `${item.displayName} (${item.sku})`,
      subtitle: `${item.itemCategory} • Stock: ${item.qtyOnHand || 0} ${item.uom || ''}`,
      isChemical: item.itemCategory === 'chemical',
      isSolution: item.itemCategory === 'solution'
    }));
  }, [core.searchResults]);

  const getFormattedSolutionResults = useCallback(() => {
    return core.solutionResults.map(solution => ({
      ...solution,
      displayText: `${solution.displayName} (${solution.sku})`,
      subtitle: solution.netsuiteInternalId ? 
        `NetSuite ID: ${solution.netsuiteInternalId}` : 
        'No NetSuite ID',
      hasNetSuiteId: !!solution.netsuiteInternalId
    }));
  }, [core.solutionResults]);

  // === COMPONENT DISPLAY LOGIC ===
  const getComponentDisplayData = useCallback(() => {
    return core.components.map(comp => {
      const item = comp.item || {};
      return {
        ...comp,
        displayName: item.displayName || 'Unknown Item',
        sku: item.sku || 'No SKU',
        category: item.itemCategory || 'unknown',
        currentStock: item.qtyOnHand || 0,
        stockUnit: item.uom || comp.unit || 'units',
        isValid: comp.qty && parseFloat(comp.qty) > 0,
        isMapped: !!item._id,
        isNetSuiteImported: !!comp.netsuiteData
      };
    });
  }, [core.components]);

  // === STATS AND SUMMARY ===
  const getStatsData = useCallback(() => {
    const components = getComponentDisplayData();
    return {
      totalComponents: components.length,
      mappedComponents: components.filter(c => c.isMapped).length,
      validComponents: components.filter(c => c.isValid).length,
      netsuiteComponents: components.filter(c => c.isNetSuiteImported).length,
      chemicals: components.filter(c => c.category === 'chemical').length,
      solutions: components.filter(c => c.category === 'solution').length,
      completionPercentage: components.length > 0 ? 
        Math.round((components.filter(c => c.isValid && c.isMapped).length / components.length) * 100) : 0
    };
  }, [getComponentDisplayData]);

  // === BUTTON CONFIGURATIONS ===
  const getSaveButtonConfig = useCallback(() => {
    return {
      disabled: !isFormValid || !core.hasChanges || core.isSaving || !core.canEdit,
      loading: core.isSaving,
      text: core.isSaving ? 'Saving...' : 'Save Changes',
      variant: core.hasChanges ? 'default' : 'outline'
    };
  }, [isFormValid, core.hasChanges, core.isSaving, core.canEdit]);

  const getDeleteButtonConfig = useCallback(() => {
    return {
      disabled: core.isDeleting || !core.canEdit,
      loading: core.isDeleting,
      text: core.isDeleting ? 'Deleting...' : 'Delete File',
      variant: 'destructive'
    };
  }, [core.isDeleting, core.canEdit]);

  const getBOMImportButtonConfig = useCallback(() => {
    return {
      disabled: !core.canImportBOM || core.isImportingBOM,
      loading: core.isImportingBOM,
      text: core.isImportingBOM ? 'Importing...' : 'Import from NetSuite',
      variant: 'outline'
    };
  }, [core.canImportBOM, core.isImportingBOM]);

  // === RETURN INTERFACE ===
  return {
    // === UI STATE ===
    showDeleteConfirm,
    activeTab,
    showComponentForm,
    fieldErrors,
    touched,

    // === TAB DATA ===
    tabs,
    currentTab,

    // === VALIDATION ===
    isFormValid,
    getDisplayError,

    // === EVENT HANDLERS ===
    handleFieldChange,
    handleFieldBlur,
    handleSave,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleClose,
    setActiveTab,

    // === COMPONENT HANDLERS ===
    handleAddComponent,
    handleEditComponent,
    handleUpdateComponent,
    handleRemoveComponent,
    handleCancelComponentEdit,
    setShowComponentForm,

    // === SEARCH HANDLERS ===
    handleSelectSearchResult,
    handleSelectSolutionResult,

    // === COMPUTED DATA ===
    formattedSearchResults: getFormattedSearchResults(),
    formattedSolutionResults: getFormattedSolutionResults(),
    componentDisplayData: getComponentDisplayData(),
    statsData: getStatsData(),

    // === BUTTON CONFIGS ===
    saveButtonConfig: getSaveButtonConfig(),
    deleteButtonConfig: getDeleteButtonConfig(),
    bomImportButtonConfig: getBOMImportButtonConfig()
  };
}