// app/(pages)/files/components/FileProperties/hooks/core.js - FIXED: API integration
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { filesApi, hasApiError, extractApiData, handleApiError } from '../../../lib/api';

/**
 * FileProperties Core Hook - FIXED
 * 
 * Fixed to use the standardized API client and handle the new response format
 */
export function useCore(props) {
  const { file, onSaved, onFileDeleted, readOnly = false } = props;

  // === CORE FILE STATE ===
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [recipeQty, setRecipeQty] = useState('');
  const [recipeUnit, setRecipeUnit] = useState('L');
  const [components, setComponents] = useState([]);
  const [solutionRef, setSolutionRef] = useState(null);
  const [selectedSolution, setSelectedSolution] = useState(null);

  // === COMPONENT MANAGEMENT STATE ===
  const [editingComponent, setEditingComponent] = useState(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // === NETSUITE BOM STATE ===
  const [showBOMImport, setShowBOMImport] = useState(false);
  const [isImportingBOM, setIsImportingBOM] = useState(false);

  // === SOLUTION SEARCH STATE ===
  const [solutionSearch, setSolutionSearch] = useState('');
  const [solutionResults, setSolutionResults] = useState([]);
  const [isSearchingSolutions, setIsSearchingSolutions] = useState(false);

  // === OPERATION STATE ===
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // === REFS ===
  const searchTimeoutRef = useRef(null);
  const solutionSearchTimeoutRef = useRef(null);

  // === COMPUTED PROPERTIES WITH NULL SAFETY ===
  const canEdit = useMemo(() => !readOnly, [readOnly]);
  const isOriginalFile = useMemo(() => !file?.isBatch, [file?.isBatch]);
  const hasSolution = useMemo(() => !!selectedSolution, [selectedSolution]);
  const canImportBOM = useMemo(() => {
    return hasSolution && selectedSolution?.netsuiteInternalId && canEdit;
  }, [hasSolution, selectedSolution?.netsuiteInternalId, canEdit]);

  const totalComponents = useMemo(() => components?.length || 0, [components?.length]);
  const mappedComponents = useMemo(() => 
    components?.filter(c => c?.item && c?.item?._id)?.length || 0, 
    [components]
  );

  // === VALIDATION WITH NULL CHECKS ===
  const isValid = useMemo(() => {
    return fileName?.trim()?.length > 0 && file?._id;
  }, [fileName, file?._id]);

  // === COMPONENT SEARCH - FIXED ===
  const searchComponents = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const result = await filesApi.items.search(query);
      
      if (hasApiError(result)) {
        console.error('Error searching components:', handleApiError(result));
        setSearchResults([]);
      } else {
        const items = extractApiData(result, []);
        setSearchResults(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      console.error('Error searching components:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const debouncedComponentSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchComponents(query);
    }, 300);
  }, [searchComponents]);

  // === SOLUTION SEARCH - FIXED ===
  const searchSolutions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSolutionResults([]);
      return;
    }

    setIsSearchingSolutions(true);
    try {
      const result = await filesApi.items.searchSolutions(query);
      
      if (hasApiError(result)) {
        console.error('Error searching solutions:', handleApiError(result));
        setSolutionResults([]);
      } else {
        const items = extractApiData(result, []);
        setSolutionResults(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      console.error('Error searching solutions:', error);
      setSolutionResults([]);
    } finally {
      setIsSearchingSolutions(false);
    }
  }, []);

  const debouncedSolutionSearch = useCallback((query) => {
    if (solutionSearchTimeoutRef.current) {
      clearTimeout(solutionSearchTimeoutRef.current);
    }
    solutionSearchTimeoutRef.current = setTimeout(() => {
      searchSolutions(query);
    }, 300);
  }, [searchSolutions]);

  // === COMPONENT MANAGEMENT WITH SAFETY CHECKS ===
  const addComponent = useCallback((item) => {
    if (!item?._id) {
      console.warn('Cannot add component: invalid item');
      return;
    }

    const newComponent = {
      id: Date.now(), // Temporary ID
      item: item,
      itemId: item._id,
      qty: '',
      unit: item.uom || 'g',
      amount: 0
    };
    
    setComponents(prev => [...(prev || []), newComponent]);
    setHasChanges(true);
    setComponentSearch('');
    setSearchResults([]);
  }, []);

  const updateComponent = useCallback((componentId, updates) => {
    if (!componentId || !updates) {
      console.warn('Cannot update component: invalid parameters');
      return;
    }

    setComponents(prev => (prev || []).map(comp => 
      comp?.id === componentId || comp?.itemId === componentId
        ? { ...comp, ...updates, amount: parseFloat(updates.qty) || 0 }
        : comp
    ));
    setHasChanges(true);
  }, []);

  const removeComponent = useCallback((componentId) => {
    if (!componentId) {
      console.warn('Cannot remove component: invalid ID');
      return;
    }

    setComponents(prev => (prev || []).filter(comp => 
      comp?.id !== componentId && comp?.itemId !== componentId
    ));
    setHasChanges(true);
  }, []);

  const startEditingComponent = useCallback((component) => {
    setEditingComponent(component);
  }, []);

  const stopEditingComponent = useCallback(() => {
    setEditingComponent(null);
  }, []);

  // === SOLUTION MANAGEMENT ===
  const selectSolution = useCallback((solution) => {
    setSelectedSolution(solution);
    setSolutionRef(solution?._id);
    setHasChanges(true);
    setSolutionSearch('');
    setSolutionResults([]);
  }, []);

  const clearSolution = useCallback(() => {
    setSelectedSolution(null);
    setSolutionRef(null);
    setHasChanges(true);
  }, []);

  // === NETSUITE BOM IMPORT ===
  const openBOMImport = useCallback(() => {
    if (canImportBOM) {
      setShowBOMImport(true);
    }
  }, [canImportBOM]);

  const closeBOMImport = useCallback(() => {
    setShowBOMImport(false);
  }, []);

  const handleBOMImport = useCallback(async (importData) => {
    if (!importData || !file?._id) {
      console.warn('Cannot import BOM: invalid data or missing file ID');
      return;
    }

    setIsImportingBOM(true);
    try {
      // Process imported components
      if (importData.components && Array.isArray(importData.components)) {
        const processedComponents = importData.components.map((comp, index) => ({
          id: Date.now() + index,
          item: comp?.item,
          itemId: comp?.item?._id,
          qty: comp?.qty || '0',
          unit: comp?.unit || 'g',
          amount: parseFloat(comp?.qty) || 0,
          netsuiteData: comp?.netsuiteData
        })).filter(comp => comp.itemId); // Only include valid components

        setComponents(processedComponents);
      }

      // Update recipe details if provided
      if (importData.recipeQty) {
        setRecipeQty(importData.recipeQty.toString());
      }
      if (importData.recipeUnit) {
        setRecipeUnit(importData.recipeUnit);
      }

      setHasChanges(true);
      setShowBOMImport(false);
      
      // Auto-save after BOM import if not read-only
      if (canEdit) {
        await save();
      }
    } catch (error) {
      console.error('Error processing BOM import:', error);
      setError('Failed to import BOM data');
    } finally {
      setIsImportingBOM(false);
    }
  }, [canEdit, file?._id]);

  // === SAVE OPERATIONS WITH DEFENSIVE CHECKS - FIXED ===
  const save = useCallback(async () => {
    if (!isValid || !canEdit || !file?._id) {
      console.warn('Cannot save: invalid state or missing file ID');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updateData = {
        fileName: fileName?.trim() || '',
        description: description?.trim() || '',
        recipeQty: parseFloat(recipeQty) || 0,
        recipeUnit: recipeUnit?.trim() || 'L',
        components: (components || []).map(comp => ({
          item: comp?.itemId,
          qty: comp?.qty || '',
          unit: comp?.unit || 'g',
          amount: comp?.amount || 0,
          netsuiteData: comp?.netsuiteData
        })),
        solutionRef: solutionRef,
        solution: selectedSolution
      };

      const result = await filesApi.files.updateMeta(file._id, updateData);
      
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }

      setHasChanges(false);
      const updatedFile = extractApiData(result);
      onSaved?.(updatedFile);
    } catch (error) {
      console.error('Error saving file:', error);
      setError(error?.message || 'Failed to save file');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    isValid, canEdit, fileName, description, recipeQty, recipeUnit, 
    components, solutionRef, selectedSolution, file?._id, onSaved
  ]);

  // === DELETE OPERATIONS WITH NULL SAFETY - FIXED ===
  const deleteFile = useCallback(async () => {
    if (!file?._id || readOnly) {
      console.warn('Cannot delete: missing file ID or read-only mode');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Validate deletion is allowed
      const validation = await filesApi.validation.validateFolderDelete(file._id);
      if (hasApiError(validation)) {
        throw new Error(handleApiError(validation));
      }

      // Perform deletion
      const result = await filesApi.files.remove(file._id);
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }

      onFileDeleted?.(file);
    } catch (error) {
      console.error('Error deleting file:', error);
      setError(error?.message || 'Failed to delete file');
      throw error;
    } finally {
      setIsDeleting(false);
    }
  }, [file?._id, file, readOnly, onFileDeleted]);

  // === FORM HANDLERS ===
  const handleFieldChange = useCallback((field, value) => {
    switch (field) {
      case 'fileName':
        setFileName(value);
        break;
      case 'description':
        setDescription(value);
        break;
      case 'recipeQty':
        setRecipeQty(value);
        break;
      case 'recipeUnit':
        setRecipeUnit(value);
        break;
      default:
        break;
    }
    setHasChanges(true);
  }, []);

  const handleComponentSearchChange = useCallback((value) => {
    setComponentSearch(value);
    debouncedComponentSearch(value);
  }, [debouncedComponentSearch]);

  const handleSolutionSearchChange = useCallback((value) => {
    setSolutionSearch(value);
    debouncedSolutionSearch(value);
  }, [debouncedSolutionSearch]);

  // === RESET ON FILE CHANGE WITH NULL SAFETY ===
  useEffect(() => {
    if (file) {
      setFileName(file.fileName || '');
      setDescription(file.description || '');
      setRecipeQty(file.recipeQty || '');
      setRecipeUnit(file.recipeUnit || 'L');
      setComponents(file.components || []);
      setSolutionRef(file.solutionRef || null);
      setSelectedSolution(file.solution || null);
      setHasChanges(false);
      setError(null);
    } else {
      // Reset to empty state when file is null
      setFileName('');
      setDescription('');
      setRecipeQty('');
      setRecipeUnit('L');
      setComponents([]);
      setSolutionRef(null);
      setSelectedSolution(null);
      setHasChanges(false);
      setError(null);
    }
  }, [file]);

  // === CLEANUP ===
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (solutionSearchTimeoutRef.current) {
        clearTimeout(solutionSearchTimeoutRef.current);
      }
    };
  }, []);

  // === CONDITIONAL RETURN LOGIC ===
  if (!file) {
    return {
      // Return a safe default state when no file is provided
      fileName: '',
      description: '',
      recipeQty: '',
      recipeUnit: 'L',
      components: [],
      solutionRef: null,
      selectedSolution: null,
      editingComponent: null,
      componentSearch: '',
      searchResults: [],
      isSearching: false,
      showBOMImport: false,
      isImportingBOM: false,
      solutionSearch: '',
      solutionResults: [],
      isSearchingSolutions: false,
      isSaving: false,
      isDeleting: false,
      error: null,
      hasChanges: false,
      canEdit: false,
      isOriginalFile: false,
      hasSolution: false,
      canImportBOM: false,
      totalComponents: 0,
      mappedComponents: 0,
      isValid: false,
      // Provide no-op functions
      handleFieldChange: () => {},
      handleComponentSearchChange: () => {},
      handleSolutionSearchChange: () => {},
      addComponent: () => {},
      updateComponent: () => {},
      removeComponent: () => {},
      startEditingComponent: () => {},
      stopEditingComponent: () => {},
      selectSolution: () => {},
      clearSolution: () => {},
      openBOMImport: () => {},
      closeBOMImport: () => {},
      handleBOMImport: () => Promise.resolve(),
      save: () => Promise.resolve(),
      deleteFile: () => Promise.resolve(),
      setError: () => {},
      setSearchResults: () => {},
      setSolutionResults: () => {}
    };
  }

  // === RETURN INTERFACE FOR VALID FILE ===
  return {
    // === STATE ===
    fileName,
    description,
    recipeQty,
    recipeUnit,
    components,
    solutionRef,
    selectedSolution,
    editingComponent,
    componentSearch,
    searchResults,
    isSearching,
    showBOMImport,
    isImportingBOM,
    solutionSearch,
    solutionResults,
    isSearchingSolutions,
    isSaving,
    isDeleting,
    error,
    hasChanges,

    // === COMPUTED ===
    canEdit,
    isOriginalFile,
    hasSolution,
    canImportBOM,
    totalComponents,
    mappedComponents,
    isValid,

    // === ACTIONS ===
    handleFieldChange,
    handleComponentSearchChange,
    handleSolutionSearchChange,
    addComponent,
    updateComponent,
    removeComponent,
    startEditingComponent,
    stopEditingComponent,
    selectSolution,
    clearSolution,
    openBOMImport,
    closeBOMImport,
    handleBOMImport,
    save,
    deleteFile,

    // === UTILITIES ===
    setError,
    setSearchResults,
    setSolutionResults
  };
}