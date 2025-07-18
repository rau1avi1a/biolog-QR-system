// app/(pages)/files/components/PDFEditor/hooks/core/save/save.core.js
'use client';

import { useState, useCallback } from 'react';
import { filesApi } from '../../../../../lib/api';

/**
 * Save Operations Core Hook - FIXED to prevent canvas clearing race conditions
 */
export function useSave(
  doc,
  pageNo, 
  canvasRef, 
  ctxRef, 
  pageContainerRef, 
  overlaysRef, 
  historiesRef, 
  setHistory, 
  setHistIdx, 
  setOverlay, 
  refreshFiles, 
  setCurrentDoc, 
  getMergedOverlays, 
  preserveStateForSave, 
  validateAndCleanBase64,
  getNewSessionOverlays,
  updateBakedOverlays
) {
  const [isSaving, setIsSaving] = useState(false);

  // Object sanitization utility
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

  // Get canvas dimensions for overlay quality
  const getCanvasDimensions = useCallback(() => {
    const canvas = canvasRef.current;
    const container = pageContainerRef.current;
    const containerRect = container?.getBoundingClientRect();
    
    const pdfCanvas = container?.querySelector('.react-pdf__Page__canvas');
    const pdfCanvasRect = pdfCanvas?.getBoundingClientRect();
    
    return canvas ? {
      width: canvas.width,
      height: canvas.height,
      displayWidth: containerRect?.width || canvas.offsetWidth,
      displayHeight: containerRect?.height || canvas.offsetHeight,
      pdfCanvasWidth: pdfCanvasRect?.width || canvas.width,
      pdfCanvasHeight: pdfCanvasRect?.height || canvas.height,
      pdfCanvasLeft: pdfCanvasRect ? pdfCanvasRect.left - containerRect.left : 0,
      pdfCanvasTop: pdfCanvasRect ? pdfCanvasRect.top - containerRect.top : 0,
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

  // Save current canvas state to memory
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
  const createPageOverlaysData = useCallback((overlaysToSave) => {
    const pageOverlays = {};
    Object.keys(overlaysToSave).forEach(pageNum => {
      pageOverlays[`page_${pageNum}`] = overlaysToSave[pageNum];
    });
    return pageOverlays;
  }, []);

  // Handle rejection action
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
  const saveOriginalFile = useCallback(async (action, cleanConfirmationData, overlaysToSave, canvasDimensions) => {
    const editorData = {
      overlayPng: overlaysToSave[1] || overlaysToSave[Object.keys(overlaysToSave)[0]],
      pageOverlays: createPageOverlaysData(overlaysToSave),
      annotations: overlaysToSave,
      overlayPages: Object.keys(overlaysToSave).map(p => parseInt(p)).sort((a, b) => a - b),
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
  const saveExistingBatch = useCallback(async (action, cleanConfirmationData, overlaysToSave, canvasDimensions, backupState) => {
    const updateData = {
      overlayPng: overlaysToSave[1] || overlaysToSave[Object.keys(overlaysToSave)[0]],
      pageOverlays: createPageOverlaysData(overlaysToSave),
      annotations: overlaysToSave,
      overlayPages: Object.keys(overlaysToSave).map(p => parseInt(p)).sort((a, b) => a - b),
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

    if (backupState) backupState();

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

  // MAIN SAVE FUNCTION - FIXED to prevent canvas clearing race conditions
  const save = useCallback(async (action = 'save', confirmationData = null) => {
    console.log('🔧 CORE.SAVE CALLED:', { action, confirmationData, docFileName: doc?.fileName, currentPage: pageNo });

    if (!doc) return;
    if (doc.isArchived || doc.status === 'Completed') {
      alert('Cannot save changes to completed or archived files.');
      return;
    }
    
    const cleanConfirmationData = confirmationData ? sanitizeObject(confirmationData) : null;
    
    if (action === 'reject') {
      return await handleReject(cleanConfirmationData);
    }

    // Save current page overlay to memory BEFORE building overlay data
    saveCurrentCanvasState();

    console.log('📄 Building overlay data with proper baked/session separation...');
    
    let overlaysToSave;
    if (getNewSessionOverlays && typeof getNewSessionOverlays === 'function') {
      overlaysToSave = getNewSessionOverlays(doc);
      console.log('🔍 getNewSessionOverlays result:', {
        pages: Object.keys(overlaysToSave),
        count: Object.keys(overlaysToSave).length
      });
      
      if (Object.keys(overlaysToSave).length === 0) {
        console.log('🔄 getNewSessionOverlays returned empty, trying getMergedOverlays...');
        overlaysToSave = getMergedOverlays(doc);
      }
    } else {
      console.warn('⚠️ getNewSessionOverlays not available, falling back to getMergedOverlays');
      overlaysToSave = getMergedOverlays(doc);
    }
    
    if (Object.keys(overlaysToSave).length === 0) {
      console.warn('⚠️ WARNING: No overlays to save!');
    }
    
    const canvasDimensions = getCanvasDimensions();

    setIsSaving(true);
    
    try {
      const isOriginal = !doc.isBatch && !doc.originalFileId;
      let result;
      
      if (isOriginal) {
        result = await saveOriginalFile(action, cleanConfirmationData, overlaysToSave, canvasDimensions);
      } else {
        const backupState = () => {};
        result = await saveExistingBatch(action, cleanConfirmationData, overlaysToSave, canvasDimensions, backupState);
      }

      // ✅ CRITICAL FIX: Update baked overlays ONLY if save was successful
      if (result && !result.error) {
        console.log('✅ Save successful - updating baked overlay state');
        
        if (updateBakedOverlays && typeof updateBakedOverlays === 'function') {
          // ✅ CRITICAL FIX: Pass the action to updateBakedOverlays
          updateBakedOverlays(overlaysToSave, pageNo, action);
        } else {
          console.warn('⚠️ updateBakedOverlays not available');
        }

        // ✅ CRITICAL FIX: Clear canvas immediately after save to prevent double overlay
        // BUT ONLY if this is not a 'complete' action
        if (action !== 'complete') {
          console.log('🎨 Clearing canvas immediately after save - overlay is now baked into PDF');
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const devicePixelRatio = window.devicePixelRatio || 1;
            
            // Clear the canvas completely
            ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
            console.log('🧹 Canvas cleared - PDF reload will show only baked overlay');
          }
        } else {
          console.log('🔒 Complete action: Preserving canvas state for completed file');
        }
      }
      
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
    canvasRef, 
    sanitizeObject, 
    handleReject, 
    saveCurrentCanvasState, 
    getMergedOverlays,
    getNewSessionOverlays,
    updateBakedOverlays,
    getCanvasDimensions, 
    createPageOverlaysData, 
    saveOriginalFile, 
    saveExistingBatch,
    overlaysRef
  ]);

  return {
    isSaving,
    setIsSaving,
    save,
    sanitizeObject,
    getCanvasDimensions,
    saveCurrentCanvasState,
    createPageOverlaysData
  };
}