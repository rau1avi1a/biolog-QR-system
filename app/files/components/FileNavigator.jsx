// app/files/components/FileNavigator.jsx
'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Clock,
  CircleDot,
  Loader2,
  Home,
  ChevronRight,
  ChevronLeft,
  ChevronDown as ChevronDownIcon,
  Search,
  Folder as FolderIcon,
  File as FileIcon,
  FileX,
  FolderPlus,
  UploadCloud,
  MoreHorizontal,
  Edit2,
  Trash2,
  CheckCircle2,
  Archive,
  SortAsc,
  RotateCcw,
  Upload
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '../lib/api';
import { useRouter } from 'next/navigation';

// Compact Breadcrumb component
function CompactBreadcrumb({ folder, onNavigate }) {
  const [path, setPath] = useState([]);
  useEffect(() => { setPath(folder ? [folder] : []); }, [folder]);

  return (
    <Breadcrumb className="text-xs">
      <BreadcrumbItem>
        <BreadcrumbLink
          onClick={() => onNavigate(null)}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-400"
        >
          <FolderIcon size={12} />
          <span>Root</span>
        </BreadcrumbLink>
      </BreadcrumbItem>
      {path.map((item, i) => (
        <React.Fragment key={item._id}>
          <BreadcrumbSeparator className="text-slate-300 dark:text-slate-600" />
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => onNavigate(item)}
              className={`px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs ${
                i === path.length-1 ? 'font-medium text-primary' : 'text-slate-600 dark:text-slate-400 hover:text-primary'
              }`}
            >
              {item.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </React.Fragment>
      ))}
    </Breadcrumb>
  );
}

// Enhanced Search box
function FileSearch({ onSearchResults }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async e => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try {
      const { files } = await api.files();
      onSearchResults(files.filter(f =>
        f.fileName.toLowerCase().includes(query.toLowerCase())
      ));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={run} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search files..."
          className="pl-10 pr-12 h-9 bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 focus:border-primary/60 transition-colors"
        />
        <button
          type="submit"
          disabled={busy}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
        >
          {busy
            ? <Loader2 size={16} className="animate-spin"/>
            : <Search size={16}/>
          }
        </button>
      </div>
    </form>
  );
}

