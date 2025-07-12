// app/(pages)/files/page.jsx - FINAL FIX: Proper data extraction

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { ui } from '@/components/ui';
import { filesApi, hasApiError, extractApiData, handleApiError } from './lib/api';

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

  // === ENHANCED FOLDER LOADING LOGIC - FINAL FIX ===
  useEffect(() => {
    const loadFolderData = async () => {
      try {
        setDataLoading(true);
        setError(null);
        
        if (currentFolder) {
          
          const [foldersResult, filesResult] = await Promise.all([
            filesApi.folders.list(currentFolder._id),
            filesApi.files.list(currentFolder._id)
          ]);
          
          
          // FIXED: Handle folders with proper data extraction
          let foldersData = [];
          if (hasApiError(foldersResult)) {
            console.error('❌ Error loading subfolders:', handleApiError(foldersResult));
          } else {
            // Extract the full data object first, then get the folders array
            const fullData = extractApiData(foldersResult, { folders: [] });
            foldersData = fullData.folders || [];
          }
          
          // FIXED: Handle files with proper data extraction - ONLY original files
          let filesData = [];
          if (hasApiError(filesResult)) {
            console.error('❌ Error loading folder files:', handleApiError(filesResult));
          } else {
            // Extract the full data object first, then get the files array
            const fullData = extractApiData(filesResult, { files: [] });
            const allFiles = fullData.files || [];
            // Filter to only include original files (not batches)
            filesData = allFiles.filter(file => !file.isBatch && !file.runNumber && !file.status);
          }
          
          setRoot(foldersData);
          setFiles(filesData);
          
        } else {
          
          const [foldersResult, filesResult] = await Promise.all([
            filesApi.folders.list(),
            filesApi.files.list()
          ]);
          
          
          // FIXED: Handle root folders with proper data extraction
          let foldersData = [];
          if (hasApiError(foldersResult)) {
            const errorMsg = handleApiError(foldersResult);
            console.error('❌ Error loading root folders:', errorMsg);
            throw new Error(errorMsg);
          } else {
            // Extract the full data object first, then get the folders array
            const fullData = extractApiData(foldersResult, { folders: [] });
            foldersData = fullData.folders || [];
          }
          
          // FIXED: Handle root files with proper data extraction - ONLY original files
          let filesData = [];
          if (hasApiError(filesResult)) {
            console.error('❌ Error loading root files:', handleApiError(filesResult));
          } else {
            // Extract the full data object first, then get the files array
            const fullData = extractApiData(filesResult, { files: [] });
            const allFiles = fullData.files || [];
            // Filter to only include original files (not batches)
            filesData = allFiles.filter(file => !file.isBatch && !file.runNumber && !file.status);
          }
          
          setRoot(foldersData);
          setFiles(filesData);
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

  // === FOLDER OPERATIONS - FIXED ===
  const createFolder = useCallback(async (name) => {
    try {
      const result = await filesApi.folders.create(name, currentFolder?._id);
      
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }
      
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Failed to create folder:', error);
      setError(`Failed to create folder: ${error.message}`);
      throw error;
    }
  }, [currentFolder, triggerRefresh]);

  const updateFolder = useCallback(async (id, name) => {
    try {
      const result = await filesApi.folders.update(id, name);
      
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }
      
      triggerRefresh();
    } catch (error) {
      console.error('❌ Page: Failed to update folder:', error);
      setError(`Failed to update folder: ${error.message}`);
      throw error;
    }
  }, [triggerRefresh]);

  const deleteFolder = useCallback(async (id) => {
    try {
      const result = await filesApi.folders.remove(id);
      
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }
      
      
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

  // === FILE UPLOAD OPERATIONS - FIXED ===
  const handleFiles = useCallback(async (fileList) => {
    if (!fileList.length) return;
    
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });
    
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const result = await filesApi.files.upload(file, currentFolder?._id);
        
        if (hasApiError(result)) {
          throw new Error(`Failed to upload ${file.name}: ${handleApiError(result)}`);
        }
        
        setUploadProgress({ current: i + 1, total: fileList.length });
      }
      
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
    
    setUploading(true);
    setUploadProgress({ current: 0, total: fileList.length });

    try {
      const fileDataArray = fileList.map((file) => ({
        file,
        relativePath: file.webkitRelativePath || file.name
      }));


      const result = await filesApi.files.uploadBatch(fileDataArray, currentFolder?._id);
      
      if (hasApiError(result)) {
        throw new Error(handleApiError(result));
      }

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

// === ENHANCED FILE OPENING LOGIC - FIXED BASE64 HANDLING ===
const openFile = useCallback(async (file) => {
  try {
    
    if (!file || !file._id) {
      throw new Error('Invalid file data');
    }

    // Show loading state
    setError(null);

    // Helper function to validate and clean base64 data
// Helper function to validate and clean base64 data - FIXED to handle object format
const validateAndCleanBase64 = (data, contentType = 'application/pdf') => {
  if (!data) return null;
  
  try {
    let cleanedData = data;
    
    // FIXED: Handle object format from backend (most common now)
    if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
      console.log('📄 Processing PDF object format:', {
        hasData: !!data.data,
        dataType: typeof data.data,
        hasContentType: !!data.contentType,
        contentType: data.contentType
      });
      
      if (data.data) {
        // Use the contentType from the object if available
        const objContentType = data.contentType || contentType;
        
        // Recursively call this function to handle the inner data
        return validateAndCleanBase64(data.data, objContentType);
      } else {
        console.error('📄 PDF object has no data property');
        return null;
      }
    }
    
    // If it's already a data URL, extract just the base64 part for validation
    if (typeof data === 'string' && data.startsWith('data:')) {
      const base64Match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const base64Part = base64Match[2];
        // Test if the base64 is valid
        atob(base64Part);
        return data; // Return original data URL if valid
      }
    }
    
    // If it's a Buffer, convert to base64 string
    if (Buffer.isBuffer(data)) {
      const base64String = data.toString('base64');
      // Test if the base64 is valid
      atob(base64String);
      return `data:${contentType};base64,${base64String}`;
    }
    
    // FIXED: Handle serialized Buffer from MongoDB/API
    if (typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
      console.log('📄 Processing serialized Buffer from API');
      const buffer = Buffer.from(data.data);
      const base64String = buffer.toString('base64');
      // Test if the base64 is valid
      atob(base64String);
      return `data:${contentType};base64,${base64String}`;
    }
    
    // If it's a plain string, assume it's base64 and test it
    if (typeof data === 'string') {
      // Remove any whitespace/newlines that might cause issues
      const cleanBase64 = data.replace(/\s/g, '');
      // Test if the base64 is valid
      atob(cleanBase64);
      return `data:${contentType};base64,${cleanBase64}`;
    }
    
    console.error('📄 Unknown data format:', typeof data, data?.constructor?.name);
    return null;
    
  } catch (error) {
    console.error('📄 Base64 validation failed:', error.message);
    console.error('📄 Data info:', {
      type: typeof data,
      constructor: data?.constructor?.name,
      isBuffer: Buffer.isBuffer(data),
      hasData: data?.data ? 'yes' : 'no',
      preview: typeof data === 'string' ? data.substring(0, 100) : 'Not a string'
    });
    return null;
  }
};

    // FIXED: Better detection of file type
    const isBatchFile = file.sourceType === 'batch' || 
                       file.isBatch || 
                       file.status || 
                       file.runNumber ||
                       file.batchId;

    if (isBatchFile) {
      // This is a batch file
      
      const result = await filesApi.batches.get(file._id);
      
      if (hasApiError(result)) {
        throw new Error('Failed to load batch: ' + handleApiError(result));
      }
      
      const batch = extractApiData(result);
      console.log('📦 Batch data loaded:', batch);
      
      if (batch) {
        let pdfData = null;
        
        console.log('📄 Checking PDF sources for batch:', {
          hasSignedPdf: !!batch.signedPdf,
          hasSignedPdfData: !!(batch.signedPdf?.data),
          hasPdf: !!batch.pdf,
          hasFileId: !!batch.fileId,
          hasFileIdPdf: !!(batch.fileId?.pdf)
        });
        
        // FIXED: Check PDF sources in priority order with proper validation
        if (batch.signedPdf && batch.signedPdf.data) {
          // Use the baked PDF that has overlays burned in
          console.log('📄 Processing signed PDF data...');
          pdfData = validateAndCleanBase64(
            batch.signedPdf.data, 
            batch.signedPdf.contentType || 'application/pdf'
          );
          if (pdfData) {
            console.log('📄 Using signed PDF with overlays');
          } else {
            console.error('📄 Signed PDF data validation failed');
          }
        } 
        
        if (!pdfData && batch.pdf) {
          // Use stored PDF data
          console.log('📄 Processing batch PDF data...');
          pdfData = validateAndCleanBase64(batch.pdf);
          if (pdfData) {
            console.log('📄 Using batch PDF data');
          } else {
            console.error('📄 Batch PDF data validation failed');
          }
        }
        
        // FIXED: Check fileId.pdf BEFORE making API call
        if (!pdfData && batch.fileId && batch.fileId.pdf && batch.fileId.pdf.data) {
          // Use PDF data from populated fileId object
          console.log('📄 Processing fileId PDF object...');
          
          const pdfObj = batch.fileId.pdf;
          pdfData = validateAndCleanBase64(
            pdfObj.data,
            pdfObj.contentType || 'application/pdf'
          );
          
          if (pdfData) {
            console.log('📄 Using fileId embedded PDF data');
          } else {
            console.error('📄 FileId PDF data validation failed');
          }
        }
        
        if (!pdfData && batch.fileId) {
          // Fallback: load from original file API
          const originalFileId = typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId;
          console.log('📄 Loading PDF from original file API:', originalFileId);
          
          try {
            const originalResult = await filesApi.files.getWithPdf(originalFileId);
            if (!hasApiError(originalResult)) {
              const originalData = extractApiData(originalResult);
              if (originalData?.pdf) {
                console.log('📄 Processing original file PDF from API...');
                pdfData = validateAndCleanBase64(originalData.pdf);
                if (pdfData) {
                  console.log('📄 Using original file PDF from API');
                } else {
                  console.error('📄 Original file PDF data validation failed');
                }
              } else {
                console.warn('📄 Original file API returned no PDF data');
              }
            } else {
              console.error('📄 Original file API error:', handleApiError(originalResult));
            }
          } catch (err) {
            console.error('Failed to load original file PDF:', err);
          }
        }
        
        if (!pdfData) {
          // FIXED: More detailed error logging
          console.error('📄 No valid PDF data found anywhere. Full batch analysis:', {
            batchId: batch._id,
            hasSignedPdf: !!batch.signedPdf,
            signedPdfKeys: batch.signedPdf ? Object.keys(batch.signedPdf) : [],
            hasPdf: !!batch.pdf,
            hasFileId: !!batch.fileId,
            fileIdType: typeof batch.fileId,
            fileIdKeys: batch.fileId && typeof batch.fileId === 'object' ? Object.keys(batch.fileId) : [],
            fileIdPdfExists: !!(batch.fileId?.pdf),
            allBatchKeys: Object.keys(batch)
          });
          throw new Error(`No valid PDF data found for this batch. The batch exists but contains no accessible or valid PDF data.`);
        }
        
        const docData = { 
          ...batch, 
          pdf: pdfData,
          isBatch: true,
          originalFileId: typeof batch.fileId === 'object' ? batch.fileId._id : batch.fileId,
          // Don't pass overlays if we have a baked PDF
          overlays: batch.signedPdf?.data ? null : (batch.overlays || null),
          // Ensure we have a fileName for display
          fileName: batch.fileId?.fileName || file.fileName || `Batch Run ${batch.runNumber}`,
          runNumber: batch.runNumber
        };
        
        console.log('✅ Page: Batch loaded successfully with valid PDF data');
        setCurrentDoc(docData);
      } else {
        throw new Error('No batch data returned from API');
      }
      
    } else if (file.isArchived) {
      // This is an archived file
      console.log('🗄️ Page: Opening archived file:', file._id);
      throw new Error('Archived file support not yet implemented');
      
    } else {
      // This is an original file
      console.log('📄 Page: Opening original file:', file._id);
      
      const result = await filesApi.files.getWithPdf(file._id);
      
      if (hasApiError(result)) {
        throw new Error('Failed to load file: ' + handleApiError(result));
      }
      
      const fileData = extractApiData(result);
      
      if (!fileData) {
        throw new Error('No data returned from file API');
      }
      
      console.log('📄 Processing original file PDF data...');
      const pdfData = validateAndCleanBase64(fileData.pdf);
      
      if (!pdfData) {
        console.error('📄 Page: No valid PDF data in original file response. Full response:', {
          fileId: fileData._id,
          fileName: fileData.fileName,
          keys: Object.keys(fileData),
          hasPdf: !!fileData.pdf,
          pdfType: typeof fileData.pdf
        });
        throw new Error('No valid PDF data found in original file - check that the file was uploaded correctly');
      }
      
      const docData = { 
        ...fileData, 
        pdf: pdfData,
        isBatch: false,
        fileName: fileData.fileName || file.fileName || 'Untitled File'
      };
      
      console.log('✅ Page: Original file loaded successfully with valid PDF data');
      setCurrentDoc(docData);
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
const handleOpenProperties = useCallback(async (doc) => {
  if (!doc?._id) return;
  
  try {
    console.log('🔍 Opening properties for:', {
      docId: doc._id,
      isBatch: doc.isBatch || !!doc.runNumber || !!doc.status,
      hasFileId: !!doc.fileId,
      fileId: doc.fileId
    });

    let targetFileId = doc._id;
    let isFromBatch = false;

    // FIXED: If this is a batch, get the original file ID
    if (doc.isBatch || doc.runNumber || doc.status || doc.batchId) {
      isFromBatch = true;
      
      // If the batch has a fileId reference, use that
      if (doc.fileId) {
        targetFileId = typeof doc.fileId === 'object' ? doc.fileId._id : doc.fileId;
        console.log('✅ Using fileId from batch:', targetFileId);
      } else {
        // If no fileId in the batch object, we need to fetch the full batch first
        console.log('🔍 Fetching full batch data to get fileId...');
        const batchResult = await filesApi.batches.get(doc._id);
        
        if (hasApiError(batchResult)) {
          throw new Error(handleApiError(batchResult));
        }
        
        const fullBatch = extractApiData(batchResult);
        if (fullBatch?.fileId) {
          targetFileId = typeof fullBatch.fileId === 'object' ? fullBatch.fileId._id : fullBatch.fileId;
          console.log('✅ Got fileId from full batch:', targetFileId);
        } else {
          throw new Error('Batch has no associated file ID');
        }
      }
    }

    // Now fetch the original file metadata
    console.log('📄 Fetching original file metadata:', targetFileId);
    const metaResult = await filesApi.files.get(targetFileId);
    
    if (hasApiError(metaResult)) {
      throw new Error(handleApiError(metaResult));
    }
    
    const fullFile = extractApiData(metaResult);
    
    // Add context flags for the FileProperties component
    const fileWithContext = {
      ...fullFile,
      isFromBatch,
      originalBatchId: isFromBatch ? doc._id : null
    };
    
    console.log('✅ File properties data prepared:', {
      fileId: fullFile._id,
      fileName: fullFile.fileName,
      isFromBatch,
      hasComponents: fullFile.components?.length > 0,
      hasSolutionRef: !!fullFile.solutionRef
    });
    
    setPropertiesDoc(fileWithContext);
    
  } catch (err) {
    console.error('❌ get item failed:', err.message);
    setError(`Failed to load file properties: ${err.message}`);
    // Don't set propertiesDoc on error
  }
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