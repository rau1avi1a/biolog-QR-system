// app/files/hooks/useFilesPage.js - Fixed import path
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../lib/api'; // Fixed: was './lib/api'

/**
 * Enhanced hook for the Files page with improved folder upload functionality
 * One hook → every piece of state the Files page needs:
 *   ▸ PDF-editor state (currentDoc, draw mode, undo/save refs)
 *   ▸ Folder / file tree, search, uploads, refresh flags
 *   ▸ Enhanced folder structure handling
 */
export default function useFilesPage() {
  /* ──────────────────────────────────────────────── */
  /*  A.  Editor-level state                         */
  /* ──────────────────────────────────────────────── */
  const [currentDoc, setCurrentDoc] = useState(null);
  const [isDraw, setIsDraw] = useState(true);
  
  /* expose editor refs so toolbar buttons can call them */
  const undoRef = useRef(null);
  const saveRef = useRef(null);

  /* ──────────────────────────────────────────────── */
  /*  B.  Navigator-level state                      */
  /* ──────────────────────────────────────────────── */
  const [view, setView] = useState('folders'); // → folders | status | archive
  const [root, setRoot] = useState([]);          // top-level folders
  const [files, setFiles] = useState([]);       // files in currentFolder

  const [search, setSearch] = useState(null);        // array | null
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // for folder uploads
  const [folderRefresh, setFolderRefresh] = useState(0);    // bump → reload
  const [currentFolder, setCurrentFolder] = useState(null); // selected node

  /*  global refresh flag (any data change) */
  const [refresh, setRefresh] = useState(0);
  const triggerRefresh = useCallback(() => setRefresh((p) => p + 1), []);

  /* helper to open/load a file */
  const openFile = useCallback(async (file) => {
    try {
      // Check if this is an archived file/batch
      if (file.isArchived || file.batchId) {
        const { file: archivedFile } = await api.loadArchivedFile(file._id);
        if (archivedFile) {
          setCurrentDoc({ 
            ...archivedFile, 
            pdf: archivedFile.pdf,
            isBatch: true,
            isArchived: true,
            originalFileId: archivedFile.originalFileId || archivedFile.fileId
          });
        }
      } else if (file.fileId || file.status || file.runNumber) {
        // This is a batch file (has fileId pointing to original file, or has batch-specific properties)
        const response = await api.getBatch(file._id);
        
        if (response && response.batch) {
          const batch = response.batch;
          
          // For batches, prioritize the baked/signed PDF if it exists
          let pdfData = null;
          
          if (batch.signedPdf && batch.signedPdf.data) {
            // Use the baked PDF that has overlays burned in
            pdfData = `data:${batch.signedPdf.contentType || 'application/pdf'};base64,${batch.signedPdf.data.toString('base64')}`;
          } else if (batch.pdf) {
            // Use batch's own PDF
            pdfData = batch.pdf;
          } else if (batch.fileId) {
            // Fallback: load from original file
            const originalFileId = typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId;
            try {
              const { file: originalFile } = await api.load(originalFileId);
              if (originalFile && originalFile.pdf) {
                pdfData = originalFile.pdf;
              }
            } catch (err) {
              // Silently handle error
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
          throw new Error('Batch not found or empty response');
        }
      } else {
        // This is an original file, load normally
        const { file: loaded } = await api.load(file._id);
        if (loaded) {
          setCurrentDoc({ 
            ...loaded, 
            pdf: loaded.pdf,
            isBatch: false
          });
        } else {
          throw new Error('File not found or empty response');
        }
      }
    } catch (error) {
      throw error; // Re-throw so the UI can handle it
    }
  }, []);

  /* Enhanced save function with workflow logic and proper error handling */
  const saveFile = useCallback(async (editorData, confirmationData = null) => {
    // Validate currentDoc exists
    if (!currentDoc) {
      throw new Error('No document loaded');
    }

    try {
      const isOriginal = !currentDoc.isBatch;
      const action = confirmationData?.action || 'save';

      if (isOriginal) {
        // Creating new batch from original file
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

        // Create new batch
        const response = await api.newBatch(currentDoc._id, batchPayload);

        if (!response.success || !response.data) {
          throw new Error('Failed to create batch: ' + (response.error || 'Unknown error'));
        }

        const newBatch = response.data;

        // Load the created batch to get full data
        const loadResponse = await api.getBatch(newBatch._id);

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

        // Update the batch
        const updateResponse = await api.updateBatch(currentDoc._id, updatePayload);

        if (!updateResponse.success || !updateResponse.data) {
          throw new Error('Failed to update batch: ' + (updateResponse.error || 'Unknown error'));
        }

        // Reload to get updated data
        const reloadResponse = await api.getBatch(currentDoc._id);

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
      
    } catch (error) {
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
    try {
      await api.newFolder(name, currentFolder?._id);
      setFolderRefresh((p) => p + 1);
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  };

  const updateFolder = async (id, name) => {
    try {
      await api.updateFolder(id, name);
      setFolderRefresh((p) => p + 1);
    } catch (error) {
      console.error('Failed to update folder:', error);
      throw error;
    }
  };

  const deleteFolder = async (id) => {
    try {
      await api.deleteFolder(id);
      if (currentFolder?._id === id) setCurrentFolder(null);
      setFolderRefresh((p) => p + 1);
    } catch (error) {
      console.error('Failed to delete folder:', error);
      throw error;
    }
  };

  /* ── 4. Enhanced file uploads with progress tracking */
  const handleFiles = async (list) => {
    if (!list.length) return;
    
    setUploading(true);
    setUploadProgress({ current: 0, total: list.length });
    
    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        await api.upload(file, currentFolder?._id);
        setUploadProgress({ current: i + 1, total: list.length });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(null);
      triggerRefresh();
    }
  };

  /* ── 5. Enhanced folder upload with structure preservation - ChatGPT's clean approach */
  const handleFolderUpload = useCallback(async (files) => {
    console.log('🗂️ HOOK: handleFolderUpload called with', files.length, 'files');
    
    if (!files.length) return;
    
    // Debug: Log the first few files to see their structure
    files.slice(0, 3).forEach((file, i) => {
      console.log(`🗂️ HOOK: File ${i}:`, {
        name: file.name,
        webkitRelativePath: file.webkitRelativePath,
        type: file.type
      });
    });

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    try {
      // Build the array { file, relativePath } - simple and clean
      const fileDataArray = files.map((file) => ({
        file,
        // Use webkitRelativePath (supported when input has webkitdirectory)
        relativePath: file.webkitRelativePath || file.name
      }));

      console.log('🗂️ HOOK: First 3 processed files:', fileDataArray.slice(0, 3));
      console.log('🗂️ HOOK: About to call api.uploadBatch...');

      // Call the batch endpoint
      const result = await api.uploadBatch(fileDataArray, currentFolder?._id);
      console.log('🗂️ HOOK: Batch upload result:', result);

    } catch (error) {
      console.error('🗂️ HOOK: Batch upload failed:', error);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(null);
      triggerRefresh();
    }
  }, [currentFolder, triggerRefresh]);

  /* ── 6. Utility functions for better UX */
  const resetSearch = useCallback(() => {
    setSearch(null);
  }, []);

  const switchToFolder = useCallback((folder) => {
    setView('folders');
    setCurrentFolder(folder);
    setSearch(null);
  }, []);

  const refreshData = useCallback(() => {
    setFolderRefresh(p => p + 1);
    triggerRefresh();
  }, [triggerRefresh]);

  /* ──────────────────────────────────────────────── */
  /*  Return everything the page / panes need        */
  /* ──────────────────────────────────────────────── */
  return {
    /* editor stuff */
    currentDoc, 
    setCurrentDoc,
    isDraw,     
    setIsDraw,
    undoRef,    
    saveRef,
    openFile,   
    saveFile,

    /* tree + list stuff */
    view, 
    setView,
    root, 
    files,
    currentFolder, 
    setCurrentFolder,

    /* search + status view */
    search, 
    setSearch,
    uploading,
    uploadProgress, // New: progress tracking

    /* folder actions */
    createFolder, 
    updateFolder, 
    deleteFolder,

    /* upload handlers */
    handleFiles,
    onFolderUpload: handleFolderUpload, // Rename to match FileNavigator prop expectation

    /* refresh flags */
    refreshTrigger: refresh,   // for StatusTabs & FileNavigator
    triggerRefresh,            // call after any mutation

    /* utility functions */
    resetSearch,
    switchToFolder,
    refreshData,
  };
}