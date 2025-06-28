// app/files/components/FileNavigator/hooks/state.js - Fixed UI Logic/Event Handlers
'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useComponentState(core, props) {
  const router = useRouter();
  const { view, mobileModeActive } = props;

  /* ── UI-ONLY STATE ──────────────────────────────────────────── */
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showEditFolderDialog, setShowEditFolderDialog] = useState(false);
  const [showDeleteFolderDialog, setShowDeleteFolderDialog] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [editFolderName, setEditFolderName] = useState('');
  const [searchInputValue, setSearchInputValue] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  /* ── REFS ───────────────────────────────────────────────────── */
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  /* ── EVENT HANDLERS ─────────────────────────────────────────── */
  const handleHomeClick = useCallback(() => {
    router.push('/home');
  }, [router]);

  const handleViewChange = useCallback((newView) => {
    if (typeof props.setView === 'function') {
      props.setView(newView);
    } else {
      console.warn('props.setView is not a function');
    }
    
    if (core && typeof core.clearSearch === 'function') {
      core.clearSearch();
    }
  }, [props, core]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    
    try {
      if (core && typeof core.createFolder === 'function') {
        await core.createFolder(newFolderName.trim());
        setNewFolderName('');
        setShowCreateFolderDialog(false);
      } else {
        console.warn('core.createFolder is not available');
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
      // TODO: Show toast notification
    }
  }, [newFolderName, core]);

  const handleEditFolder = useCallback(async () => {
    if (!selectedFolder || !editFolderName.trim()) return;
    
    try {
      if (core && typeof core.updateFolder === 'function') {
        await core.updateFolder(selectedFolder._id, editFolderName.trim());
        setEditFolderName('');
        setSelectedFolder(null);
        setShowEditFolderDialog(false);
      } else {
        console.warn('core.updateFolder is not available');
      }
    } catch (error) {
      console.error('Failed to update folder:', error);
      // TODO: Show toast notification
    }
  }, [selectedFolder, editFolderName, core]);

  const handleDeleteFolder = useCallback(async () => {
    if (!selectedFolder) return;
    
    try {
      if (core && typeof core.deleteFolder === 'function') {
        await core.deleteFolder(selectedFolder._id);
        setSelectedFolder(null);
        setShowDeleteFolderDialog(false);
      } else {
        console.warn('core.deleteFolder is not available');
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
      // TODO: Show toast notification
    }
  }, [selectedFolder, core]);

  const handleFileUpload = useCallback((files) => {
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    if (pdfFiles.length > 0) {
      const hasStructure = pdfFiles.some(file => 
        file.webkitRelativePath && file.webkitRelativePath.includes('/')
      );
      
      if (hasStructure && core && typeof core.onFolderUpload === 'function') {
        core.onFolderUpload(pdfFiles);
      } else if (core && typeof core.handleFiles === 'function') {
        core.handleFiles(pdfFiles);
      } else {
        console.warn('No file upload handler available');
      }
    }
  }, [core]);

  const handleSearchSubmit = useCallback((e) => {
    e.preventDefault();
    if (core && typeof core.performSearch === 'function') {
      core.performSearch(searchInputValue);
    }
    setSearchDropdownOpen(false);
  }, [searchInputValue, core]);

  const handleSearchClear = useCallback(() => {
    setSearchInputValue('');
    if (core && typeof core.clearSearch === 'function') {
      core.clearSearch();
    }
    setSearchDropdownOpen(false);
  }, [core]);

  const handleSearchFocus = useCallback(() => {
    setSearchDropdownOpen(true);
  }, []);

  const handleSearchBlur = useCallback(() => {
    // Delay closing to allow for clicks
    setTimeout(() => setSearchDropdownOpen(false), 150);
  }, []);

  /* ── FOLDER DIALOG HANDLERS ─────────────────────────────────── */
  const openCreateFolderDialog = useCallback(() => {
    setNewFolderName('');
    setShowCreateFolderDialog(true);
  }, []);

  const openEditFolderDialog = useCallback((folder) => {
    setSelectedFolder(folder);
    setEditFolderName(folder?.name || '');
    setShowEditFolderDialog(true);
  }, []);

  const openDeleteFolderDialog = useCallback((folder) => {
    setSelectedFolder(folder);
    setShowDeleteFolderDialog(true);
  }, []);

  const closeAllDialogs = useCallback(() => {
    setShowCreateFolderDialog(false);
    setShowEditFolderDialog(false);
    setShowDeleteFolderDialog(false);
    setSelectedFolder(null);
    setNewFolderName('');
    setEditFolderName('');
  }, []);

  /* ── CONDITIONAL RENDERING LOGIC ────────────────────────────── */
  const getFileIcon = useCallback((file) => {
    const iconMap = {
      'In Progress': { name: 'Clock', className: 'text-amber-500' },
      'Review': { name: 'CircleDot', className: 'text-blue-500' },
      'Completed': { name: 'CheckCircle2', className: 'text-green-500' }
    };
    return iconMap[file?.status] || { name: 'FileIcon', className: 'text-slate-500' };
  }, []);

  const getFileBadgeClass = useCallback((status) => {
    const badgeMap = {
      'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
      'Review': 'bg-blue-100 text-blue-800 border-blue-200',
      'Completed': 'bg-green-100 text-green-800 border-green-200'
    };
    return badgeMap[status] || 'bg-slate-100 text-slate-800 border-slate-200';
  }, []);

  const getTabButtonClass = useCallback((tabView) => {
    const isActive = view === tabView;
    const baseClass = "flex items-center gap-2 transition-all";
    
    if (isActive) {
      return `${baseClass} bg-black dark:bg-slate-700 shadow-sm`;
    }
    return `${baseClass} hover:bg-white/60 dark:hover:bg-slate-700/60`;
  }, [view]);

  const getSortButtonText = useCallback(() => {
    const orderMap = {
      'newest': 'Newest',
      'oldest': 'Oldest',
      'name': 'Name'
    };
    return orderMap[core?.order] || 'Sort';
  }, [core?.order]);

  /* ── COMPUTED UI PROPS ──────────────────────────────────────── */
  const breadcrumbItems = useMemo(() => {
    const items = [{ 
      name: 'Root', 
      onClick: () => {
        if (core && typeof core.navigateToFolder === 'function') {
          core.navigateToFolder(null);
        }
      }
    }];
    
    if (props.currentFolder) {
      items.push({
        name: props.currentFolder.name,
        onClick: () => {
          if (core && typeof core.navigateToFolder === 'function') {
            core.navigateToFolder(props.currentFolder);
          }
        }
      });
    }
    
    return items;
  }, [props.currentFolder, core]);

  const archiveBreadcrumbItems = useMemo(() => {
    const items = [{ 
      name: 'Archive', 
      onClick: () => {
        if (core && typeof core.navigateToArchiveFolder === 'function') {
          core.navigateToArchiveFolder(null);
        }
      }
    }];
    
    if (core?.currentArchiveFolder) {
      items.push({
        name: core.currentArchiveFolder.name,
        onClick: () => {
          if (core && typeof core.navigateToArchiveFolder === 'function') {
            core.navigateToArchiveFolder(core.currentArchiveFolder);
          }
        }
      });
    }
    
    return items;
  }, [core?.currentArchiveFolder, core]);

  const searchDropdownProps = useMemo(() => ({
    open: searchDropdownOpen && searchInputValue.length >= 2,
    results: core?.searchResults || [],
    loading: core?.searchBusy || false,
    onSelectResult: (file) => {
      if (core && typeof core.openFileAndClose === 'function') {
        core.openFileAndClose(file);
      }
      setSearchDropdownOpen(false);
    }
  }), [searchDropdownOpen, searchInputValue, core?.searchResults, core?.searchBusy, core]);

  const dragOverlayProps = useMemo(() => ({
    show: core?.isDragOver || false,
    title: 'Drop PDF files here',
    subtitle: 'Folder structure will be preserved automatically'
  }), [core?.isDragOver]);

  const uploadButtonProps = useMemo(() => ({
    onFilesUpload: core?.handleFiles || (() => {}),
    onFolderUpload: core?.onFolderUpload || (() => {}),
    disabled: props.uploading
  }), [core?.handleFiles, core?.onFolderUpload, props.uploading]);

  const statusTabProps = useMemo(() => ({
    inProgress: {
      files: core?.sortedStatusFiles?.inProgress || [],
      loading: core?.statusTabData?.loading?.inProgress || false,
      error: core?.statusTabData?.error?.inProgress || null
    },
    review: {
      files: core?.sortedStatusFiles?.review || [],
      loading: core?.statusTabData?.loading?.review || false,
      error: core?.statusTabData?.error?.review || null
    },
    onFileClick: core?.openFileAndClose || (() => {}),
    onStatusChange: core?.changeFileStatus || (() => {}),
    order: core?.order || 'newest',
    onOrderChange: core?.setOrder || (() => {})
  }), [core]);

  const archiveTabProps = useMemo(() => ({
    folders: core?.sortedArchiveFolders || [],
    files: core?.sortedArchiveFiles || [],
    loading: core?.archiveLoading || false,
    error: core?.archiveError || null,
    currentFolder: core?.currentArchiveFolder || null,
    onFolderClick: core?.navigateToArchiveFolder || (() => {}),
    onFileClick: core?.openFileAndClose || (() => {}),
    onBackClick: () => {
      if (core && typeof core.navigateToArchiveFolder === 'function') {
        core.navigateToArchiveFolder(null);
      }
    },
    order: core?.order || 'newest',
    onOrderChange: core?.setOrder || (() => {})
  }), [core]);

  const foldersTabProps = useMemo(() => ({
    folders: props.root || [],
    files: props.files || [],
    currentFolder: props.currentFolder,
    search: props.search,
    uploading: props.uploading,
    onFolderSelect: core?.navigateToFolder || (() => {}),
    onFileSelect: core?.openFileAndClose || (() => {}),
    onCreateFolder: openCreateFolderDialog,
    onEditFolder: openEditFolderDialog,
    onDeleteFolder: openDeleteFolderDialog,
    onSearch: (query) => {
      setSearchInputValue(query);
      if (core && typeof core.setSearchQuery === 'function') {
        core.setSearchQuery(query);
      }
    },
    onClearSearch: () => {
      setSearchInputValue('');
      if (core && typeof core.clearSearch === 'function') {
        core.clearSearch();
      }
    },
    onFilesUpload: handleFileUpload,
    dragAndDropProps: {
      onDragEnter: core?.handleDragEnter || (() => {}),
      onDragLeave: core?.handleDragLeave || (() => {}),
      onDragOver: core?.handleDragOver || (() => {}),
      onDrop: core?.handleDrop || (() => {})
    }
  }), [props, core, handleFileUpload, openCreateFolderDialog, openEditFolderDialog, openDeleteFolderDialog]);

  /* ── DIALOG PROPS ───────────────────────────────────────────── */
  const createFolderDialogProps = useMemo(() => ({
    open: showCreateFolderDialog,
    onOpenChange: setShowCreateFolderDialog,
    folderName: newFolderName,
    onFolderNameChange: setNewFolderName,
    onConfirm: handleCreateFolder,
    onCancel: closeAllDialogs,
    parentFolder: props.currentFolder
  }), [showCreateFolderDialog, newFolderName, handleCreateFolder, closeAllDialogs, props.currentFolder]);

  const editFolderDialogProps = useMemo(() => ({
    open: showEditFolderDialog,
    onOpenChange: setShowEditFolderDialog,
    folder: selectedFolder,
    folderName: editFolderName,
    onFolderNameChange: setEditFolderName,
    onConfirm: handleEditFolder,
    onCancel: closeAllDialogs
  }), [showEditFolderDialog, selectedFolder, editFolderName, handleEditFolder, closeAllDialogs]);

  const deleteFolderDialogProps = useMemo(() => ({
    open: showDeleteFolderDialog,
    onOpenChange: setShowDeleteFolderDialog,
    folder: selectedFolder,
    onConfirm: handleDeleteFolder,
    onCancel: closeAllDialogs
  }), [showDeleteFolderDialog, selectedFolder, handleDeleteFolder, closeAllDialogs]);

  /* ── RETURN UI STATE AND HANDLERS ──────────────────────────── */
  return {
    // UI State
    searchInputValue,
    setSearchInputValue,
    
    // Refs
    fileInputRef,
    folderInputRef,
    
    // Event Handlers
    handleHomeClick,
    handleViewChange,
    handleSearchSubmit,
    handleSearchClear,
    handleSearchFocus,
    handleSearchBlur,
    handleCreateFolder,
    handleEditFolder,
    handleDeleteFolder,
    
    // Dialog Handlers
    openCreateFolderDialog,
    openEditFolderDialog,
    openDeleteFolderDialog,
    closeAllDialogs,
    
    // Computed Props
    breadcrumbItems,
    archiveBreadcrumbItems,
    searchDropdownProps,
    dragOverlayProps,
    uploadButtonProps,
    statusTabProps,
    archiveTabProps,
    foldersTabProps,
    
    // Dialog Props
    createFolderDialogProps,
    editFolderDialogProps,
    deleteFolderDialogProps,
    
    // Conditional Logic Helpers
    getFileIcon,
    getFileBadgeClass,
    getTabButtonClass,
    getSortButtonText,
    
    // UI Configuration
    compact: mobileModeActive,
    showUploadProgress: props.uploading && props.uploadProgress,
    uploadProgressText: props.uploadProgress ? 
      `Uploading ${props.uploadProgress.current}/${props.uploadProgress.total}...` : 
      'Uploading…'
  };
}