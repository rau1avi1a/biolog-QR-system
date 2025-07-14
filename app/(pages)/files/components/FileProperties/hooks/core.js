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
const canEdit = useMemo(() => {
  // Read-only if explicitly set OR if opened from a batch
  return !readOnly && !file?.isFromBatch;
}, [readOnly, file?.isFromBatch]);  const isOriginalFile = useMemo(() => !file?.isBatch, [file?.isBatch]);
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

// FIXED BOM Import Handler in FileProperties/hooks/core.js
// Replace the handleBOMImport function around line 130

const handleBOMImport = useCallback(async () => {
  if (!file?._id || !selectedSolution?.netsuiteInternalId) return;
  setIsImportingBOM(true);
  setError(null);

  try {
    // Use your existing working API call
    const result = await filesApi.netsuite.importBOMWorkflow(
      file._id,
      selectedSolution.netsuiteInternalId
    );
    if (hasApiError(result)) throw new Error(handleApiError(result));

    // pull updated file + mappingResults
    const { file: updatedFile, mappingResults } = extractApiData(result);

    // FIXED: Don't map units again - they're already mapped by BOM service
    const enriched = mappingResults.map((mr, idx) => {
      const nsComp = mr.netsuiteComponent;
      const local = mr.bestMatch?.chemical || {};
      
      // Units are already mapped from '35' → 'mL' by the BOM service
      console.log('🔧 Unit debug - already mapped:', {
        componentName: nsComp.ingredient,
        unitsFromBOMService: nsComp.units,
        typeof: typeof nsComp.units
      });
      
      return {
        id: nsComp.bomComponentId ?? `ns-${idx}`,
        item: local,
        itemId: local._id || nsComp.itemId,
        qty: String(nsComp.quantity ?? nsComp.bomQuantity ?? ''),
        unit: nsComp.units, // ← Use directly, already mapped to 'mL'
        amount: parseFloat(nsComp.quantity ?? nsComp.bomQuantity ?? 0),
        netsuiteData: {
          ...nsComp,
          originalUnits: nsComp.units,
          mappedUnit: nsComp.units
        }
      };
    });

    // Prepare components for database update using your existing structure
    const validComponents = enriched
      .filter(c => {
        const hasValidId = c?.itemId || c?.item?._id;
        const hasValidQty = c?.qty || c?.amount;
        return hasValidId && hasValidQty;
      })
      .map(c => ({
        item: c.itemId || c.item?._id,
        qty: c.qty || String(c.amount || 0),
        unit: c.unit,
        amount: c.amount || parseFloat(c.qty) || 0,
        netsuiteData: {
          ...c.netsuiteData,
          originalNetSuiteUnitId: c.netsuiteData?.originalUnits || c.netsuiteData?.units,
          mappedUnitSymbol: c.unit
        }
      }));

    console.log('🔧 BOM Import - Final components with units:', validComponents.map(c => ({
      itemId: c.item,
      unit: c.unit,
      originalNetSuiteId: c.netsuiteData?.originalNetSuiteUnitId,
      amount: c.amount
    })));

    // 🔥 CRITICAL FIX: Update the file with preservation flags
    const fileUpdateResult = await filesApi.files.updateMeta(file._id, {
      recipeQty: 1,
      recipeUnit: 'mL',
      components: validComponents,
      // 🆕 ADD THESE FLAGS TO PREVENT PDF RELOAD ISSUES
      _skipDocumentReset: true,
      _preservePage: 1,
      _preserveOverlays: true
    });

    if (hasApiError(fileUpdateResult)) {
      throw new Error(handleApiError(fileUpdateResult));
    }

    const finalUpdatedFile = extractApiData(fileUpdateResult);

    // Update UI state
    setComponents(enriched);
    setRecipeQty('1');
    setRecipeUnit('mL');
    setHasChanges(false);
    setShowBOMImport(false);
    
    // 🔥 CRITICAL FIX: Call onSaved with preservation flags
    if (onSaved) {
      const fileWithPreservation = {
        ...finalUpdatedFile,
        _skipDocumentReset: true,
        _preservePage: 1,
        _preserveOverlays: true,
        _bomImportCompleted: true // Flag to indicate BOM import was successful
      };
      onSaved(fileWithPreservation);
    }

    console.log('✅ BOM Import completed successfully with mapped units and PDF preservation');

  } catch (err) {
    console.error('❌ BOM Import failed:', err);
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
      solutionRef,
      // 🔥 CRITICAL FIX: Add preservation flags for regular saves too
      _skipDocumentReset: true,
      _preservePage: 1,
      _preserveOverlays: true
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

    // 🔥 CRITICAL FIX: Call onSaved with preservation flags
    if (onSaved) {
      const fileWithPreservation = {
        ...updatedFile,
        _skipDocumentReset: true,
        _preservePage: 1,
        _preserveOverlays: true,
        _regularSaveCompleted: true // Flag to indicate regular save was successful
      };
      onSaved(fileWithPreservation);
    }

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

(async () => {
    const hydrated = await Promise.all(
      (file.components || []).map(async comp => {
        // FIXED: Only map if it's a NetSuite unit ID (numeric), not if it's already a symbol
        let unitSym = comp.unit;
        
        // ADD THIS DEBUG LOG:
        console.log('🔧 File reload unit mapping debug:', {
          originalUnit: comp.unit,
          isNumeric: /^\d+$/.test(comp.unit.toString()),
          type: typeof comp.unit
        });
        
        if (comp.unit && /^\d+$/.test(comp.unit.toString())) {
          // It's a NetSuite ID like '35', map it to 'mL'
          unitSym = mapNetSuiteUnit(comp.unit);
          console.log('🔧 Mapped unit:', comp.unit, '→', unitSym);
        }
        
        let localItem = null;
        try {
          const res = await filesApi.items.get(comp.itemId);
          if (!hasApiError(res)) localItem = extractApiData(res);
        } catch {}
        return {
          ...comp,
          item: localItem,
          unit: unitSym,
          qty: String(comp.amount || 0)
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
