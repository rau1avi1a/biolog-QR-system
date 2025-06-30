// app/(pages)/files/components/FileProperties/hooks/core.js
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { filesApi, hasApiError, extractApiData, handleApiError } from '../../../lib/api';
import { mapNetSuiteUnit } from '@/db/lib/netsuite-units.js';  // ← new

export function useCore(props) {
  const { file, onSaved, onFileDeleted, readOnly = false } = props;

  // state
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

  // computed
  const canEdit = useMemo(() => !readOnly, [readOnly]);
  const isOriginalFile = useMemo(() => !file?.isBatch, [file?.isBatch]);
  const hasSolution = useMemo(() => !!selectedSolution, [selectedSolution]);
  const canImportBOM = useMemo(() => hasSolution && selectedSolution?.netsuiteInternalId && canEdit, [hasSolution, selectedSolution, canEdit]);
  const totalComponents = useMemo(() => components?.length || 0, [components]);
  const mappedComponents = useMemo(() => components.filter(c => c.item?._id).length, [components]);
  const isValid = useMemo(() => fileName.trim().length > 0 && file?._id, [fileName, file]);

  // search components
  const searchComponents = useCallback(async (query) => {
    if (query.length < 2) return setSearchResults([]);
    setIsSearching(true);
    try {
      const result = await filesApi.items.search(query);
      if (hasApiError(result)) {
        console.error(handleApiError(result));
        setSearchResults([]);
      } else {
        const data = extractApiData(result);
        setSearchResults(data.items || data || []);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // search solutions
  const searchSolutions = useCallback(async (query) => {
    if (query.length < 2) return setSolutionResults([]);
    setIsSearchingSolutions(true);
    try {
      const result = await filesApi.items.searchSolutions(query);
      if (hasApiError(result)) {
        console.error(handleApiError(result));
        setSolutionResults([]);
      } else {
        const data = extractApiData(result);
        setSolutionResults(data.items || data || []);
      }
    } catch {
      setSolutionResults([]);
    } finally {
      setIsSearchingSolutions(false);
    }
  }, []);

  const debouncedComponentSearch = useCallback((q) => {
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchComponents(q), 300);
  }, [searchComponents]);

  const debouncedSolutionSearch = useCallback((q) => {
    clearTimeout(solutionSearchTimeoutRef.current);
    solutionSearchTimeoutRef.current = setTimeout(() => searchSolutions(q), 300);
  }, [searchSolutions]);

  // add/update/remove component
  const addComponent = useCallback(item => {
    if (!item?._id) return;
    setComponents(prev => [
      ...prev,
      {
        id: Date.now(),
        item,
        itemId: item._id,
        qty: '',
        unit: item.uom || 'g',
        amount: 0
      }
    ]);
    setHasChanges(true);
    setComponentSearch('');
    setSearchResults([]);
  }, []);

  const updateComponent = useCallback((compId, updates) => {
    setComponents(prev => prev.map(c =>
      (c.id === compId || c.itemId === compId)
        ? { ...c, ...updates, amount: parseFloat(updates.qty) || 0 }
        : c
    ));
    setHasChanges(true);
  }, []);

  const removeComponent = useCallback(compId => {
    setComponents(prev => prev.filter(c => c.id !== compId && c.itemId !== compId));
    setHasChanges(true);
  }, []);

  const startEditingComponent = useCallback(c => setEditingComponent(c), []);
  const stopEditingComponent  = useCallback(() => setEditingComponent(null), []);

  // select/clear solution
  const selectSolution = useCallback(sol => {
    setSelectedSolution(sol);
    setSolutionRef(sol._id);
    setHasChanges(true);
    setSolutionSearch('');
    setSolutionResults([]);
  }, []);

  const clearSolution = useCallback(() => {
    setSelectedSolution(null);
    setSolutionRef(null);
    setHasChanges(true);
  }, []);

  // BOM import
  const openBOMImport = useCallback(() => canImportBOM && setShowBOMImport(true), [canImportBOM]);
  const closeBOMImport = useCallback(() => setShowBOMImport(false), []);

  const handleBOMImport = useCallback(async () => {
    if (!file?._id || !selectedSolution?.netsuiteInternalId) return;
    setIsImportingBOM(true);
    setError(null);

    try {
      const result = await filesApi.netsuite.importBOMWorkflow(
        file._id,
        selectedSolution.netsuiteInternalId
      );
      if (hasApiError(result)) throw new Error(handleApiError(result));

      // pull updated file + mappingResults
      const { file: updatedFile, mappingResults } = extractApiData(result);

      // build enriched components
      const enriched = mappingResults.map((mr, idx) => {
        const nsComp = mr.netsuiteComponent;
        const local  = mr.bestMatch?.chemical || {};
        return {
          id: nsComp.bomComponentId ?? `ns-${idx}`,
          item: local,
          itemId: local._id || nsComp.itemId,
          qty: String(nsComp.quantity ?? nsComp.bomQuantity ?? ''),
          unit: mapNetSuiteUnit(nsComp.units),
          amount: parseFloat(nsComp.quantity ?? nsComp.bomQuantity ?? 0),
          netsuiteData: nsComp
        };
      });

      setComponents(enriched);
      setRecipeQty('1');
      setRecipeUnit('mL');
      setHasChanges(false);
      setShowBOMImport(false);
      onSaved?.(updatedFile);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error importing BOM');
    } finally {
      setIsImportingBOM(false);
    }
  }, [file, selectedSolution, onSaved]);

  // save file
  const save = useCallback(async () => {
    if (!isValid || !canEdit || !file?._id) return;
    setIsSaving(true);
    setError(null);

    try {
      const updateData = {
        fileName:    fileName.trim(),
        description: description.trim(),
        recipeQty:   parseFloat(recipeQty) || 0,
        recipeUnit:  recipeUnit.trim() || 'L',
        components:  components.map(c => ({
          item:         c.itemId,
          qty:          c.qty,
          unit:         c.unit,
          amount:       c.amount,
          netsuiteData: c.netsuiteData
        })),
        solutionRef
      };

      const result = await filesApi.files.updateMeta(file._id, updateData);
      if (hasApiError(result)) throw new Error(handleApiError(result));

      setHasChanges(false);
      const updatedFile = extractApiData(result);

      // if the backend populated the full solution object, grab it
      const popSol = updatedFile.solution || updatedFile.solutionRef;
      if (popSol) {
        setSelectedSolution(popSol);
        setSolutionRef(popSol._id);
      }

      onSaved?.(updatedFile);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error saving');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [
    isValid, canEdit, fileName, description,
    recipeQty, recipeUnit, components, solutionRef,
    file, onSaved
  ]);

  // delete file
  const deleteFile = useCallback(async () => {
    if (!file?._id || readOnly) return;
    setIsDeleting(true);
    setError(null);

    try {
      const result = await filesApi.files.remove(file._id);
      if (hasApiError(result)) throw new Error(handleApiError(result));
      onFileDeleted?.(file);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error deleting');
      throw err;
    } finally {
      setIsDeleting(false);
    }
  }, [file, readOnly, onFileDeleted]);

  const handleFieldChange = useCallback((f, v) => {
    if (f === 'fileName') setFileName(v);
    if (f === 'description') setDescription(v);
    if (f === 'recipeQty') setRecipeQty(v);
    if (f === 'recipeUnit') setRecipeUnit(v);
    setHasChanges(true);
  }, []);

  const handleComponentSearchChange = useCallback(v => {
    setComponentSearch(v);
    debouncedComponentSearch(v);
  }, [debouncedComponentSearch]);

  const handleSolutionSearchChange = useCallback(v => {
    setSolutionSearch(v);
    debouncedSolutionSearch(v);
  }, [debouncedSolutionSearch]);

  // ————— RESET ON FILE CHANGE —————
  useEffect(() => {
    if (!file) return;

    // basic fields
    setFileName(file.fileName || '');
    setDescription(file.description || '');
    setRecipeQty(file.recipeQty != null ? String(file.recipeQty) : '');
    setRecipeUnit(file.recipeUnit || 'L');

    // solution
    const sol = file.solution || file.solutionRef;
    setSelectedSolution(sol);
    setSolutionRef(sol?._id || null);

    // hydrate + map units
    (async () => {
      const hydrated = await Promise.all(
        (file.components || []).map(async comp => {
          const unitSym = mapNetSuiteUnit(comp.unit);
          let localItem = null;
          try {
            const res = await filesApi.items.get(comp.itemId);
            if (!hasApiError(res)) localItem = extractApiData(res);
          } catch {}
          return {
            ...comp,
            item: localItem,
            unit: unitSym,
            qty:  String(comp.amount || 0)
          };
        })
      );
      setComponents(hydrated);
    })();

    setHasChanges(false);
    setError(null);

  }, [file]);

  // cleanup timers
  useEffect(() => () => {
    clearTimeout(searchTimeoutRef.current);
    clearTimeout(solutionSearchTimeoutRef.current);
  }, []);

  // return
  if (!file) {
    return {
      file: null,
      // ...all your defaults from before (see your original)
    };
  }

  return {
    file, fileName, description,
    recipeQty, recipeUnit,
    components, solutionRef, selectedSolution,
    editingComponent, componentSearch,
    searchResults, isSearching,
    showBOMImport, isImportingBOM,
    solutionSearch, solutionResults,
    isSearchingSolutions, isSaving,
    isDeleting, error, hasChanges,
    canEdit, isOriginalFile, hasSolution,
    canImportBOM, totalComponents,
    mappedComponents, isValid,
    handleFieldChange, handleComponentSearchChange,
    handleSolutionSearchChange, addComponent,
    updateComponent, removeComponent,
    startEditingComponent, stopEditingComponent,
    selectSolution, clearSolution,
    openBOMImport, closeBOMImport,
    handleBOMImport, save,
    deleteFile, setError,
    setSearchResults, setSolutionResults
  };
}
