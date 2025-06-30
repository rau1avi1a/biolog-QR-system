// app/(pages)/files/components/FileProperties/hooks/core.js - CORRECT API CALLS

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { filesApi, hasApiError, extractApiData, handleApiError } from '../../../lib/api';

export function useCore(props) {
  const { file, onSaved, onFileDeleted, readOnly = false } = props;

  // === ALL YOUR EXISTING STATE (unchanged) ===
  const [fileName, setFileName] = useState('');
  const [description, setDescription] = useState('');
  const [recipeQty, setRecipeQty] = useState('');
  const [recipeUnit, setRecipeUnit] = useState('L');
  const [components, setComponents] = useState([]);
  const [solutionRef, setSolutionRef] = useState(null);
  const [selectedSolution, setSelectedSolution] = useState(null);
  const [editingComponent, setEditingComponent] = useState(null);
  const [componentSearch, setComponentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showBOMImport, setShowBOMImport] = useState(false);
  const [isImportingBOM, setIsImportingBOM] = useState(false);
  const [solutionSearch, setSolutionSearch] = useState('');
  const [solutionResults, setSolutionResults] = useState([]);
  const [isSearchingSolutions, setIsSearchingSolutions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const searchTimeoutRef = useRef(null);
  const solutionSearchTimeoutRef = useRef(null);

  // === ALL YOUR EXISTING COMPUTED PROPERTIES (unchanged) ===
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
  const isValid = useMemo(() => {
    return fileName?.trim()?.length > 0 && file?._id;
  }, [fileName, file?._id]);

  // === FIXED: COMPONENT SEARCH ===
  const searchComponents = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('🔍 Searching for components:', query);
      
      // CORRECT: Use the right API call from your architecture
      const result = await filesApi.items.search(query);
      
      if (hasApiError(result)) {
        console.error('❌ Error searching components:', handleApiError(result));
        setSearchResults([]);
      } else {
        const data = extractApiData(result);
        const items = data?.items || data || [];
        console.log('✅ Found components:', items.length);
        setSearchResults(Array.isArray(items) ? items : []);
      }
    } catch (error) {
      console.error('💥 Error searching components:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // === FIXED: SOLUTION SEARCH ===
  const searchSolutions = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setSolutionResults([]);
      return;
    }

    setIsSearchingSolutions(true);
    try {
      console.log('🔍 Searching for solutions:', query);
      
      // CORRECT: This should work with your API architecture
      // Your api.list.searchSolutions(query) calls api.list.searchItems(query, 'solution')
      const result = await filesApi.items.searchSolutions(query);
      
      console.log('🔍 Raw solution search result:', result);
      
      if (hasApiError(result)) {
        console.error('❌ Error searching solutions:', handleApiError(result));
        setSolutionResults([]);
      } else {
        const data = extractApiData(result);
        const solutions = data?.items || data || [];
        console.log('✅ Found solutions:', solutions.length, solutions);
        setSolutionResults(Array.isArray(solutions) ? solutions : []);
      }
    } catch (error) {
      console.error('💥 Error searching solutions:', error);
      setSolutionResults([]);
    } finally {
      setIsSearchingSolutions(false);
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

  const debouncedSolutionSearch = useCallback((query) => {
    if (solutionSearchTimeoutRef.current) {
      clearTimeout(solutionSearchTimeoutRef.current);
    }
    solutionSearchTimeoutRef.current = setTimeout(() => {
      searchSolutions(query);
    }, 300);
  }, [searchSolutions]);

  // === ALL YOUR OTHER METHODS STAY THE SAME ===
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

  const selectSolution = useCallback((solution) => {
    console.log('🎯 Selected solution:', solution);
    setSelectedSolution(solution);
    setSolutionRef(solution?._id);
    setHasChanges(true);
    setSolutionSearch('');
    setSolutionResults([]);
  }, []);

  const clearSolution = useCallback(() => {
    console.log('🧹 Clearing solution');
    setSelectedSolution(null);
    setSolutionRef(null);
    setHasChanges(true);
  }, []);

  const openBOMImport = useCallback(() => {
    if (canImportBOM) {
      console.log('📥 Opening BOM import for solution:', selectedSolution);
      setShowBOMImport(true);
    }
  }, [canImportBOM, selectedSolution]);

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
      console.log('📥 Importing BOM data for solution:', selectedSolution?.netsuiteInternalId);
      
      // TODO: You'll need to add this method to your filesApi if it doesn't exist
      // This is where you'd call your NetSuite BOM API
      console.log('🚧 BOM import would call NetSuite API here');
      
      // Placeholder implementation - replace with actual BOM import
      const processedComponents = (importData.components || []).map((comp, index) => ({
        id: Date.now() + index,
        item: comp?.item,
        itemId: comp?.item?._id,
        qty: comp?.qty || '0',
        unit: comp?.unit || 'g',
        amount: parseFloat(comp?.qty) || 0,
        netsuiteData: comp?.netsuiteData
      })).filter(comp => comp.itemId);

      setComponents(processedComponents);

      if (importData.recipeQty) {
        setRecipeQty(importData.recipeQty.toString());
      }
      if (importData.recipeUnit) {
        setRecipeUnit(importData.recipeUnit);
      }

      setHasChanges(true);
      setShowBOMImport(false);
      
      console.log('✅ BOM import completed successfully');
      
      if (canEdit) {
        await save();
      }
    } catch (error) {
      console.error('💥 Error processing BOM import:', error);
      setError('Failed to import BOM data: ' + (error.message || 'Unknown error'));
    } finally {
      setIsImportingBOM(false);
    }
  }, [canEdit, file?._id, selectedSolution]);

