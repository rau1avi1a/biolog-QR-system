// app/files/components/PDFEditor/hooks/core/save/save.core.js
'use client';

import { useState, useCallback } from 'react';
import { filesApi } from '../../../../../lib/api';

/**
 * Save Operations Core Hook
 * Handles all save-related functionality:
 * - Save operations for original files and batches
 * - Overlay merging and canvas state management
 * - Work order creation and batch operations
 * - Document state preservation during saves
 * - Canvas dimensions and metadata handling
 */
export function useSave(doc, pageNo, canvasRef, ctxRef, pageContainerRef, overlaysRef, historiesRef, setHistory, setHistIdx, setOverlay, refreshFiles, setCurrentDoc, getMergedOverlays, preserveStateForSave, validateAndCleanBase64) {
  const [isSaving, setIsSaving] = useState(false);

  // Object sanitization utility (extracted from your core.js)
  const sanitizeObject = useCallback((obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    if (obj instanceof HTMLElement || obj.nodeType || obj.__reactFiber$) {
      return null;
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        JSON.stringify(value);
        sanitized[key] = sanitizeObject(value);
      } catch (error) {
        console.warn(`Skipping non-serializable value for key: ${key}`);
      }
    }
    return sanitized;
  }, []);

  // Get canvas dimensions for overlay quality (extracted from your core.js)
  const getCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = pageContainerRef.current;
    const containerRect = container?.getBoundingClientRect();
    
    // Get actual PDF canvas dimensions for accurate overlay scaling
    const pdfCanvas = container?.querySelector('.react-pdf__Page__canvas');
    const pdfCanvasRect = pdfCanvas?.getBoundingClientRect();
    
    return canvas ? {
      // Canvas actual dimensions
      width: canvas.width,
      height: canvas.height,
      
      // Display dimensions
      displayWidth: containerRect?.width || canvas.offsetWidth,
      displayHeight: containerRect?.height || canvas.offsetHeight,
      
      // PDF-specific dimensions for accurate overlay positioning
      pdfCanvasWidth: pdfCanvasRect?.width || canvas.width,
      pdfCanvasHeight: pdfCanvasRect?.height || canvas.height,
      pdfCanvasLeft: pdfCanvasRect ? pdfCanvasRect.left - containerRect.left : 0,
      pdfCanvasTop: pdfCanvasRect ? pdfCanvasRect.top - containerRect.top : 0,
      
      // Page information
      currentPage: pageNo,
      
      containerRect: containerRect ? {
        width: containerRect.width,
        height: containerRect.height,
        top: containerRect.top,
        left: containerRect.left,
        right: containerRect.right,
        bottom: containerRect.bottom,
        x: containerRect.x,
        y: containerRect.y
      } : null
    } : null;
  }, [pageNo, canvasRef, pageContainerRef]);

  // Save current canvas state to memory (extracted from your core.js)
  const saveCurrentCanvasState = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some(channel => channel !== 0);
      
      if (hasContent) {
        const currentSnapshot = canvas.toDataURL('image/png');
        overlaysRef.current[pageNo] = currentSnapshot;
        console.log('🔧 Saved current page', pageNo, 'overlay before save');
        
        let currentHistory = historiesRef.current[pageNo] || [];
        const newHistory = [...currentHistory, currentSnapshot];
        historiesRef.current[pageNo] = newHistory;
        setHistory(newHistory);
        setHistIdx(newHistory.length - 1);
        setOverlay(currentSnapshot);
      }
    }
  }, [pageNo, canvasRef, overlaysRef, historiesRef, setHistory, setHistIdx, setOverlay]);

  // Create page-specific overlay data for API
  const createPageOverlaysData = useCallback((mergedOverlays) => {
    const pageOverlays = {};
    Object.keys(mergedOverlays).forEach(pageNum => {
      pageOverlays[`page_${pageNum}`] = mergedOverlays[pageNum];
    });
    return pageOverlays;
  }, []);

  // Handle rejection action (extracted from your core.js)
  const handleReject = useCallback(async (cleanConfirmationData) => {
    setIsSaving(true);
    try {
      const result = await filesApi.batches.reject(doc._id, cleanConfirmationData?.reason || 'No reason provided');
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (setCurrentDoc && result.data) {
        setCurrentDoc({
          ...doc,
          ...result.data,
          isBatch: true
        });
      }
      
      refreshFiles?.();
      return result;
    } catch (err) {
      alert('Error during rejection: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [doc, setCurrentDoc, refreshFiles]);

  // Handle original file save (create new batch)
  const saveOriginalFile = useCallback(async (action, cleanConfirmationData, mergedOverlays, canvasDimensions) => {
    const editorData = {
      // Legacy compatibility
      overlayPng: mergedOverlays[1] || mergedOverlays[Object.keys(mergedOverlays)[0]],
      
      // Send merged overlays
      pageOverlays: createPageOverlaysData(mergedOverlays),
      annotations: mergedOverlays,  // Fallback format
      
      // Enhanced metadata
      overlayPages: Object.keys(mergedOverlays).map(p => parseInt(p)).sort((a, b) => a - b),
      canvasDimensions: canvasDimensions
    };

    if (action === 'create_work_order') {
      editorData.batchQuantity = cleanConfirmationData?.batchQuantity;
      editorData.batchUnit = cleanConfirmationData?.batchUnit;
      editorData.scaledComponents = cleanConfirmationData?.components || cleanConfirmationData?.scaledComponents;
      editorData.createWorkOrder = true;
    }

    console.log('📤 Sending editor data to API:', {
      hasOverlayPng: !!editorData.overlayPng,
      pageOverlaysCount: Object.keys(editorData.pageOverlays).length,
      annotationsCount: Object.keys(editorData.annotations).length,
      overlayPages: editorData.overlayPages
    });

    const result = await filesApi.editor.saveFromEditor(
      doc._id,
      editorData,
      action,
      cleanConfirmationData
    );
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Handle successful save result
    if (setCurrentDoc && result.data) {
      const newBatchData = result.data;
      
      let newPdfData = null;
      
      if (newBatchData.signedPdf?.data) {
        console.log('🔧 Constructing PDF from signedPdf in save result');
        newPdfData = validateAndCleanBase64(
          newBatchData.signedPdf.data,
          newBatchData.signedPdf.contentType || 'application/pdf'
        );
        
        if (newPdfData) {
          console.log('✅ Successfully constructed PDF data from save result');
        } else {
          console.error('❌ Failed to construct PDF from save result');
          newPdfData = doc.pdf;
        }
      } else {
        console.log('⚠️ No signedPdf in save result, using original PDF');
        newPdfData = doc.pdf;
      }
      
      const updatedDoc = {
        ...newBatchData,
        pdf: newPdfData,
        isBatch: true,
        originalFileId: newBatchData.fileId || doc._id,
        status: action === 'create_work_order' ? 'In Progress' : (newBatchData.status || 'Draft'),
        workOrderCreated: action === 'create_work_order' ? true : (newBatchData.workOrderCreated || false),
        workOrderStatus: action === 'create_work_order' ? 'creating' : (newBatchData.workOrderStatus || 'not_created'),
        _skipDocumentReset: true,
        ...preserveStateForSave(pageNo)
      };
      
      setCurrentDoc(updatedDoc);
    }
    
    return result;
  }, [doc, pageNo, setCurrentDoc, createPageOverlaysData, preserveStateForSave, validateAndCleanBase64]);

  // Handle existing batch save
  const saveExistingBatch = useCallback(async (action, cleanConfirmationData, mergedOverlays, canvasDimensions, backupState) => {
    const updateData = {
      // Legacy compatibility  
      overlayPng: mergedOverlays[1] || mergedOverlays[Object.keys(mergedOverlays)[0]],
      
      // Send merged overlays that include existing + new
      pageOverlays: createPageOverlaysData(mergedOverlays),
      annotations: mergedOverlays,
      
      // Enhanced metadata
      overlayPages: Object.keys(mergedOverlays).map(p => parseInt(p)).sort((a, b) => a - b),
      canvasDimensions: canvasDimensions
    };

    if (action === 'submit_review' && cleanConfirmationData) {
      updateData.status = 'Review';
      updateData.submittedForReviewAt = new Date();
      
      if (cleanConfirmationData.components?.length > 0) {
        updateData.chemicalsTransacted = true;
        updateData.transactionDate = new Date();
        updateData.confirmedComponents = cleanConfirmationData.components;
      }
      
      if (cleanConfirmationData.solutionLotNumber) {
        updateData.solutionCreated = true;
        updateData.solutionLotNumber = cleanConfirmationData.solutionLotNumber;
        updateData.solutionCreatedDate = new Date();
        
        if (cleanConfirmationData.solutionQuantity) {
          updateData.solutionQuantity = cleanConfirmationData.solutionQuantity;
        }
        if (cleanConfirmationData.solutionUnit) {
          updateData.solutionUnit = cleanConfirmationData.solutionUnit;
        }
      }
      
    } else if (action === 'complete') {
      updateData.status = 'Completed';
      updateData.completedAt = new Date();
    }

    console.log('📤 Sending batch update data to API:', {
      hasOverlayPng: !!updateData.overlayPng,
      pageOverlaysCount: Object.keys(updateData.pageOverlays).length,
      annotationsCount: Object.keys(updateData.annotations).length,
      overlayPages: updateData.overlayPages
    });

    backupState();

    const result = await filesApi.batches.update(doc._id, updateData);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (setCurrentDoc && result.data) {
      const updatedDoc = {
        ...doc,
        ...result.data,
        _skipDocumentReset: true,
        ...preserveStateForSave(pageNo)
      };
      setCurrentDoc(updatedDoc);
    }
    
    return result;
  }, [doc, pageNo, setCurrentDoc, createPageOverlaysData, preserveStateForSave]);

  // MAIN SAVE FUNCTION (extracted from your core.js)
  const save = useCallback(async (action = 'save', confirmationData = null) => {
    console.log('🔧 CORE.SAVE CALLED:', { action, confirmationData, docFileName: doc?.fileName, currentPage: pageNo });

    if (!doc) return;
    if (doc.isArchived || doc.status === 'Completed') {
      alert('Cannot save changes to completed or archived files.');
      return;
    }
    
    const cleanConfirmationData = confirmationData ? sanitizeObject(confirmationData) : null;
    
    // Handle rejection separately
    if (action === 'reject') {
      return await handleReject(cleanConfirmationData);
    }

    // Save current page overlay to memory BEFORE building overlay data
    saveCurrentCanvasState();

    // Get merged overlays and canvas dimensions
    const mergedOverlays = getMergedOverlays(doc);
    const canvasDimensions = getCanvasDimensions();

    console.log('📤 Final overlay data for API:', {
      pageOverlaysCount: Object.keys(createPageOverlaysData(mergedOverlays)).length,
      mergedOverlaysCount: Object.keys(mergedOverlays).length,
      overlayPages: Object.keys(mergedOverlays).map(p => parseInt(p)).sort((a, b) => a - b),
      canvasDimensions: canvasDimensions ? {
        canvasSize: `${canvasDimensions.width}x${canvasDimensions.height}`,
        pdfCanvasSize: `${canvasDimensions.pdfCanvasWidth}x${canvasDimensions.pdfCanvasHeight}`,
        currentPage: canvasDimensions.currentPage
      } : 'no canvas dims'
    });

    setIsSaving(true);
    
    try {
      const isOriginal = !doc.isBatch && !doc.originalFileId;
      let result;
      
      if (isOriginal) {
        result = await saveOriginalFile(action, cleanConfirmationData, mergedOverlays, canvasDimensions);
      } else {
        // For existing batches, we need to pass the backupState function
        // This would come from the overlay hook
        const backupState = () => {}; // This should be passed in from overlay hook
        result = await saveExistingBatch(action, cleanConfirmationData, mergedOverlays, canvasDimensions, backupState);
      }
      
      console.log('✅ Save completed - staying on page', pageNo, 'with overlays preserved');
      return result;
      
    } catch (err) {
      console.error('💥 Save error details:', err);
      alert('Save error: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [
    doc, 
    pageNo, 
    sanitizeObject, 
    handleReject, 
    saveCurrentCanvasState, 
    getMergedOverlays, 
    getCanvasDimensions, 
    createPageOverlaysData, 
    saveOriginalFile, 
    saveExistingBatch
  ]);

  return {
    // === STATE ===
    isSaving,
    setIsSaving,

    // === MAIN FUNCTION ===
    save,

    // === UTILITY FUNCTIONS ===
    sanitizeObject,
    getCanvasDimensions,
    saveCurrentCanvasState,
    createPageOverlaysData
  };
}