// Enhanced File Item with modern card styling
function FileItem({ file, onSelect, onStatusChange }) {
  const icon = {
    'In Progress': <Clock size={14} className="text-amber-500"/>,
    Review: <CircleDot size={14} className="text-blue-500"/>,
    Completed: <CheckCircle2 size={14} className="text-green-500"/>
  }[file.status] || <FileIcon size={14} className="text-slate-500"/>;

  const badgeClass = {
    'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
    Review: 'bg-blue-100 text-blue-800 border-blue-200',
    Completed: 'bg-green-100 text-green-800 border-green-200'
  }[file.status] || 'bg-slate-100 text-slate-800 border-slate-200';

  return (
    <DropdownMenu>
      <Card 
        onClick={() => onSelect(file)}
        className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer mb-2 border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur"
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="truncate flex-1 font-medium text-sm group-hover:text-primary transition-colors">
                  {file.fileName}
                </span>
                {onStatusChange && (
                  <DropdownMenuTrigger asChild onClick={e=>e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal size={14}/>
                    </Button>
                  </DropdownMenuTrigger>
                )}
              </div>
              {file.status && (
                <Badge variant="outline" className={`text-xs ${badgeClass}`}>
                  {file.status}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {onStatusChange && (
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={()=>onStatusChange(file._id,'In Progress')}>
            <Clock size={14} className="mr-2 text-amber-500"/> Mark as In Progress
          </DropdownMenuItem>
          <DropdownMenuItem onClick={()=>onStatusChange(file._id,'Review')}>
            <CircleDot size={14} className="mr-2 text-blue-500"/> Move to Review
          </DropdownMenuItem>
          <DropdownMenuItem onClick={()=>onStatusChange(file._id,'Completed')}>
            <CheckCircle2 size={14} className="mr-2 text-green-500"/> Mark as Completed
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

// Enhanced Status Tabs with modern styling
function StatusTabs({ openFile, refreshTrigger, closeDrawer }) {
  const [order, setOrder] = useState('newest');
  const statuses = ['In Progress', 'Review'];

  const results = useQueries({
    queries: statuses.map(status => ({
      queryKey: ['filesByStatus', status, refreshTrigger],
      queryFn: () => api.getFilesByStatus(status).then(r => r.files || []),
      staleTime: 30_000,
      retry: 2,
      retryDelay: 1000
    }))
  });

  const loading = { inProgress: results[0].isFetching, review: results[1].isFetching };
  const error = { inProgress: results[0].error, review: results[1].error };
  const tabFiles = { inProgress: results[0].data || [], review: results[1].data || [] };

  const sortList = arr => {
    const a = [...arr];
    if (order === 'name') return a.sort((x, y) => x.fileName.localeCompare(y.fileName));
    const ts = f => new Date(f.updatedAt || f.createdAt).getTime();
    return a.sort((x, y) => order === 'newest' ? ts(y) - ts(x) : ts(x) - ts(y));
  };

  const handleFileClick = (file) => {
    openFile(file);
    closeDrawer?.();
  };
  
  return (
    <div className="space-y-4">
      <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
        <CardContent className="p-4">
          <Tabs defaultValue="inProgress">
            <TabsList className="grid grid-cols-2 mb-4 bg-slate-100/80 dark:bg-slate-800/80">
              <TabsTrigger value="inProgress" className="flex items-center gap-2"> 
                <Clock size={14} /> In Progress 
              </TabsTrigger>
              <TabsTrigger value="review" className="flex items-center gap-2">     
                <CircleDot size={14} /> Review   
              </TabsTrigger>
            </TabsList>

            <div className="mb-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex w-full justify-between bg-white/60 dark:bg-slate-800/60">
                    <span className="flex items-center gap-2">
                      <SortAsc size={14} />
                      Sort by: {order === 'newest' ? 'Newest' : order === 'oldest' ? 'Oldest' : 'Name'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setOrder('newest')}>Newest first</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOrder('oldest')}>Oldest first</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setOrder('name')}>Name (A–Z)</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {['inProgress', 'review'].map((key, i) => (
              <TabsContent key={key} value={key}>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  {loading[key] ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 size={16} className="animate-spin mr-2" /> 
                      <span className="text-slate-600 dark:text-slate-400">Loading…</span>
                    </div>
                  ) : error[key] ? (
                    <div className="text-center p-4 text-red-500">
                      <p>Error loading files</p>
                      <p className="text-xs">{error[key].message}</p>
                    </div>
                  ) : sortList(tabFiles[key]).length ? (
                    <div className="space-y-2">
                      {sortList(tabFiles[key]).map(f => (
                        <Card 
                          key={f._id}
                          onClick={() => handleFileClick(f)}
                          className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20 border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40"
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                                {key === 'inProgress'
                                  ? <Clock size={16} className="text-amber-500" />
                                  : <CircleDot size={16} className="text-blue-500" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">
                                  {f.fileName}
                                </div>
                                {f.updatedAt && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(f.updatedAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                        {key === 'inProgress' 
                          ? <Clock size={20} className="text-amber-500" />
                          : <CircleDot size={20} className="text-blue-500" />
                        }
                      </div>
                      <p className="font-medium">No documents</p>
                      <p className="text-xs mt-1">No files in this status yet</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// Enhanced Archive List with modern styling
function ArchiveList({ openFile, refreshTrigger, closeDrawer }) {
  const [currentArchiveFolder, setCurrentArchiveFolder] = useState(null);
  const [order, setOrder] = useState('newest');

  const { data: archivedBatches = [], isFetching, error } = useQuery({
    queryKey: ['archivedBatches', refreshTrigger],
    queryFn: () => api.getAllArchivedFiles().then(r => r.files || []),
    staleTime: 30_000,
    retry: 2,
    retryDelay: 1000
  });

  const { folders, rootFiles } = useMemo(() => {
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

  const sortList = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];
    const a = [...arr];
    if (order === 'name') return a.sort((x, y) => x.fileName.localeCompare(y.fileName));
    const ts = f => new Date(f.archivedAt || f.updatedAt || f.createdAt).getTime();
    return a.sort((x, y) => order === 'newest' ? ts(y) - ts(x) : ts(x) - ts(y));
  }, [order]);

  const handleFileClick = useCallback((file) => {
    openFile(file);
    closeDrawer?.();
  }, [openFile, closeDrawer]);

  const getCurrentFiles = useMemo(() => {
    if (!currentArchiveFolder) {
      return rootFiles;
    }
    return currentArchiveFolder.files || [];
  }, [currentArchiveFolder, rootFiles]);

  const getCurrentFolders = useMemo(() => {
    if (!currentArchiveFolder) {
      return folders;
    }
    return currentArchiveFolder.children || [];
  }, [currentArchiveFolder, folders]);

  return (
    <div className="space-y-4">
      <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4 p-2 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 rounded-lg">
            <Breadcrumb className="text-sm">
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => setCurrentArchiveFolder(null)}
                  className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <Archive size={14} className="text-primary" /> 
                  <span className="font-medium">Archive</span>
                </BreadcrumbLink>
              </BreadcrumbItem>
              {currentArchiveFolder && (
                <>
                  <BreadcrumbSeparator className="text-slate-400" />
                  <BreadcrumbItem>
                    <span className="font-semibold text-primary">{currentArchiveFolder.name}</span>
                  </BreadcrumbItem>
                </>
              )}
            </Breadcrumb>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="bg-white/60 dark:bg-slate-800/60">
                  <SortAsc size={14} className="mr-1" />
                  {order === 'newest' ? 'Newest' : order === 'oldest' ? 'Oldest' : 'Name'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setOrder('newest')}>Newest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOrder('oldest')}>Oldest first</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setOrder('name')}>Name (A-Z)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <ScrollArea className="h-[calc(100vh-320px)]">
            {isFetching ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={16} className="animate-spin mr-2" /> 
                <span className="text-slate-600 dark:text-slate-400">Loading archive…</span>
              </div>
            ) : error ? (
              <div className="text-center p-4 text-red-500">
                <p>Error loading archive</p>
                <p className="text-xs">{error.message}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {getCurrentFolders.map(folder => (
                  <Card
                    key={folder._id}
                    onClick={() => setCurrentArchiveFolder(folder)}
                    className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20 border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                          <FolderIcon size={16} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">
                            {folder.name}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {folder.files?.length || 0}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {getCurrentFiles.length > 0 && (
                  <div className={getCurrentFolders.length > 0 ? "mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/60" : ""}>
                    {getCurrentFolders.length > 0 && (
                      <h4 className="font-medium text-sm mb-2 pl-2 text-slate-600 dark:text-slate-400">Files</h4>
                    )}
                    {sortList(getCurrentFiles).map(f => (
                      <Card
                        key={f._id}
                        onClick={() => handleFileClick(f)}
                        className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20 border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                              <CheckCircle2 size={16} className="text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">
                                {f.fileName}
                              </div>
                              {f.archivedAt && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(f.archivedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {getCurrentFolders.length === 0 && getCurrentFiles.length === 0 && (
                  <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                    {currentArchiveFolder ? (
                      <>
                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <FileX size={20} className="opacity-50" />
                        </div>
                        <p className="font-medium">No archived files in this folder</p>
                        <p className="text-xs mt-1">This folder is empty</p>
                      </>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <Archive size={20} className="opacity-50" />
                        </div>
                        <p className="font-medium">No archived files yet</p>
                        <p className="text-xs mt-1">Complete some files to start building your archive</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// Unified Upload Button - handles both files and folders
function UnifiedUploadButton({ onFilesUpload, onFolderUpload }) {
  const fileInputRef = useRef();
  const folderInputRef = useRef();

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length > 0) {
      // Check if files have directory structure (webkitRelativePath)
      const hasStructure = pdfFiles.some(file => 
        file.webkitRelativePath && file.webkitRelativePath.includes('/')
      );
      
      if (hasStructure && onFolderUpload) {
        onFolderUpload(pdfFiles);
      } else {
        onFilesUpload(pdfFiles);
      }
    }
    
    // Reset input
    e.target.value = '';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 hover:bg-primary/10"
        >
          <Upload size={16}/>
          Upload
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
          <FileIcon size={14} className="mr-2"/>
          Upload Files
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
          <FolderIcon size={14} className="mr-2"/>
          Upload Folder
        </DropdownMenuItem>
      </DropdownMenuContent>
      
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        accept=".pdf"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
    </DropdownMenu>
  );
}

// Enhanced Folders Pane with consolidated upload and search
function FoldersPane({
  root, files, currentFolder, setCurrentFolder,
  createFolder, updateFolder, deleteFolder,
  openFile, handleFiles, uploading, refreshTrigger,
  onFolderUpload, setSearch
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragCounter(0);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const pdfFiles = files.filter(file => file.type === 'application/pdf');
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
  };

  return (
    <div 
      className="h-full flex flex-col space-y-4 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center p-8">
            <div className="p-4 rounded-full bg-primary/20 w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <UploadCloud size={32} className="text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">Drop PDF files here</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Release to upload your documents
            </p>
          </div>
        </div>
      )}

      <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
        <CardContent className="p-4">
          {/* Header with title and actions */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Folders & Files</h3>
            <div className="flex gap-2">
              <UnifiedUploadButton 
                onFilesUpload={handleFiles}
                onFolderUpload={onFolderUpload}
              />
              <CreateFolderDialog onCreateFolder={createFolder} parentFolder={currentFolder}/>
            </div>
          </div>

          {/* Compact breadcrumb */}
          {currentFolder && (
            <div className="mb-3 p-2 bg-slate-50/60 dark:bg-slate-800/60 rounded border border-slate-200/60 dark:border-slate-700/60">
              <CompactBreadcrumb folder={currentFolder} onNavigate={setCurrentFolder}/>
            </div>
          )}

          {/* Search bar - only show in folders view */}
          <div className="mb-4">
            <FileSearch onSearchResults={setSearch}/>
          </div>
          
          <ScrollArea className="h-[calc(100vh-420px)]">
            <div className="space-y-1 pr-2">
              {root.map(folder => (
                <FolderNode
                  key={folder._id}
                  node={folder}
                  currentFolder={currentFolder}
                  onSelect={setCurrentFolder}
                  onFileSelect={openFile}
                  onFolderUpdate={updateFolder}
                  onFolderDelete={deleteFolder}
                  refreshTrigger={refreshTrigger}
                />
              ))}

              {!currentFolder && files.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                  <h4 className="font-medium text-sm mb-3 pl-2 text-slate-600 dark:text-slate-400">Root Files</h4>
                  <div className="space-y-1">
                    {files.map(f => (
                      <FileItem
                        key={f._id}
                        file={f}
                        onSelect={openFile}
                      />
                    ))}
                  </div>
                </div>
              )}

              {root.length === 0 && files.length === 0 && (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <UploadCloud size={24} className="opacity-50" />
                  </div>
                  <p className="font-medium mb-2">No folders or files yet</p>
                  <p className="text-sm mb-3">Create a folder or upload files to get started</p>
                  <p className="text-xs text-slate-400">💡 Tip: You can drag & drop PDF files here</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {uploading && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur">
          <Loader2 size={16} className="animate-spin" /> 
          <span>Uploading…</span>
        </div>
      )}
    </div>
  );
}

// Enhanced folder operations dialogs
function EditFolderDialog({ folder, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(folder?.name || '');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { 
    if (folder) setName(folder.name); 
  }, [folder]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal size={14}/>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Edit2 size={14} className="mr-2"/> Rename Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onClick={() => setConfirm(true)} className="text-red-600">
            <Trash2 size={14} className="mr-2"/> Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit folder</DialogTitle>
            <DialogDescription>Update the folder name</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (name.trim()) onUpdate(folder._id, name.trim());
              setOpen(false);
            }}
            className="space-y-4 pt-4"
          >
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus/>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{folder?.name}" and its files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(folder._id)} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateFolderDialog({ onCreateFolder, parentFolder }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 hover:bg-primary/10" title="Create folder">
          <FolderPlus size={16}/>
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new folder</DialogTitle>
          <DialogDescription>
            {parentFolder ? `Creating in: ${parentFolder.name}` : 'Creating in root'}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={e => {
            e.preventDefault();
            if (name.trim()) onCreateFolder(name.trim());
            setName(''); 
            setOpen(false);
          }}
          className="space-y-4 pt-4"
        >
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="Folder name"
            className="bg-white/80 dark:bg-slate-800/80"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Enhanced folder node with modern styling
function FolderNode({
  node, depth = 0, currentFolder, onSelect,
  onFileSelect, onFolderUpdate, onFolderDelete,
  refreshTrigger
}) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const isSelected = currentFolder?._id === node._id;

  useEffect(() => {
    if (isSelected && !open) load();
  }, [currentFolder, refreshTrigger]);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [fRes, fileRes] = await Promise.all([
        api.folders(node._id),
        api.files(node._id)
      ]);
      setKids(fRes.folders || []);
      setFiles(fileRes.files || []);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => (!open ? load() : setOpen(false));
  
  const changeStatus = async (id, s) => {
    try {
      await api.updateFileStatus(id, s);
      const { files: upd } = await api.files(node._id);
      setFiles(upd || []);
    } catch (error) {
      console.error('Failed to update file status:', error);
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={toggle}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`flex items-center gap-2 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 rounded-lg px-3 py-2 group transition-colors ${
          isSelected ? 'bg-primary/10 text-primary font-medium border border-primary/20' : ''
        }`}
      >
        <span className="text-slate-400 dark:text-slate-500">
          {loading
            ? <Loader2 size={14} className="animate-spin"/>
            : open
              ? <ChevronDownIcon size={14}/>
              : <ChevronRight size={14}/>
          }
        </span>
        <FolderIcon size={14} className={isSelected ? 'text-primary' : 'text-slate-500'}/>
        <span className="truncate flex-1" onClick={e => { e.stopPropagation(); onSelect(node); }}>
          {node.name}
        </span>
        {kids.length + files.length > 0 && (
          <Badge variant="outline" className="text-xs py-0 px-2 bg-slate-100 text-slate-600 border-slate-200">
            {kids.length + files.length}
          </Badge>
        )}
        <EditFolderDialog
          folder={node}
          onUpdate={onFolderUpdate}
          onDelete={onFolderDelete}
        />
      </div>

      {open && (
        <div className="ml-4 mt-1">
          {kids.map(c => (
            <FolderNode key={c._id}
              node={c}
              depth={depth + 1}
              currentFolder={currentFolder}
              onSelect={onSelect}
              onFileSelect={onFileSelect}
              onFolderUpdate={onFolderUpdate}
              onFolderDelete={onFolderDelete}
              refreshTrigger={refreshTrigger}
            />
          ))}
          {files.length > 0 && (
            <div className="ml-6 mt-2 space-y-1 border-l border-slate-200/60 dark:border-slate-700/60 pl-3">
              {files.map(f => (
                <FileItem
                  key={f._id}
                  file={f}
                  onSelect={onFileSelect}
                  onStatusChange={changeStatus}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Enhanced MAIN COMPONENT - cleaned up with consolidated features
export default function FileNavigator({
  view, setView,
  root, files,
  currentFolder, setCurrentFolder,
  search, setSearch,
  uploading,
  createFolder, updateFolder, deleteFolder,
  handleFiles,
  onFolderUpload,
  openFile, closeDrawer,
  refreshTrigger
}) {
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  const openAndClose = f => { openFile(f); closeDrawer?.(); };

  // Enhanced drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter <= 1) {
      setIsDragOver(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
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
  };

  return (
    <div 
      className="flex flex-col h-full bg-gradient-to-b from-white/50 to-slate-50/50 dark:from-slate-950/50 dark:to-slate-900/50 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Global drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center p-8">
            <div className="p-4 rounded-full bg-primary/20 w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <UploadCloud size={40} className="text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-primary mb-2">Drop PDF files here</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Folder structure will be preserved automatically
            </p>
          </div>
        </div>
      )}

      {/* Enhanced HOME + NAVIGATION */}
      <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-white/80 to-slate-50/80 dark:from-slate-950/80 dark:to-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/home')}
              className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 hover:bg-primary/10 border-slate-200/60 dark:border-slate-700/60"
            >
              <Home size={14} className="text-primary"/> 
              <span>Home</span>
            </Button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Files & Documents
          </div>
        </div>
      </div>

      {/* Enhanced TABS */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur">
          <Button
            variant={view === 'folders' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => { setView('folders'); setSearch(null); }}
            className={`flex items-center gap-2 transition-all ${
              view === 'folders' 
                ? 'bg-black dark:bg-slate-700 shadow-sm' 
                : 'hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <FolderIcon size={14}/> Files
          </Button>
          <Button
            variant={view === 'status' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => { setView('status'); setSearch(null); }}
            className={`flex items-center gap-2 transition-all ${
              view === 'status' 
                ? 'bg-black dark:bg-slate-700 shadow-sm' 
                : 'hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <CircleDot size={14}/> Status
          </Button>
          <Button
            variant={view === 'archive' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => { setView('archive'); setSearch(null); }}
            className={`flex items-center gap-2 transition-all ${
              view === 'archive' 
                ? 'bg-black dark:bg-slate-700 shadow-sm' 
                : 'hover:bg-white/60 dark:hover:bg-slate-700/60'
            }`}
          >
            <CheckCircle2 size={14}/> Archive
          </Button>
        </div>
      </div>

      {/* Enhanced BODY */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        {search ? (
          <Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Search Results</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSearch(null)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Clear
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-380px)]">
                <div className="space-y-2 pr-2">
                  {search.length > 0 ? (
                    search.map(f => (
                      <FileItem key={f._id} file={f} onSelect={openAndClose} />
                    ))
                  ) : (
                    <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                        <Search size={20} className="opacity-50" />
                      </div>
                      <p className="font-medium">No files found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ) : view === 'folders' ? (
          <FoldersPane
            root={root}
            files={files}
            currentFolder={currentFolder}
            setCurrentFolder={setCurrentFolder}
            createFolder={createFolder}
            updateFolder={updateFolder}
            deleteFolder={deleteFolder}
            openFile={openAndClose}
            handleFiles={handleFiles}
            uploading={uploading}
            refreshTrigger={refreshTrigger}
            onFolderUpload={onFolderUpload}
            setSearch={setSearch}
          />
        ) : view === 'status' ? (
          <StatusTabs
            openFile={openFile}
            refreshTrigger={refreshTrigger}
            closeDrawer={closeDrawer}
          />
        ) : (
          <ArchiveList
            openFile={openFile}
            refreshTrigger={refreshTrigger}
            closeDrawer={closeDrawer}
          />
        )}
      </div>
    </div>
  );
}