// === FIXED SAVE METHOD ===
const save = useCallback(async () => {
    if (!isValid || !canEdit || !file?._id) {
      console.warn('Cannot save: invalid state or missing file ID');
      return;
    }
  
    setIsSaving(true);
    setError(null);
  
    try {
      // FIXED: Only send the ID for solutionRef, not the full object
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
        // FIXED: Only send the ID, let the backend populate the full object
        solutionRef: solutionRef, // This should be just the ID string
        // DON'T send the full solution object - let the backend populate it
      };
  
      console.log('💾 FIXED: Saving file with data:', updateData);
      console.log('💾 Solution ID being saved:', solutionRef);
  
      const result = await filesApi.files.updateMeta(file._id, updateData);
      
      if (hasApiError(result)) {
        const errorMsg = handleApiError(result);
        throw new Error(errorMsg);
      }
  
      setHasChanges(false);
      const updatedFile = extractApiData(result);
      
      console.log('✅ FIXED: File saved, checking solution data...');
      console.log('✅ Updated file solutionRef:', updatedFile?.solutionRef);
      console.log('✅ Updated file solution:', updatedFile?.solution);
      
      // FIXED: Update local state with the populated data from backend
      if (updatedFile?.solution || updatedFile?.solutionRef) {
        // If backend populated the solution object, use it
        const populatedSolution = updatedFile.solution || updatedFile.solutionRef;
        setSelectedSolution(populatedSolution);
        setSolutionRef(populatedSolution._id);
      }
      
      onSaved?.(updatedFile);
      
    } catch (error) {
      console.error('💥 Error saving file:', error);
      setError(error?.message || 'Failed to save file');
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [
    isValid, canEdit, fileName, description, recipeQty, recipeUnit, 
    components, solutionRef, file?._id, onSaved
  ]);

  const deleteFile = useCallback(async () => {
    if (!file?._id || readOnly) {
      console.warn('Cannot delete: missing file ID or read-only mode');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      console.log('🗑️ Deleting file:', file._id);

      const result = await filesApi.files.remove(file._id);
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }

      console.log('✅ File deleted successfully');
      onFileDeleted?.(file);
    } catch (error) {
      console.error('💥 Error deleting file:', error);
      setError(error?.message || 'Failed to delete file');
      throw error;
    } finally {
      setIsDeleting(false);
    }
  }, [file?._id, file, readOnly, onFileDeleted]);

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

  // === RESET ON FILE CHANGE ===
  useEffect(() => {
    if (file) {
      console.log('📄 PERSISTENCE DEBUG: Loading file data on reload');
      console.log('📄 Raw file object from parent:', file);
      console.log('📄 File solutionRef:', file.solutionRef);
      console.log('📄 File solution:', file.solution);
      console.log('📄 File recipeQty:', file.recipeQty); // This works
      console.log('📄 File recipeUnit:', file.recipeUnit); // This works
      console.log('📄 File components:', file.components);
      
      setFileName(file.fileName || '');
      setDescription(file.description || '');
      setRecipeQty(file.recipeQty || '');
      setRecipeUnit(file.recipeUnit || 'L');
      setComponents(file.components || []);
      
      // DEBUG: Check which solution field has data
      const solutionFromRef = file.solutionRef;
      const solutionFromSolution = file.solution;
      
      console.log('📄 Solution from solutionRef:', solutionFromRef);
      console.log('📄 Solution from solution field:', solutionFromSolution);
      
      // Try both fields to see which one has the data
      const actualSolution = solutionFromSolution || solutionFromRef;
      
      setSolutionRef(actualSolution?._id || file.solutionRef || null);
      setSelectedSolution(actualSolution || null);
      
      console.log('📄 Final selected solution:', actualSolution);
      console.log('📄 Final solutionRef:', actualSolution?._id || file.solutionRef);
      
      setHasChanges(false);
      setError(null);
    }
  }, [file]);

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

  // === RETURN FULL INTERFACE ===
  if (!file) {
    return {
      file: null,
      fileName: '', description: '', recipeQty: '', recipeUnit: 'L',
      components: [], solutionRef: null, selectedSolution: null,
      editingComponent: null, componentSearch: '', searchResults: [],
      isSearching: false, showBOMImport: false, isImportingBOM: false,
      solutionSearch: '', solutionResults: [], isSearchingSolutions: false,
      isSaving: false, isDeleting: false, error: null, hasChanges: false,
      canEdit: false, isOriginalFile: false, hasSolution: false,
      canImportBOM: false, totalComponents: 0, mappedComponents: 0, isValid: false,
      handleFieldChange: () => {}, handleComponentSearchChange: () => {},
      handleSolutionSearchChange: () => {}, addComponent: () => {},
      updateComponent: () => {}, removeComponent: () => {},
      startEditingComponent: () => {}, stopEditingComponent: () => {},
      selectSolution: () => {}, clearSolution: () => {},
      openBOMImport: () => {}, closeBOMImport: () => {},
      handleBOMImport: () => Promise.resolve(), save: () => Promise.resolve(),
      deleteFile: () => Promise.resolve(), setError: () => {},
      setSearchResults: () => {}, setSolutionResults: () => {}
    };
  }

  return {
    file, fileName, description, recipeQty, recipeUnit, components,
    solutionRef, selectedSolution, editingComponent, componentSearch,
    searchResults, isSearching, showBOMImport, isImportingBOM,
    solutionSearch, solutionResults, isSearchingSolutions, isSaving,
    isDeleting, error, hasChanges, canEdit, isOriginalFile, hasSolution,
    canImportBOM, totalComponents, mappedComponents, isValid,
    handleFieldChange, handleComponentSearchChange, handleSolutionSearchChange,
    addComponent, updateComponent, removeComponent, startEditingComponent,
    stopEditingComponent, selectSolution, clearSolution, openBOMImport,
    closeBOMImport, handleBOMImport, save, deleteFile, setError,
    setSearchResults, setSolutionResults
  };
}