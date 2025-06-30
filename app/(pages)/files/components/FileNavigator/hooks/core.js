// app/(pages)/files/components/FileNavigator/hooks/core.js - SEARCH FIX

'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api, hasError, extractData, extractList, getError } from '@/app/apiClient'; // Using your standardized API client

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

  /* ── STATUS TAB QUERIES ─────────────────────────────────────── */
  const statuses = ['In Progress', 'Review'];
  const statusQueries = useQueries({
    queries: statuses.map(status => ({
      queryKey: ['filesByStatus', status, refreshTrigger],
      queryFn: async () => {
        try {
          console.log(`🔍 Loading ${status} batches...`);
          const result = await api.list.batchesByStatus(status);
          
          if (hasError(result)) {
            console.error(`❌ Error loading ${status} batches:`, getError(result));
            return [];
          }
          
          const batches = extractList(result, 'batches', []);
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
          console.error(`💥 Failed to load ${status} batches:`, error);
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

  /* ── ARCHIVE TAB QUERY ──────────────────────────────────────── */
  const {
    data: archivedBatches = [],
    isFetching: archiveLoading,
    error: archiveError
  } = useQuery({
    queryKey: ['archivedBatches', refreshTrigger],
    queryFn: async () => {
      try {
        console.log('🔍 Loading archived batches...');
        const result = await api.list.batchesByStatus('Completed');
        
        if (hasError(result)) {
          console.error('❌ Error loading archived batches:', getError(result));
          return [];
        }
        
        const batches = extractList(result, 'batches', []);
        console.log('📦 Archive batches extracted:', batches.length);
        
        return batches.map(batch => ({
          ...batch,
          fileName: batch.fileName || 
                   `Batch Run ${batch.runNumber}` ||
                   'Archived File',
          isArchived: true
        }));
      } catch (error) {
        console.error('💥 Failed to load archived batches:', error);
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

  /* ── SEARCH OPERATIONS - FIXED FOR FILES TAB ───────────────── */
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
        // FIXED: For Files tab, use dedicated searchFiles API to only get original files
        console.log('📄 Searching original files only...');
        
        const result = await api.list.searchFiles(query);
        
        console.log('🔍 Files search result:', result);
        
        if (hasError(result)) {
          console.error('❌ Search error:', getError(result));
          setSearchResults([]);
          return;
        }
        
        // Extract files array using the helper function
        const files = extractList(result, 'files', []);
        
        console.log('📄 Search files extracted:', files.length);
        
        // Additional filtering to ensure only original files (not batches)
        const originalFilesOnly = files.filter(file => {
          const isOriginalFile = !file.isBatch && 
                                !file.runNumber && 
                                !file.status && 
                                !file.sourceType && 
                                !file.batchId &&
                                file.fileName; // Must have a fileName
          return isOriginalFile;
        });
        
        console.log('✅ Filtered to original files only:', originalFilesOnly.length, 'out of', files.length);
        setSearchResults(originalFilesOnly);
        
      } else if (view === 'status') {
        // For Status tab, search within batches of specific statuses
        console.log('📊 Searching status batches...');
        
        const result = await api.list.searchFiles(query);
        
        if (hasError(result)) {
          console.error('❌ Search error:', getError(result));
          setSearchResults([]);
          return;
        }
        
        const allResults = extractList(result, 'files', []);
        
        // Filter to only batches with In Progress or Review status
        const statusBatches = allResults.filter(file => 
          file.status && ['In Progress', 'Review'].includes(file.status)
        );
        
        // Ensure all search results have proper fileName for display
        const enrichedResults = statusBatches.map(file => ({
          ...file,
          fileName: file.fileName || 
                   (file.fileId?.fileName ? `${file.fileId.fileName.replace('.pdf', '')}-Run-${file.runNumber}.pdf` : null) ||
                   `Batch Run ${file.runNumber}` ||
                   'Untitled'
        }));
        
        console.log('✅ Status search completed:', enrichedResults.length, 'results');
        setSearchResults(enrichedResults);
        
      } else if (view === 'archive') {
        // For Archive tab, search within completed batches
        console.log('📚 Searching archive batches...');
        
        const result = await api.list.searchFiles(query);
        
        if (hasError(result)) {
          console.error('❌ Search error:', getError(result));
          setSearchResults([]);
          return;
        }
        
        const allResults = extractList(result, 'files', []);
        
        // Filter to only completed/archived batches
        const archivedBatches = allResults.filter(file => 
          file.status === 'Completed' || file.isArchived
        );
        
        // Ensure all search results have proper fileName for display
        const enrichedResults = archivedBatches.map(file => ({
          ...file,
          fileName: file.fileName || 
                   `Batch Run ${file.runNumber}` ||
                   'Archived File'
        }));
        
        console.log('✅ Archive search completed:', enrichedResults.length, 'results');
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
      const result = await api.update.batchStatus(fileId, status);
      if (hasError(result)) {
        throw new Error(getError(result));
      }
    } catch (error) {
      console.error('Failed to update file status:', error);
    }
  }, []);

  /* ── FOLDER TREE OPERATIONS ─────────────────────────────────── */
  const loadFolderChildren = useCallback(async (folderId) => {
    try {
      console.log('🔍 Loading children for folder:', folderId);
      
      // Load both subfolders and files for this folder
      const [foldersResult, filesResult] = await Promise.all([
        api.list.folders(folderId),
        api.list.files(folderId)
      ]);
      
      console.log('📁 Folder children result:', { foldersResult, filesResult });
      
      // Handle folders result
      let folders = [];
      if (hasError(foldersResult)) {
        console.error('❌ Error loading subfolders:', getError(foldersResult));
      } else {
        folders = extractList(foldersResult, 'folders', []);
      }
      
      // Handle files result - Filter to only original files
      let files = [];
      if (hasError(filesResult)) {
        console.error('❌ Error loading folder files:', getError(filesResult));
      } else {
        const allFiles = extractList(filesResult, 'files', []);
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
    // Clear search when navigating
    clearSearch();
  }, [setCurrentFolder, setSearch, clearSearch]);

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

  // Handle search query changes with debouncing
  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedSearch(searchQuery);
    } else {
      setSearchResults(null);
    }
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