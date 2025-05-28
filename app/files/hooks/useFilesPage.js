// app/files/hooks/useFilesPage.js
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

/**
 *  One hook → every piece of state the Files page needs:
 *    ▸ PDF-editor state (currentDoc, draw mode, undo/save refs)
 *    ▸ Folder / file tree, search, uploads, refresh flags
 *
 *  UI components become dumb renderers: they only read or call what
 *  this hook returns.
 */
export default function useFilesPage() {
  /* ──────────────────────────────────────────────── */
  /*  A.  Editor-level state                         */
  /* ──────────────────────────────────────────────── */
  const [currentDoc, setCurrentDoc] = useState(null);
  const [isDraw,     setIsDraw]     = useState(true);
  
  /* expose editor refs so toolbar buttons can call them */
  const undoRef = useRef(null);
  const saveRef = useRef(null);

  /* ──────────────────────────────────────────────── */
  /*  B.  Navigator-level state                      */
  /* ──────────────────────────────────────────────── */
  const [view,setView] = useState('folders'); // → folders | status | archive
  const [root,  setRoot]  = useState([]);          // top-level folders
  const [files, setFiles] = useState([]);          // files in currentFolder

  const [search,        setSearch]        = useState(null); // array | null
  const [uploading,     setUploading]     = useState(false);
  const [folderRefresh, setFolderRefresh] = useState(0);    // bump → reload
  const [currentFolder, setCurrentFolder] = useState(null); // selected node

  /*  global refresh flag (any data change) - MOVED UP TO FIX HOISTING */
  const [refresh, setRefresh] = useState(0);
  const triggerRefresh = useCallback(() => setRefresh((p) => p + 1), []);

  /* helper to open/load a file */
  const openFile = useCallback(async (file) => {
    try {
      console.log('OpenFile called with:', {
        _id: file._id,
        fileName: file.fileName,
        isArchived: file.isArchived,
        batchId: file.batchId,
        originalFileId: file.originalFileId,
        fileId: file.fileId,
        status: file.status,
        runNumber: file.runNumber
      });

      // Check if this is an archived file/batch
      if (file.isArchived || file.batchId) {
        console.log('Loading archived file');
        const { file: archivedFile } = await api.loadArchivedFile(file._id);
        if (archivedFile) {
          setCurrentDoc({ 
            ...archivedFile, 
            pdf: archivedFile.pdf,
            isBatch: true,
            isArchived: true,
            originalFileId: archivedFile.originalFileId || archivedFile.fileId
          });
        } else {
          console.error('Archived file not found or empty response');
        }
      } else if (file.fileId || file.status || file.runNumber) {
        // This is a batch file (has fileId pointing to original file, or has batch-specific properties)
        console.log('Loading batch file via getBatch API');
        const response = await api.getBatch(file._id);
        console.log('getBatch response:', response);
        
        if (response && response.batch) {
          const batch = response.batch;
          console.log('Batch loaded:', {
            _id: batch._id,
            status: batch.status,
            hasSignedPdf: !!batch.signedPdf,
            hasOverlayPng: !!batch.overlayPng,
            fileId: batch.fileId
          });
          
          // For batches, prioritize the baked/signed PDF if it exists
          let pdfData = null;
          
          if (batch.signedPdf && batch.signedPdf.data) {
            // Use the baked PDF that has overlays burned in
            console.log('Using baked PDF with overlays');
            pdfData = `data:${batch.signedPdf.contentType || 'application/pdf'};base64,${batch.signedPdf.data.toString('base64')}`;
          } else if (batch.pdf) {
            // Use batch's own PDF
            console.log('Using batch PDF');
            pdfData = batch.pdf;
          } else if (batch.fileId) {
            // Fallback: load from original file
            const originalFileId = typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId;
            console.log('Loading PDF from original file:', originalFileId);
            try {
              const { file: originalFile } = await api.load(originalFileId);
              if (originalFile && originalFile.pdf) {
                pdfData = originalFile.pdf;
                console.log('Loaded PDF from original file');
              }
            } catch (err) {
              console.error('Failed to load original file PDF:', err);
            }
          }
          
          setCurrentDoc({ 
            ...batch, 
            pdf: pdfData,
            isBatch: true,
            originalFileId: typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId,
            // Don't pass overlays if we have a baked PDF (overlays are already burned in)
            overlays: batch.signedPdf ? null : (batch.overlays || null)
          });
        } else {
          console.error('Batch not found or empty response:', response);
          throw new Error('Batch not found or empty response');
        }
      } else {
        // This is an original file, load normally
        console.log('Loading original file');
        const { file: loaded } = await api.load(file._id);
        if (loaded) {
          setCurrentDoc({ 
            ...loaded, 
            pdf: loaded.pdf,
            isBatch: false
          });
        } else {
          console.error('File not found or empty response');
          throw new Error('File not found or empty response');
        }
      }
    } catch (error) {
      console.error('Failed to load file:', error);
      throw error; // Re-throw so the UI can handle it
    }
  }, []);

  /* Enhanced save function with workflow logic and proper error handling */
  const saveFile = useCallback(async (editorData, confirmationData = null) => {
    // Validate currentDoc exists
    if (!currentDoc) {
      console.error('No currentDoc available for saving');
      throw new Error('No document loaded');
    }

    // Debug currentDoc structure
    console.log('SaveFile - currentDoc structure:', {
      _id: currentDoc._id,
      fileName: currentDoc.fileName,
      fileId: currentDoc.fileId,
      originalFileId: currentDoc.originalFileId,
      isBatch: currentDoc.isBatch,
      isArchived: currentDoc.isArchived,
      status: currentDoc.status
    });

    // Validate required data
    if (!editorData?.overlayPng) {
      console.warn('No overlay data provided');
    }

    try {
      const isOriginal = !currentDoc.isBatch;
      const action = confirmationData?.action || 'save';

      console.log('SaveFile called:', { 
        isOriginal, 
        action, 
        hasConfirmationData: !!confirmationData,
        docId: currentDoc._id
      });

      if (isOriginal) {
        // Creating new batch from original file
        console.log('Creating new batch from original file:', currentDoc._id);
        
        const batchPayload = {
          fileId: currentDoc._id, // Original file ID
          overlayPng: editorData.overlayPng,
          annotations: editorData.annotations,
          canvasDimensions: editorData.canvasDimensions,
          status: 'Draft' // Start as draft
        };

        // Handle different actions
        if (action === 'create_work_order') {
          batchPayload.status = 'In Progress';
          batchPayload.workOrderCreated = true;
          batchPayload.workOrderCreatedAt = new Date().toISOString();
          
          if (confirmationData?.components) {
            batchPayload.confirmedComponents = confirmationData.components;
          }
        }

        console.log('Batch payload:', batchPayload);

        // Create new batch
        const response = await api.newBatch(currentDoc._id, batchPayload);
        console.log('newBatch response:', response);

        if (!response.success || !response.data) {
          throw new Error('Failed to create batch: ' + (response.error || 'Unknown error'));
        }

        const newBatch = response.data;

        // Load the created batch to get full data
        const loadResponse = await api.getBatch(newBatch._id);
        console.log('getBatch response:', loadResponse);

        if (!loadResponse.success || !loadResponse.data) {
          throw new Error('Failed to load created batch');
        }

        const loadedBatch = loadResponse.data;
        
        // Switch to the newly created batch
        setCurrentDoc({
          ...loadedBatch,
          pdf: loadedBatch.pdf || currentDoc.pdf, // Fallback to original PDF
          isBatch: true,
          originalFileId: loadedBatch.fileId
        });
        
      } else {
        // Updating existing batch
        console.log('Updating existing batch:', currentDoc._id);
        
        const updatePayload = {
          overlayPng: editorData.overlayPng,
          annotations: editorData.annotations,
          canvasDimensions: editorData.canvasDimensions
        };

        // Handle different workflow actions
        if (action === 'create_work_order' && !currentDoc.workOrderCreated) {
          updatePayload.status = 'In Progress';
          updatePayload.workOrderCreated = true;
          updatePayload.workOrderCreatedAt = new Date().toISOString();
        } 
        else if (action === 'submit_review') {
          updatePayload.status = 'Review';
          updatePayload.submittedForReviewAt = new Date().toISOString();
          
          // Only transact chemicals if not already done or if this was rejected
          if (!currentDoc.chemicalsTransacted || currentDoc.wasRejected) {
            updatePayload.chemicalsTransacted = true;
            updatePayload.transactionDate = new Date().toISOString();
          }
          
          // Create solution
          if (confirmationData?.solutionLotNumber) {
            updatePayload.solutionCreated = true;
            updatePayload.solutionLotNumber = confirmationData.solutionLotNumber;
            updatePayload.solutionCreatedDate = new Date().toISOString();
          }
          
          // Reset rejection flag
          updatePayload.wasRejected = false;
          
        } 
        else if (action === 'complete') {
          updatePayload.status = 'Completed';
          updatePayload.completedAt = new Date().toISOString();
          
        } 
        else if (action === 'reject') {
          updatePayload.status = 'In Progress';
          updatePayload.wasRejected = true;
          updatePayload.rejectedAt = new Date().toISOString();
          updatePayload.rejectedBy = 'Manager'; // TODO: Get actual user
          if (confirmationData?.rejectionReason) {
            updatePayload.rejectionReason = confirmationData.rejectionReason;
          }
        }

        // Add confirmation data if provided
        if (confirmationData?.components) {
          updatePayload.confirmedComponents = confirmationData.components;
        }

        console.log('Update payload:', updatePayload);

        // Update the batch
        const updateResponse = await api.updateBatch(currentDoc._id, updatePayload);
        console.log('updateBatch response:', updateResponse);

        if (!updateResponse.success || !updateResponse.data) {
          throw new Error('Failed to update batch: ' + (updateResponse.error || 'Unknown error'));
        }

        // Reload to get updated data
        const reloadResponse = await api.getBatch(currentDoc._id);
        console.log('reload getBatch response:', reloadResponse);

        if (!reloadResponse.success || !reloadResponse.data) {
          throw new Error('Failed to reload batch');
        }

        const reloadedBatch = reloadResponse.data;
        
        // Update current doc
        setCurrentDoc({
          ...currentDoc,
          ...reloadedBatch,
          pdf: reloadedBatch.pdf || currentDoc.pdf, // Preserve PDF if not returned
          isBatch: true
        });
      }
      
      triggerRefresh(); // Refresh the UI
      console.log('SaveFile completed successfully');
      
    } catch (error) {
      console.error('Failed to save file:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }, [currentDoc, triggerRefresh]);

  /* ── 1. load root folders whenever refreshes change */
  useEffect(() => {
    api.folders().then(({ folders }) => setRoot(folders || []));
  }, [folderRefresh, refresh]);

  /* ── 2. load files for the current context */
  useEffect(() => {
    if (currentFolder) {
      api.files(currentFolder._id).then(({ files }) => setFiles(files || []));
    } else if (view === 'folders') {
      api.files().then(({ files }) => setFiles(files || []));
    }
  }, [currentFolder, view, folderRefresh, refresh]);

  /* ── 3. folder CRUD helpers */
  const createFolder = async (name) => {
    await api.newFolder(name, currentFolder?._id);
    setFolderRefresh((p) => p + 1);
  };
  const updateFolder = async (id, n) => {
    await api.updateFolder(id, n);
    setFolderRefresh((p) => p + 1);
  };
  const deleteFolder = async (id) => {
    await api.deleteFolder(id);
    if (currentFolder?._id === id) setCurrentFolder(null);
    setFolderRefresh((p) => p + 1);
  };

  /* ── 4. uploads */
  const handleFiles = async (list) => {
    if (!list.length) return;
    setUploading(true);
    for (const f of list) await api.upload(f, currentFolder?._id);
    setUploading(false);
    triggerRefresh();
  };

  /* ──────────────────────────────────────────────── */
  /*  Return everything the page / panes need        */
  /* ──────────────────────────────────────────────── */
  return {
    /* editor stuff */
    currentDoc, setCurrentDoc,
    isDraw,     setIsDraw,
    undoRef,    saveRef,
    openFile,   saveFile,

    /* tree + list stuff */
    view, setView,
    root, files,
    currentFolder, setCurrentFolder,

    /* search + status view */
    search, setSearch,
    uploading,

    /* folder actions */
    createFolder, updateFolder, deleteFolder,

    /* upload handler */
    handleFiles,

    /* refresh flags */
    refreshTrigger: refresh,   // for StatusTabs & FileNavigator
    triggerRefresh,            // call after any mutation
  };
}