// app/(pages)/files/page.jsx - FIXED: Proper file opening and search functionality
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ui } from '@/components/ui';
import { filesApi } from './lib/api';

// Dynamic imports for better performance
const FileNavigator = dynamic(() => import('./components/FileNavigator'), { ssr: false });
const PDFEditor = dynamic(() => import('./components/PDFEditor'), { ssr: false });
const FileProperties = dynamic(() => import('./components/FileProperties'), { ssr: false });

export default function FilesPage() {
  // === PAGE-LEVEL STATE ===
  const [currentDoc, setCurrentDoc] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [propertiesDoc, setPropertiesDoc] = useState(null);

  // === FILE NAVIGATOR STATE ===
  const [view, setView] = useState('folders');
  const [root, setRoot] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [search, setSearch] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState(null);

  // === PAGE-LEVEL ACTIONS ===
  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // === ENHANCED FOLDER LOADING LOGIC ===
  useEffect(() => {
    const loadFolderData = async () => {
      try {
        setDataLoading(true);
        setError(null);
        
        if (currentFolder) {
          // Load data for a specific folder
          console.log('🔍 Page: Loading data for folder:', currentFolder.name);
          
          const [foldersResult, filesResult] = await Promise.all([
            filesApi.folders.list(currentFolder._id),
            filesApi.files.list(currentFolder._id)
          ]);
          
          console.log('📁 Page: Folder data results:', { foldersResult, filesResult });
          
          // Handle folders
          let foldersData = [];
          if (foldersResult.error) {
            console.error('❌ Error loading subfolders:', foldersResult.error);
          } else if (foldersResult.data) {
            foldersData = Array.isArray(foldersResult.data) ? foldersResult.data : [];
          }
          
          // Handle files
          let filesData = [];
          if (filesResult.error) {
            console.error('❌ Error loading folder files:', filesResult.error);
          } else if (filesResult.data) {
            filesData = Array.isArray(filesResult.data) ? filesResult.data : [];
          }
          
          setRoot(foldersData);
          setFiles(filesData);
          
          console.log('✅ Page: Loaded folder data:', {
            subfolders: foldersData.length,
            files: filesData.length
          });
          
        } else {
          // Load root folders and files
          console.log('🔍 Page: Loading root data...');
          
          const [foldersResult, filesResult] = await Promise.all([
            filesApi.folders.list(), // No parent = root folders
            filesApi.files.list()    // No folder = root files
          ]);
          
          console.log('📁 Page: Root data results:', { foldersResult, filesResult });
          
          // Handle root folders
          let foldersData = [];
          if (foldersResult.error) {
            throw new Error(foldersResult.error);
          } else if (foldersResult.data) {
            foldersData = Array.isArray(foldersResult.data) ? foldersResult.data : [];
          }
          
          // Handle root files
          let filesData = [];
          if (filesResult.error) {
            console.error('❌ Error loading root files:', filesResult.error);
            // Don't fail completely for file errors
          } else if (filesResult.data) {
            filesData = Array.isArray(filesResult.data) ? filesResult.data : [];
          }
          
          setRoot(foldersData);
          setFiles(filesData);
          
          console.log('✅ Page: Loaded root data:', {
            folders: foldersData.length,
            files: filesData.length
          });
        }
        
      } catch (error) {
        console.error('❌ Page: Failed to load folder data:', error);
        setError(`Failed to load data: ${error.message}`);
        setRoot([]);
        setFiles([]);
      } finally {
        setDataLoading(false);
      }
    };

    loadFolderData();
  }, [currentFolder, refreshTrigger, view]);

  // === FOLDER OPERATIONS ===
  const createFolder = useCallback(async (name) => {
    try {
      console.log('🔍 Page: Creating folder:', name, 'in:', currentFolder?.name || 'root');
      const result = await filesApi.folders.create(name, currentFolder?._id);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('✅ Page: Created folder successfully');
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Failed to create folder:', error);
      setError(`Failed to create folder: ${error.message}`);
      throw error;
    }
  }, [currentFolder, triggerRefresh]);

  const updateFolder = useCallback(async (id, name) => {
    try {
      console.log('🔍 Page: Updating folder:', id, 'to:', name);
      const result = await filesApi.folders.update(id, name);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('✅ Page: Updated folder successfully');
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Failed to update folder:', error);
      setError(`Failed to update folder: ${error.message}`);
      throw error;
    }
  }, [triggerRefresh]);

  const deleteFolder = useCallback(async (id) => {
    try {
      console.log('🔍 Page: Deleting folder:', id);
      const result = await filesApi.folders.remove(id);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log('✅ Page: Deleted folder successfully');
      
      // If we deleted the current folder, go back to root
      if (currentFolder?._id === id) {
        setCurrentFolder(null);
      }
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Failed to delete folder:', error);
      setError(`Failed to delete folder: ${error.message}`);
      throw error;
    }
  }, [currentFolder, triggerRefresh]);

  // === FILE UPLOAD OPERATIONS ===
  const handleFiles = useCallback(async (fileList) => {
    if (!fileList.length) return;
    
    console.log('🔍 Page: Uploading', fileList.length, 'files...');
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });
    
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        console.log(`🔍 Page: Uploading file ${i + 1}/${fileList.length}:`, file.name);
        const result = await filesApi.files.upload(file, currentFolder?._id);
        
        if (result.error) {
          throw new Error(`Failed to upload ${file.name}: ${result.error}`);
        }
        
        setUploadProgress({ current: i + 1, total: fileList.length });
      }
      
      console.log('✅ Page: All files uploaded successfully');
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Upload failed:', error);
      setError(`Upload failed: ${error.message}`);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [currentFolder, triggerRefresh]);

  const onFolderUpload = useCallback(async (fileList) => {
    if (!fileList.length) return;
    
    console.log('🔍 Page: Batch uploading', fileList.length, 'files with folder structure...');
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });

    try {
      const fileDataArray = fileList.map((file) => ({
        file,
        relativePath: file.webkitRelativePath || file.name
      }));

      console.log('🔍 Page: File structure preview:', fileDataArray.slice(0, 3));

      const result = await filesApi.files.uploadBatch(fileDataArray, currentFolder?._id);
      
      if (result.error) {
        throw new Error(result.error);
      }

      console.log('✅ Page: Batch upload completed successfully');
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Batch upload failed:', error);
      setError(`Batch upload failed: ${error.message}`);
      throw error;
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [currentFolder, triggerRefresh]);

  // === ENHANCED FILE OPENING LOGIC ===
  const openFile = useCallback(async (file) => {
    try {
      console.log('🔍 Page: Opening file:', file);
      
      if (!file || !file._id) {
        throw new Error('Invalid file data');
      }

      // Show loading state
      setError(null);

      // Determine file type and load accordingly
      if (file.sourceType === 'batch' || file.isBatch || file.status || file.runNumber) {
        // This is a batch file
        console.log('📦 Page: Opening batch file:', file._id);
        
        const result = await filesApi.batches.get(file._id);
        
        if (result.error) {
          throw new Error('Failed to load batch: ' + result.error);
        }
        
        if (result.data) {
          const batch = result.data;
          
          let pdfData = null;
          
          // Try different PDF sources in order of preference
          if (batch.signedPdf && batch.signedPdf.data) {
            // Use the baked PDF that has overlays burned in
            pdfData = `data:${batch.signedPdf.contentType || 'application/pdf'};base64,${batch.signedPdf.data.toString('base64')}`;
            console.log('📄 Using signed PDF');
          } else if (batch.pdf) {
            // Use stored PDF data
            pdfData = batch.pdf;
            console.log('📄 Using batch PDF data');
          } else if (batch.fileId) {
            // Fallback: load from original file
            const originalFileId = typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId;
            console.log('📄 Loading PDF from original file:', originalFileId);
            
            try {
              const originalResult = await filesApi.files.getWithPdf(originalFileId);
              if (!originalResult.error && originalResult.data?.pdf) {
                pdfData = originalResult.data.pdf;
                console.log('📄 Using original file PDF');
              }
            } catch (err) {
              console.error('Failed to load original file PDF:', err);
            }
          }
          
          if (!pdfData) {
            throw new Error('No PDF data found for this batch');
          }
          
          const docData = { 
            ...batch, 
            pdf: pdfData,
            isBatch: true,
            originalFileId: typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId,
            // Don't pass overlays if we have a baked PDF
            overlays: batch.signedPdf ? null : (batch.overlays || null),
            // Ensure we have a fileName for display
            fileName: batch.fileId?.fileName || file.fileName || `Batch Run ${batch.runNumber}`,
            runNumber: batch.runNumber
          };
          
          console.log('✅ Page: Batch loaded successfully');
          setCurrentDoc(docData);
        }
        
      } else if (file.isArchived) {
        // This is an archived file
        console.log('🗄️ Page: Opening archived file:', file._id);
        
        const result = await filesApi.archive.getFile(file._id);
        if (result.error) {
          throw new Error('Failed to load archived file: ' + result.error);
        }
        
        if (result.data) {
          const docData = { 
            ...result.data, 
            pdf: result.data.pdf,
            isBatch: true,
            isArchived: true,
            originalFileId: result.data.originalFileId || result.data.fileId,
            fileName: result.data.fileName || file.fileName || 'Archived File'
          };
          
          console.log('✅ Page: Archived file loaded successfully');
          setCurrentDoc(docData);
        }
        
      } else {
        // This is an original file
        console.log('📄 Page: Opening original file:', file._id);
        
        const result = await filesApi.files.getWithPdf(file._id);
        if (result.error) {
          throw new Error('Failed to load file: ' + result.error);
        }
        
        if (result.data) {
          const docData = { 
            ...result.data, 
            pdf: result.data.pdf,
            isBatch: false,
            fileName: result.data.fileName || file.fileName || 'Untitled File'
          };
          
          console.log('✅ Page: Original file loaded successfully');
          setCurrentDoc(docData);
        }
      }
      
    } catch (error) {
      console.error('❌ Page: Failed to open file:', error);
      setError(`Failed to open file: ${error.message}`);
      // Don't throw - just show error message
    }
  }, []);

  // === DRAWER HANDLERS ===
  const handleToggleDrawer = useCallback(() => setDrawer(true), []);
  const handleCloseDrawer = useCallback(() => setDrawer(false), []);

  // === PROPERTIES HANDLERS ===
  const handleOpenProperties = useCallback((doc) => {
    setPropertiesDoc(doc);
  }, []);
  
  const handlePropertiesClose = useCallback((open) => {
    if (!open) setPropertiesDoc(null);
  }, []);

  const handlePropertiesSaved = useCallback((updatedDoc) => {
    if (currentDoc && currentDoc._id === updatedDoc._id) {
      setCurrentDoc(updatedDoc);
    }
    triggerRefresh();
  }, [currentDoc, triggerRefresh]);

  const handleFileDeleted = useCallback((deletedDoc) => {
    setPropertiesDoc(null);
    if (currentDoc && currentDoc._id === deletedDoc._id) {
      setCurrentDoc(null);
    }
    triggerRefresh();
  }, [currentDoc, triggerRefresh]);

  // === FILE NAVIGATOR PROPS ===
  const fileNavigatorProps = {
    // Navigation state
    view,
    setView,
    root,
    files,
    currentFolder,
    setCurrentFolder,
    search,
    setSearch,
    uploading,
    uploadProgress,
    dataLoading,
    error,

    // Operations
    createFolder,
    updateFolder,
    deleteFolder,
    handleFiles,
    onFolderUpload,

    // Event handlers
    openFile,
    closeDrawer: handleCloseDrawer,
    refreshTrigger,
  };

  console.log('🔍 Page: Passing props to FileNavigator:', {
    rootCount: Array.isArray(root) ? root.length : 'not array',
    rootType: typeof root,
    filesCount: Array.isArray(files) ? files.length : 'not array',
    filesType: typeof files,
    currentFolder: currentFolder?.name || 'none',
    view,
    uploading,
    dataLoading,
    hasError: !!error,
    currentDoc: currentDoc?.fileName || 'none'
  });

  // === RENDER ===
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Error Display */}
      {error && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <ui.Alert variant="destructive">
            <ui.icons.AlertCircle className="h-4 w-4" />
            <ui.AlertTitle>Error</ui.AlertTitle>
            <ui.AlertDescription>
              {error}
              <button 
                onClick={() => setError(null)} 
                className="ml-2 underline hover:no-underline"
              >
                Dismiss
              </button>
            </ui.AlertDescription>
          </ui.Alert>
        </div>
      )}

      {/* Mobile Drawer */}
      <ui.Sheet open={drawer} onOpenChange={setDrawer}>
        <ui.SheetContent 
          side="left" 
          className="w-[85vw] sm:max-w-md p-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/90"
        >
          <ui.SheetHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4">
            <ui.SheetTitle className="text-lg font-semibold">Document Explorer</ui.SheetTitle>
          </ui.SheetHeader>
          <div className="flex flex-col h-[calc(100%-73px)]">
            {dataLoading ? (
              <div className="flex items-center justify-center h-full">
                <ui.icons.Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading...</span>
              </div>
            ) : (
              <FileNavigator {...fileNavigatorProps} />
            )}
          </div>
        </ui.SheetContent>
      </ui.Sheet>

      {/* Desktop Layout */}
      <div className="hidden md:flex h-screen">
        <aside className="w-80 border-r bg-white/50 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-slate-950/50 dark:supports-[backdrop-filter]:bg-slate-950/80 shadow-sm">
          <div className="h-full border-r border-slate-200/60 dark:border-slate-800/60">
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Document Explorer</h1>
            </div>
            {dataLoading ? (
              <div className="flex items-center justify-center h-full">
                <ui.icons.Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading...</span>
              </div>
            ) : (
              <FileNavigator {...fileNavigatorProps} />
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-950/50 dark:to-slate-900/50">
          {currentDoc ? (
            <PDFEditor
              doc={currentDoc}
              refreshFiles={triggerRefresh}
              setCurrentDoc={setCurrentDoc}
              onOpenProperties={handleOpenProperties}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden h-screen overflow-hidden flex flex-col">
        {!currentDoc && (
          <div className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-slate-950/95 flex items-center justify-between px-4 py-3 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <ui.Button 
                size="icon" 
                variant="ghost" 
                onClick={handleToggleDrawer} 
                title="Menu"
                className="hover:bg-primary/10 transition-colors"
              >
                <ui.icons.Menu size={18} />
              </ui.Button>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Document Explorer</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">Laboratory Documents</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              Tap <ui.icons.Menu className="inline h-3 w-3" /> to browse files
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {currentDoc ? (
            <PDFEditor
              doc={currentDoc}
              mobileModeActive
              onToggleDrawer={handleToggleDrawer}
              refreshFiles={triggerRefresh}
              setCurrentDoc={setCurrentDoc}
              onOpenProperties={handleOpenProperties}
            />
          ) : (
            <EmptyState mobile onBrowse={handleToggleDrawer} />
          )}
        </div>
      </div>

      {/* File Properties Drawer (Page-Level) */}
      <FileProperties
        file={propertiesDoc}
        open={!!propertiesDoc}
        onOpenChange={handlePropertiesClose}
        onSaved={handlePropertiesSaved}
        onFileDeleted={handleFileDeleted}
        readOnly={propertiesDoc?.isBatch || propertiesDoc?.status === 'Completed' || propertiesDoc?.isArchived}
      />
    </div>
  );
}

/* Enhanced Empty State Component */
function EmptyState({ mobile = false, onBrowse }) {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-950/50 dark:to-slate-900/50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="p-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <ui.icons.FileText size={mobile ? 24 : 32} className="text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">No document selected</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          {mobile 
            ? 'Open the menu to select a file from your document library' 
            : 'Select a file from the sidebar to preview and edit it with our advanced PDF tools'
          }
        </p>
        {mobile && (
          <ui.Button 
            size="default" 
            onClick={onBrowse} 
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all shadow-md"
          >
            Browse Files
          </ui.Button>
        )}
      </div>
    </div>
  );
}