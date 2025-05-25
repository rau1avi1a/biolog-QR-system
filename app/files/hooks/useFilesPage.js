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

  /* helper to open/load a file */
  const openFile = useCallback(async (file) => {
    try {
      if (file.originalFileId) {
        // This is a batch file, load it via batch API
        const { batch } = await api.getBatch(file._id);
        if (batch) {
          setCurrentDoc({ 
            ...batch, 
            pdf: batch.pdf,
            isBatch: true,
            originalFileId: batch.fileId
          });
        } else {
          console.error('Batch not found or empty response');
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
          console.error('File not found or empty response');
        }
      }
    } catch (error) {
      console.error('Failed to load file:', error);
    }
  }, []);

  /* NEW: Save function that handles both original and batch files */
  const saveFile = useCallback(async (editorData) => {
    if (!currentDoc) return;

    try {
      if (currentDoc.isBatch) {
        // Update existing batch
        await api.updateBatch(currentDoc._id, {
          overlayPng: editorData.overlayPng,
          annotations: editorData.annotations,
          // Add other editor data as needed
        });
      } else {
        // Create new batch from original file
        const { batch } = await api.saveBatchFromEditor(currentDoc._id, editorData);
        
        // Switch to the newly created batch
        setCurrentDoc({
          ...batch,
          pdf: currentDoc.pdf, // Keep the same PDF data
          isBatch: true,
          originalFileId: batch.fileId
        });
      }
      
      triggerRefresh(); // Refresh the UI
    } catch (error) {
      console.error('Failed to save file:', error);
      throw error;
    }
  }, [currentDoc]);

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

  /*  global refresh flag (any data change)  */
  const [refresh, setRefresh] = useState(0);
  const triggerRefresh = () => setRefresh((p) => p + 1);

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
    openFile,   saveFile,  // NEW: expose saveFile

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