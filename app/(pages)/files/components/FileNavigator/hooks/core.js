// app/(pages)/files/components/FileNavigator/hooks/core.js - FINAL FIX

'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { filesApi, hasApiError, extractApiData, handleApiError } from '../../../lib/api';

export function useCore(props) {
  const {
    view,
    setView,
    root,
    files,
    currentFolder,
    setCurrentFolder,
    search,
    setSearch,
    uploading,
    createFolder,
    updateFolder,
    deleteFolder,
    handleFiles,
    onFolderUpload,
    openFile,
    closeDrawer,
    refreshTrigger,
    error,
    dataLoading
  } = props;

  console.log('🔧 useCore props received:', {
    view,
    rootType: typeof root,
    rootLength: Array.isArray(root) ? root.length : 'not array',
    filesType: typeof files,
    filesLength: Array.isArray(files) ? files.length : 'not array',
    currentFolder: currentFolder?.name || 'none',
    hasError: !!error,
    dataLoading
  });

  /* ── CORE STATE ─────────────────────────────────────────────── */
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [order, setOrder] = useState('newest');
  const [currentArchiveFolder, setCurrentArchiveFolder] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  /* ── REFS ───────────────────────────────────────────────────── */
  const searchTimerRef = useRef(null);
  const blurTimerRef = useRef(null);

  /* ── STATUS TAB QUERIES - FINAL FIX ─────────────────────────── */
  const statuses = ['In Progress', 'Review'];
  const statusQueries = useQueries({
    queries: statuses.map(status => ({
      queryKey: ['filesByStatus', status, refreshTrigger],
      queryFn: async () => {
        try {
          console.log(`🔍 Loading ${status} files...`);
          const result = await filesApi.workflow.getFilesByStatus(status);
          
          console.log(`📊 ${status} files result:`, result);
          
          // FINAL FIX: Handle the new API response format properly
          if (hasApiError(result)) {
            console.error(`❌ Error loading ${status} files:`, handleApiError(result));
            return [];
          }
          
          // Extract the full data object first, then get the batches array
          const fullData = extractApiData(result, { batches: [] });
          const batches = fullData.batches || [];
          
          console.log(`📦 ${status} batches extracted:`, batches.length);
          
          // Transform batches to have proper fileName for display
          return batches.map(batch => ({
            ...batch,
            fileName: batch.fileName || 
                     (batch.fileId?.fileName ? `${batch.fileId.fileName.replace('.pdf', '')}-Run-${batch.runNumber}.pdf` : null) ||
                     `Batch Run ${batch.runNumber}` ||
                     'Untitled'
          }));
        } catch (error) {
          console.error(`💥 Failed to load ${status} files:`, error);
          return [];
        }
      },
      staleTime: 30_000,
      retry: 2,
      retryDelay: 1000
    }))
  });

  const statusTabData = {
    loading: {
      inProgress: statusQueries[0].isFetching,
      review: statusQueries[1].isFetching
    },
    error: {
      inProgress: statusQueries[0].error,
      review: statusQueries[1].error
    },
    files: {
      inProgress: statusQueries[0].data || [],
      review: statusQueries[1].data || []
    }
  };

  /* ── ARCHIVE TAB QUERY - FINAL FIX ──────────────────────────── */
  const {
    data: archivedBatches = [],
    isFetching: archiveLoading,
    error: archiveError
  } = useQuery({
    queryKey: ['archivedBatches', refreshTrigger],
    queryFn: async () => {
      try {
        console.log('🔍 Loading archived files...');
        const result = await filesApi.workflow.getFilesByStatus('Completed');
        console.log('📚 Archive files result:', result);
        
        // FINAL FIX: Handle the new API response format properly
        if (hasApiError(result)) {
          console.error('❌ Error loading archived files:', handleApiError(result));
          return [];
        }
        
        // Extract the full data object first, then get the batches array
        const fullData = extractApiData(result, { batches: [] });
        const batches = fullData.batches || [];
        
        console.log('📦 Archive batches extracted:', batches.length);
        
        return batches.map(batch => ({
          ...batch,
          fileName: batch.fileName || 
                   `Batch Run ${batch.runNumber}` ||
                   'Archived File',
          isArchived: true
        }));
      } catch (error) {
        console.error('💥 Failed to load archived files:', error);
        return [];
      }
    },
    staleTime: 30_000,
    retry: 2,
    retryDelay: 1000
  });

  /* ── ARCHIVE FOLDER STRUCTURE ──────────────────────────────── */
  const archiveStructure = useMemo(() => {
    if (!archivedBatches.length) {
      return { folders: [], rootFiles: [] };
    }

    const folderMap = new Map();
    const rootFiles = [];

    archivedBatches.forEach(batch => {
      const createdDate = new Date(batch.createdAt);
      const monthYear = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      const path = `Completed ${monthYear}`;
      
      if (!folderMap.has(path)) {
        folderMap.set(path, {
          _id: `archive-${path.replace(/\s/g, '-')}`,
          name: `Completed ${monthYear}`,
          fullPath: path,
          parentPath: null,
          children: [],
          files: [],
          isArchiveFolder: true
        });
      }
      
      folderMap.get(path).files.push(batch);
    });

    const folders = Array.from(folderMap.values());
    return { folders, rootFiles: [] };
  }, [archivedBatches]);

  /* ── COMPUTED VALUES ────────────────────────────────────────── */
  const currentArchiveFiles = useMemo(() => {
    if (!currentArchiveFolder) {
      return archiveStructure.rootFiles;
    }
    return currentArchiveFolder.files || [];
  }, [currentArchiveFolder, archiveStructure.rootFiles]);

  const currentArchiveFolders = useMemo(() => {
    if (!currentArchiveFolder) {
      return archiveStructure.folders;
    }
    return currentArchiveFolder.children || [];
  }, [currentArchiveFolder, archiveStructure.folders]);

  /* ── SEARCH OPERATIONS - FINAL FIX ──────────────────────────── */
  const performSearch = useCallback(async (query) => {
    if (!query?.trim()) {
      setSearchResults(null);
      return;
    }

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchBusy(true);
    try {
      console.log('🔍 Performing search for:', query, 'in view:', view);
      
      if (view === 'folders') {
        // FINAL FIX: For Files tab, search original files using the standardized API
        console.log('📄 Searching original files only...');
        
        const result = await filesApi.files.search(query);
        
        console.log('🔍 Files API search result:', result);
        
        // FINAL FIX: Handle the new API response format properly
        if (hasApiError(result)) {
          console.error('❌ Search error:', handleApiError(result));
          setSearchResults([]);
          return;
        }
        
        // Extract the full data object first, then get the files array
        const fullData = extractApiData(result, { files: [] });
        const files = fullData.files || [];
        
        console.log('📄 Search files extracted:', files.length);
        
        // Filter to ensure only original files (no batches)
        const originalFilesOnly = files.filter(file => {
          const isOriginalFile = !file.isBatch && 
                                !file.runNumber && 
                                !file.status && 
                                !file.sourceType && 
                                !file.batchId;
          return isOriginalFile;
        });
        
        console.log('✅ Filtered to original files only:', originalFilesOnly.length, 'out of', files.length);
        setSearchResults(originalFilesOnly);
        
      } else {
        // For Status and Archive tabs, search batches
        const result = await filesApi.files.search(query);
        
        console.log('🔍 Search result:', result);
        
        // FINAL FIX: Handle the new API response format properly
        if (hasApiError(result)) {
          console.error('❌ Search error:', handleApiError(result));
          setSearchResults([]);
          return;
        }
        
        // Extract the full data object first, then get the files array
        const fullData = extractApiData(result, { files: [] });
        const allResults = fullData.files || [];
        
        // Ensure all search results have proper fileName for display
        const enrichedResults = allResults.map(file => ({
          ...file,
          fileName: file.fileName || 
                   (file.fileId?.fileName ? `${file.fileId.fileName.replace('.pdf', '')}-Run-${file.runNumber}.pdf` : null) ||
                   `Batch Run ${file.runNumber}` ||
                   'Untitled'
        }));
        
        console.log('✅ Search completed:', enrichedResults.length, 'results');
        setSearchResults(enrichedResults);
      }
      
    } catch (error) {
      console.error('💥 Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, [view]);

  const debouncedSearch = useCallback((query) => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  }, [performSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
    setSearch?.(null);
  }, [setSearch]);

  /* ── DRAG AND DROP HANDLERS ─────────────────────────────────── */
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  }, [dragCounter]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      const pdfFiles = droppedFiles.filter(file => file.type === 'application/pdf');
      if (pdfFiles.length > 0) {
        const hasStructure = pdfFiles.some(file => 
          file.webkitRelativePath && file.webkitRelativePath.includes('/')
        );
        
        if (hasStructure && onFolderUpload) {
          onFolderUpload(pdfFiles);
        } else {
          handleFiles(pdfFiles);
        }
      }
    }
  }, [onFolderUpload, handleFiles]);

  /* ── SORTING HELPERS ────────────────────────────────────────── */
  const sortList = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    const sorted = [...arr];
    
    if (order === 'name') {
      return sorted.sort((x, y) => (x.fileName || x.name || '').localeCompare(y.fileName || y.name || ''));
    }
    
    const getTimestamp = (file) => {
      return new Date(file.archivedAt || file.updatedAt || file.createdAt).getTime();
    };
    
    return sorted.sort((x, y) => 
      order === 'newest' ? getTimestamp(y) - getTimestamp(x) : getTimestamp(x) - getTimestamp(y)
    );
  }, [order]);

  /* ── FILE STATUS OPERATIONS ─────────────────────────────────── */
  const changeFileStatus = useCallback(async (fileId, status) => {
    try {
      const result = await filesApi.batches.updateStatus(fileId, status);
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }
    } catch (error) {
      console.error('Failed to update file status:', error);
    }
  }, []);

  /* ── FOLDER TREE OPERATIONS - FINAL FIX ─────────────────────── */
  const loadFolderChildren = useCallback(async (folderId) => {
    try {
      console.log('🔍 Loading children for folder:', folderId);
      
      // Load both subfolders and files for this folder
      const [foldersResult, filesResult] = await Promise.all([
        filesApi.folders.list(folderId),
        filesApi.files.list(folderId)
      ]);
      
      console.log('📁 Folder children result:', { foldersResult, filesResult });
      
      // FINAL FIX: Handle folders result with new API format
      let folders = [];
      if (hasApiError(foldersResult)) {
        console.error('❌ Error loading subfolders:', handleApiError(foldersResult));
      } else {
        const fullData = extractApiData(foldersResult, { folders: [] });
        folders = fullData.folders || [];
      }
      
      // FINAL FIX: Handle files result with new API format - Filter to only original files
      let files = [];
      if (hasApiError(filesResult)) {
        console.error('❌ Error loading folder files:', handleApiError(filesResult));
      } else {
        const fullData = extractApiData(filesResult, { files: [] });
        const allFiles = fullData.files || [];
        // Filter to only include original files (not batches)
        files = allFiles.filter(file => !file.isBatch && !file.runNumber && !file.status);
      }
      
      return {
        folders,
        files
      };
    } catch (error) {
      console.error('Failed to load folder children:', error);
      return { folders: [], files: [] };
    }
  }, []);

  /* ── NAVIGATION HELPERS ─────────────────────────────────────── */
  const navigateToFolder = useCallback((folder) => {
    console.log('🧭 Navigating to folder:', folder?.name || 'root');
    setCurrentFolder(folder);
    setSearch?.(null);
  }, [setCurrentFolder, setSearch]);

  const navigateToArchiveFolder = useCallback((folder) => {
    setCurrentArchiveFolder(folder);
  }, []);

  const openFileAndClose = useCallback((file) => {
    console.log('🔍 Opening file and closing drawer:', file);
    openFile(file);
    closeDrawer?.();
  }, [openFile, closeDrawer]);

  /* ── EFFECTS ────────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      clearTimeout(searchTimerRef.current);
      clearTimeout(blurTimerRef.current);
    };
  }, []);

  // Handle search query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  // Update external search state when internal search results change
  useEffect(() => {
    if (setSearch) {
      setSearch(searchResults);
    }
  }, [searchResults, setSearch]);

  /* ── RETURN DATA STATE ──────────────────────────────────────── */
  console.log('🔧 useCore returning data:', {
    isDragOver,
    order,
    searchQuery,
    searchBusy,
    searchResultsCount: searchResults?.length || 0,
    statusFilesInProgress: statusTabData.files.inProgress?.length || 0,
    statusFilesReview: statusTabData.files.review?.length || 0,
    archiveFilesCount: currentArchiveFiles?.length || 0,
    archiveFoldersCount: currentArchiveFolders?.length || 0,
    view: view
  });
  
  return {
    // Core state
    isDragOver,
    dragCounter,
    order,
    currentArchiveFolder,
    searchQuery,
    searchBusy,
    searchResults,

    // Status tab data
    statusTabData,

    // Archive data
    archiveLoading,
    archiveError,
    archivedBatches,
    currentArchiveFiles,
    currentArchiveFolders,

    // Computed
    sortedStatusFiles: {
      inProgress: sortList(statusTabData.files.inProgress),
      review: sortList(statusTabData.files.review)
    },
    sortedArchiveFiles: sortList(currentArchiveFiles),
    sortedArchiveFolders: sortList(currentArchiveFolders),

    // Operations
    setOrder,
    setSearchQuery,
    clearSearch,
    performSearch,
    changeFileStatus,
    loadFolderChildren,
    navigateToFolder,
    navigateToArchiveFolder,
    openFileAndClose,

    // Drag and drop
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,

    // External operations (passed through)
    createFolder,
    updateFolder,
    deleteFolder,
    handleFiles,
    onFolderUpload
  };
}