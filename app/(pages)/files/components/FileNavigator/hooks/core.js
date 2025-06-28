// app/files/components/FileNavigator/hooks/core.js - FIXED: Proper React imports
'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'; // ✅ FIXED: All React imports
import { useQueries, useQuery } from '@tanstack/react-query';
import { filesApi } from '../../../lib/api';

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
          console.log(`🔍 Loading ${status} files...`);
          // Use the correct API method for getting files by status
          const result = await filesApi.workflow.getFilesByStatus(status);
          console.log(`📊 ${status} files result:`, result);
          
          // Handle different response formats
          let data = [];
          if (result.data && Array.isArray(result.data)) {
            data = result.data;
          } else if (Array.isArray(result)) {
            data = result;
          } else if (result.error) {
            console.error(`❌ Error loading ${status} files:`, result.error);
            return [];
          }
          
          // Ensure each file has a displayable fileName
          return data.map(file => ({
            ...file,
            fileName: file.fileName || 
                     (file.fileId?.fileName ? `${file.fileId.fileName.replace('.pdf', '')}-Run-${file.runNumber}.pdf` : null) ||
                     `Batch Run ${file.runNumber}` ||
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

  /* ── ARCHIVE TAB QUERY ──────────────────────────────────────── */
  const {
    data: archivedBatches = [],
    isFetching: archiveLoading,
    error: archiveError
  } = useQuery({
    queryKey: ['archivedBatches', refreshTrigger],
    queryFn: async () => {
      try {
        console.log('🔍 Loading archived files...');
        // Use the correct API method for archived files
        const result = await filesApi.archive.listFiles();
        console.log('📚 Archive files result:', result);
        
        let data = [];
        if (result.data && Array.isArray(result.data)) {
          data = result.data;
        } else if (Array.isArray(result)) {
          data = result;
        } else if (result.error) {
          console.error('❌ Error loading archived files:', result.error);
          return [];
        }
        
        // Ensure each archived file has a displayable fileName
        return data.map(file => ({
          ...file,
          fileName: file.fileName || 
                   `Batch Run ${file.runNumber}` ||
                   'Archived File'
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
      const path = batch.folderPath || 'Root';
      
      if (path === 'Root') {
        rootFiles.push(batch);
      } else {
        const pathParts = path.split(' / ');
        let currentPath = '';
        
        pathParts.forEach((part, index) => {
          const isLast = index === pathParts.length - 1;
          currentPath = currentPath ? `${currentPath} / ${part}` : part;
          
          if (!folderMap.has(currentPath)) {
            folderMap.set(currentPath, {
              _id: `archive-${currentPath.replace(/[\s\/]/g, '-')}`,
              name: part,
              fullPath: currentPath,
              parentPath: index > 0 ? pathParts.slice(0, index).join(' / ') : null,
              children: [],
              files: [],
              isArchiveFolder: true
            });
          }
          
          if (isLast) {
            folderMap.get(currentPath).files.push(batch);
          }
        });
      }
    });

    const folders = Array.from(folderMap.values());
    const rootFolders = [];

    folders.forEach(folder => {
      if (!folder.parentPath) {
        rootFolders.push(folder);
      } else {
        const parent = folderMap.get(folder.parentPath);
        if (parent) {
          parent.children.push(folder);
        }
      }
    });

    return { folders: rootFolders, rootFiles };
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

  /* ── SEARCH OPERATIONS ──────────────────────────────────────── */
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
      console.log('🔍 Performing search for:', query);
      // Use the correct API method for searching files
      const result = await filesApi.files.search(query.trim());
      console.log('🔍 Search result:', result);
      
      let searchData = [];
      if (result.data && Array.isArray(result.data)) {
        searchData = result.data;
      } else if (Array.isArray(result)) {
        searchData = result;
      } else if (result.error) {
        console.error('❌ Search error:', result.error);
        searchData = [];
      }
      
      // Ensure each search result has a displayable fileName
      const enrichedResults = searchData.map(file => ({
        ...file,
        fileName: file.fileName || 
                 (file.fileId?.fileName ? `${file.fileId.fileName.replace('.pdf', '')}-Run-${file.runNumber}.pdf` : null) ||
                 `Batch Run ${file.runNumber}` ||
                 'Untitled'
      }));
      
      setSearchResults(enrichedResults);
    } catch (error) {
      console.error('💥 Search failed:', error);
      setSearchResults([]);
    } finally {
      setSearchBusy(false);
    }
  }, []);

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
      // Use the correct API method for updating batch status
      await filesApi.batches.updateStatus(fileId, status);
      // Trigger refresh of status tabs will be handled by query invalidation
    } catch (error) {
      console.error('Failed to update file status:', error);
    }
  }, []);

  /* ── FOLDER TREE OPERATIONS ─────────────────────────────────── */
  const loadFolderChildren = useCallback(async (folderId) => {
    try {
      const [foldersResult, filesResult] = await Promise.all([
        filesApi.folders.list(folderId),
        filesApi.files.list(folderId)
      ]);
      
      return {
        folders: foldersResult.data || [],
        files: filesResult.data || []
      };
    } catch (error) {
      console.error('Failed to load folder children:', error);
      return { folders: [], files: [] };
    }
  }, []);

  /* ── NAVIGATION HELPERS ─────────────────────────────────────── */
  const navigateToFolder = useCallback((folder) => {
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
    archiveFoldersCount: currentArchiveFolders?.length || 0
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