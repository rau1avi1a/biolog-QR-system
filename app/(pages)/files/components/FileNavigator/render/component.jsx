// app/files/components/FileNavigator/render/component.jsx - FIXED with proper React imports
'use client';

import React, { useRef, useEffect, useState } from 'react'; // ✅ FIXED: Added all required React imports
import { ui } from '@/components/ui';
import { useCore } from '../hooks/core';
import { useComponentState } from '../hooks/state';

export default function FileNavigator(props) {
  const core = useCore(props);
  const state = useComponentState(core, props);
  
  // Add the missing refs
  const fileInputRef = useRef();
  const folderInputRef = useRef();

  // Helper function to handle file uploads
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length > 0) {
      const hasStructure = pdfFiles.some(file => 
        file.webkitRelativePath && file.webkitRelativePath.includes('/')
      );
      
      if (hasStructure && core?.onFolderUpload) {
        core.onFolderUpload(pdfFiles);
      } else if (core?.handleFiles) {
        core.handleFiles(pdfFiles);
      }
    }
    
    // Reset input
    e.target.value = '';
  };

  // Add error display for debugging
  if (props.error) {
    return (
      <div className="p-4 text-center text-red-600">
        <ui.icons.AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p className="font-medium">Error loading data</p>
        <p className="text-sm mt-1">{props.error}</p>
        <ui.Button 
          onClick={() => window.location.reload()} 
          variant="outline" 
          size="sm" 
          className="mt-2"
        >
          Reload Page
        </ui.Button>
      </div>
    );
  }

  if (state.showUploadProgress) {
    return (
      <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 backdrop-blur">
        <ui.icons.Loader2 size={16} className="animate-spin" />
        <span>{state.uploadProgressText}</span>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full bg-gradient-to-b from-white/50 to-slate-50/50 dark:from-slate-950/50 dark:to-slate-900/50 relative"
      onDragEnter={core?.handleDragEnter}
      onDragLeave={core?.handleDragLeave}
      onDragOver={core?.handleDragOver}
      onDrop={core?.handleDrop}
    >
      {/* Global Drag Overlay */}
      {state.dragOverlayProps?.show && (
        <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center backdrop-blur-sm">
          <div className="text-center p-8">
            <div className="p-4 rounded-full bg-primary/20 w-20 h-20 flex items-center justify-center mx-auto mb-4">
              <ui.icons.UploadCloud size={40} className="text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-primary mb-2">{state.dragOverlayProps.title}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {state.dragOverlayProps.subtitle}
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="p-4 border-b border-slate-200/60 dark:border-slate-700/60 bg-gradient-to-r from-white/80 to-slate-50/80 dark:from-slate-950/80 dark:to-slate-900/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ui.Button 
              variant="outline" 
              size="sm"
              onClick={state.handleHomeClick}
              className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 hover:bg-primary/10 border-slate-200/60 dark:border-slate-700/60"
            >
              <ui.icons.Home size={14} className="text-primary" /> 
              <span>Home</span>
            </ui.Button>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Files & Documents
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur">
          <ui.Button
            variant={props.view === 'folders' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => state.handleViewChange('folders')}
            className={state.getTabButtonClass('folders')}
          >
            <ui.icons.FolderIcon size={14}/> Files
          </ui.Button>
          <ui.Button
            variant={props.view === 'status' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => state.handleViewChange('status')}
            className={state.getTabButtonClass('status')}
          >
            <ui.icons.CircleDot size={14}/> Status
          </ui.Button>
          <ui.Button
            variant={props.view === 'archive' ? 'default' : 'ghost'} 
            size="sm"
            onClick={() => state.handleViewChange('archive')}
            className={state.getTabButtonClass('archive')}
          >
            <ui.icons.CheckCircle2 size={14}/> Archive
          </ui.Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        {props.view === 'folders' && (
          <div className="h-full flex flex-col space-y-4 relative">
            <ui.Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
              <ui.CardContent className="p-4">
                {/* Header with title and actions */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    {props.search ? 'Search Results' : 'Folders & Files'}
                  </h3>
                  <div className="flex gap-2">
                    {props.search && (
                      <ui.Button 
                        variant="outline" 
                        size="sm" 
                        onClick={state.handleSearchClear}
                        className="bg-white/60 dark:bg-slate-800/60 border-slate-200/60 dark:border-slate-700/60"
                      >
                        Clear Search
                      </ui.Button>
                    )}
                    {!props.search && (
                      <>
                        <ui.DropdownMenu>
                          <ui.DropdownMenuTrigger asChild>
                            <ui.Button variant="outline" size="sm" className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 hover:bg-primary/10">
                              <ui.icons.Upload size={16}/>
                              Upload
                            </ui.Button>
                          </ui.DropdownMenuTrigger>
                          <ui.DropdownMenuContent align="end" className="w-48">
                            <ui.DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                              <ui.icons.FileIcon size={14} className="mr-2"/>
                              Upload Files
                            </ui.DropdownMenuItem>
                            <ui.DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
                              <ui.icons.FolderIcon size={14} className="mr-2"/>
                              Upload Folder
                            </ui.DropdownMenuItem>
                          </ui.DropdownMenuContent>
                        </ui.DropdownMenu>
                        
                        <ui.Button
                          variant="outline"
                          size="sm"
                          onClick={state.openCreateFolderDialog}
                          className="flex items-center gap-2 bg-white/60 dark:bg-slate-800/60 hover:bg-primary/10"
                        >
                          <ui.icons.FolderPlus size={16}/>
                          New Folder
                        </ui.Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Search bar */}
                <div className="mb-4">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      <ui.icons.Search size={16} />
                    </div>
                    <ui.Input
                      placeholder="Search files..."
                      value={state.searchInputValue}
                      onFocus={state.handleSearchFocus}
                      onBlur={state.handleSearchBlur}
                      onChange={(e) => state.setSearchInputValue(e.target.value)}
                      className="pl-10 pr-12 h-9 bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 focus:border-primary/60 transition-colors"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {core?.searchBusy ? (
                        <ui.icons.Loader2 size={16} className="animate-spin"/>
                      ) : state.searchInputValue ? (
                        <button
                          type="button"
                          onClick={state.handleSearchClear}
                          className="hover:text-primary transition-colors"
                          title="Clear search"
                        >
                          <ui.icons.XCircle size={16}/>
                        </button>
                      ) : (
                        <ui.icons.Search size={16}/>
                      )}
                    </div>
                  </div>
                </div>

                {/* Breadcrumb */}
                {!props.search && props.currentFolder && (
                  <div className="mb-3 p-2 bg-slate-50/60 dark:bg-slate-800/60 rounded border border-slate-200/60 dark:border-slate-700/60">
                    <ui.Breadcrumb className="text-xs">
                      <ui.BreadcrumbItem>
                        <ui.BreadcrumbLink
                          onClick={() => core?.navigateToFolder(null)}
                          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-slate-600 dark:text-slate-400"
                        >
                          <ui.icons.FolderIcon size={12} />
                          <span>Root</span>
                        </ui.BreadcrumbLink>
                      </ui.BreadcrumbItem>
                      <ui.BreadcrumbSeparator className="text-slate-300 dark:text-slate-600" />
                      <ui.BreadcrumbItem>
                        <ui.BreadcrumbLink className="px-2 py-1 rounded font-medium text-primary text-xs">
                          {props.currentFolder.name}
                        </ui.BreadcrumbLink>
                      </ui.BreadcrumbItem>
                    </ui.Breadcrumb>
                  </div>
                )}
                
                <ui.ScrollArea className="h-[calc(100vh-420px)]">
                  <div className="space-y-1 pr-2">
                    {props.search ? (
                      // Search Results View
                      props.search.length > 0 ? (
                        props.search.map(f => (
                          <FileCard
                            key={f._id}
                            file={f}
                            onClick={() => core?.openFileAndClose(f)}
                            getFileIcon={state.getFileIcon}
                            getFileBadgeClass={state.getFileBadgeClass}
                          />
                        ))
                      ) : (
                        <EmptySearchResults />
                      )
                    ) : (
                      // Normal Folder View
                      <>
                        {/* Render Folders */}
                        {Array.isArray(props.root) && props.root.map(folder => (
                          <FolderItem
                            key={folder._id}
                            folder={folder}
                            currentFolder={props.currentFolder}
                            onNavigate={core?.navigateToFolder}
                            onEdit={state.openEditFolderDialog}
                            onDelete={state.openDeleteFolderDialog}
                          />
                        ))}

                        {/* Render Root Files */}
                        {!props.currentFolder && Array.isArray(props.files) && props.files.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                            <h4 className="font-medium text-sm mb-3 pl-2 text-slate-600 dark:text-slate-400">Root Files</h4>
                            <div className="space-y-1">
                              {props.files.map(f => (
                                <FileCard
                                  key={f._id}
                                  file={f}
                                  onClick={() => core?.openFileAndClose(f)}
                                  getFileIcon={state.getFileIcon}
                                  getFileBadgeClass={state.getFileBadgeClass}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Render Files in Current Folder */}
                        {props.currentFolder && Array.isArray(props.files) && props.files.length > 0 && (
                          <div className="space-y-1">
                            {props.files.map(f => (
                              <FileCard
                                key={f._id}
                                file={f}
                                onClick={() => core?.openFileAndClose(f)}
                                getFileIcon={state.getFileIcon}
                                getFileBadgeClass={state.getFileBadgeClass}
                              />
                            ))}
                          </div>
                        )}

                        {/* Empty State */}
                        {(!Array.isArray(props.root) || props.root.length === 0) && 
                         (!Array.isArray(props.files) || props.files.length === 0) && 
                         !props.dataLoading && (
                          <EmptyFolderState />
                        )}

                        {/* Loading State */}
                        {props.dataLoading && (
                          <div className="flex items-center justify-center py-8">
                            <ui.icons.Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span className="text-slate-600 dark:text-slate-400">Loading...</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ui.ScrollArea>
              </ui.CardContent>
            </ui.Card>

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
          </div>
        )}

        {props.view === 'status' && (
          <StatusView core={core} state={state} />
        )}

        {props.view === 'archive' && (
          <ArchiveView core={core} state={state} />
        )}
      </div>

      {/* Dialogs */}
      <CreateFolderDialog state={state} />
      <EditFolderDialog state={state} />
      <DeleteFolderDialog state={state} />
    </div>
  );
}

// ===== COMPONENT HELPERS =====

function FileCard({ file, onClick, getFileIcon, getFileBadgeClass }) {
  const icon = getFileIcon(file);
  
  return (
    <ui.Card
      onClick={onClick}
      className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer mb-2 border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur"
    >
      <ui.CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
            {React.createElement(ui.icons[icon.name], { 
              size: 14, 
              className: icon.className 
            })}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="truncate flex-1 font-medium text-sm group-hover:text-primary transition-colors">
                {file.fileName || `Batch Run ${file.runNumber}` || 'Untitled'}
              </span>
            </div>
            {file.status && (
              <ui.Badge variant="outline" className={`text-xs ${getFileBadgeClass(file.status)}`}>
                {file.status}
              </ui.Badge>
            )}
          </div>
        </div>
      </ui.CardContent>
    </ui.Card>
  );
}

function FolderItem({ folder, currentFolder, onNavigate, onEdit, onDelete }) {
  const isSelected = currentFolder?._id === folder._id;
  
  return (
    <div key={folder._id} className="select-none">
      <div
        onClick={() => onNavigate(folder)}
        className={`flex items-center gap-2 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 rounded-lg px-3 py-2 group transition-colors ${
          isSelected ? 'bg-primary/10 text-primary font-medium border border-primary/20' : ''
        }`}
      >
        <ui.icons.FolderIcon size={14} className={isSelected ? 'text-primary' : 'text-slate-500'}/>
        <span className="truncate flex-1">
          {folder.name}
        </span>
        <ui.DropdownMenu>
          <ui.DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <ui.Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
              <ui.icons.MoreHorizontal size={14}/>
            </ui.Button>
          </ui.DropdownMenuTrigger>
          <ui.DropdownMenuContent align="end" className="w-48">
            <ui.DropdownMenuItem onClick={() => onEdit(folder)}>
              <ui.icons.Edit2 size={14} className="mr-2"/> Rename Folder
            </ui.DropdownMenuItem>
            <ui.DropdownMenuSeparator/>
            <ui.DropdownMenuItem onClick={() => onDelete(folder)} className="text-red-600">
              <ui.icons.Trash2 size={14} className="mr-2"/> Delete Folder
            </ui.DropdownMenuItem>
          </ui.DropdownMenuContent>
        </ui.DropdownMenu>
      </div>
    </div>
  );
}

function EmptySearchResults() {
  return (
    <div className="text-center p-8 text-slate-500 dark:text-slate-400">
      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
        <ui.icons.Search size={20} className="opacity-50" />
      </div>
      <p className="font-medium">No files found</p>
      <p className="text-xs mt-1">Try a different search term</p>
    </div>
  );
}

function EmptyFolderState() {
  return (
    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 w-16 h-16 flex items-center justify-center mx-auto mb-4">
        <ui.icons.UploadCloud size={24} className="opacity-50" />
      </div>
      <p className="font-medium mb-2">No folders or files yet</p>
      <p className="text-sm mb-3">Create a folder or upload files to get started</p>
      <p className="text-xs text-slate-400">💡 Tip: You can drag & drop PDF files here</p>
    </div>
  );
}

function StatusView({ core, state }) {
  return (
    <div className="space-y-4">
      <ui.Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
        <ui.CardContent className="p-4">
          <ui.Tabs defaultValue="inProgress">
            <ui.TabsList className="grid grid-cols-2 mb-4 bg-slate-100/80 dark:bg-slate-800/80">
              <ui.TabsTrigger value="inProgress" className="flex items-center gap-2"> 
                <ui.icons.Clock size={14} /> In Progress 
              </ui.TabsTrigger>
              <ui.TabsTrigger value="review" className="flex items-center gap-2">     
                <ui.icons.CircleDot size={14} /> Review   
              </ui.TabsTrigger>
            </ui.TabsList>

            <div className="mb-4">
              <ui.DropdownMenu>
                <ui.DropdownMenuTrigger asChild>
                  <ui.Button variant="outline" size="sm" className="flex w-full justify-between bg-white/60 dark:bg-slate-800/60">
                    <span className="flex items-center gap-2">
                      <ui.icons.SortAsc size={14} />
                      Sort by: {state.getSortButtonText()}
                    </span>
                  </ui.Button>
                </ui.DropdownMenuTrigger>
                <ui.DropdownMenuContent align="start">
                  <ui.DropdownMenuItem onClick={() => core?.setOrder('newest')}>Newest first</ui.DropdownMenuItem>
                  <ui.DropdownMenuItem onClick={() => core?.setOrder('oldest')}>Oldest first</ui.DropdownMenuItem>
                  <ui.DropdownMenuItem onClick={() => core?.setOrder('name')}>Name (A–Z)</ui.DropdownMenuItem>
                </ui.DropdownMenuContent>
              </ui.DropdownMenu>
            </div>

            <ui.TabsContent value="inProgress">
              <StatusTabContent 
                files={core?.sortedStatusFiles?.inProgress} 
                loading={core?.statusTabData?.loading?.inProgress}
                error={core?.statusTabData?.error?.inProgress}
                emptyIcon="Clock"
                emptyText="No documents"
                iconClassName="text-amber-500"
                onFileClick={core?.openFileAndClose}
              />
            </ui.TabsContent>

            <ui.TabsContent value="review">
              <StatusTabContent 
                files={core?.sortedStatusFiles?.review} 
                loading={core?.statusTabData?.loading?.review}
                error={core?.statusTabData?.error?.review}
                emptyIcon="CircleDot"
                emptyText="No documents"
                iconClassName="text-blue-500"
                onFileClick={core?.openFileAndClose}
              />
            </ui.TabsContent>
          </ui.Tabs>
        </ui.CardContent>
      </ui.Card>
    </div>
  );
}

function StatusTabContent({ files, loading, error, emptyIcon, emptyText, iconClassName, onFileClick }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <ui.icons.Loader2 size={16} className="animate-spin mr-2" /> 
        <span className="text-slate-600 dark:text-slate-400">Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        <p>Error loading files</p>
        <p className="text-xs">{error.message}</p>
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="text-center p-8 text-slate-500 dark:text-slate-400">
        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
          {React.createElement(ui.icons[emptyIcon], { size: 20, className: iconClassName })}
        </div>
        <p className="font-medium">{emptyText}</p>
        <p className="text-xs mt-1">No files in this status yet</p>
      </div>
    );
  }

  return (
    <ui.ScrollArea className="h-[calc(100vh-320px)]">
      <div className="space-y-2">
        {files.map(f => (
          <ui.Card 
            key={f._id}
            onClick={() => onFileClick(f)}
            className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20 border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40"
          >
            <ui.CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                  {React.createElement(ui.icons[emptyIcon], { size: 16, className: iconClassName })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">
                    {f.fileName || `Batch Run ${f.runNumber}` || 'Untitled'}
                  </div>
                  {f.updatedAt && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(f.updatedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </ui.CardContent>
          </ui.Card>
        ))}
      </div>
    </ui.ScrollArea>
  );
}

function ArchiveView({ core, state }) {
  return (
    <div className="space-y-4">
      <ui.Card className="border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/50 backdrop-blur">
        <ui.CardContent className="p-4">
          <div className="flex items-center justify-between mb-4 p-2 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 rounded-lg">
            <ui.Breadcrumb className="text-sm">
              <ui.BreadcrumbItem>
                <ui.BreadcrumbLink
                  onClick={() => core?.navigateToArchiveFolder(null)}
                  className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <ui.icons.Archive size={14} className="text-primary" /> 
                  <span className="font-medium">Archive</span>
                </ui.BreadcrumbLink>
              </ui.BreadcrumbItem>
              {core?.currentArchiveFolder && (
                <>
                  <ui.BreadcrumbSeparator className="text-slate-400" />
                  <ui.BreadcrumbItem>
                    <span className="font-semibold text-primary">{core.currentArchiveFolder.name}</span>
                  </ui.BreadcrumbItem>
                </>
              )}
            </ui.Breadcrumb>

            <ui.DropdownMenu>
              <ui.DropdownMenuTrigger asChild>
                <ui.Button variant="outline" size="sm" className="bg-white/60 dark:bg-slate-800/60">
                  <ui.icons.SortAsc size={14} className="mr-1" />
                  {state.getSortButtonText()}
                </ui.Button>
              </ui.DropdownMenuTrigger>
              <ui.DropdownMenuContent align="end">
                <ui.DropdownMenuItem onClick={() => core?.setOrder('newest')}>Newest first</ui.DropdownMenuItem>
                <ui.DropdownMenuItem onClick={() => core?.setOrder('oldest')}>Oldest first</ui.DropdownMenuItem>
                <ui.DropdownMenuItem onClick={() => core?.setOrder('name')}>Name (A-Z)</ui.DropdownMenuItem>
              </ui.DropdownMenuContent>
            </ui.DropdownMenu>
          </div>

          <ui.ScrollArea className="h-[calc(100vh-320px)]">
            {core?.archiveLoading ? (
              <div className="flex items-center justify-center h-32">
                <ui.icons.Loader2 size={16} className="animate-spin mr-2" /> 
                <span className="text-slate-600 dark:text-slate-400">Loading archive…</span>
              </div>
            ) : core?.archiveError ? (
              <div className="text-center p-4 text-red-500">
                <p>Error loading archive</p>
                <p className="text-xs">{core.archiveError.message}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {core?.currentArchiveFolders?.map(folder => (
                  <ui.Card
                    key={folder._id}
                    onClick={() => core?.navigateToArchiveFolder(folder)}
                    className="group cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/20 border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/40"
                  >
                    <ui.CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 group-hover:bg-primary/10 transition-colors">
                          <ui.icons.FolderIcon size={16} className="text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium text-sm group-hover:text-primary transition-colors">
                            {folder.name}
                          </div>
                        </div>
                        <ui.Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          {folder.files?.length || 0}
                        </ui.Badge>
                      </div>
                    </ui.CardContent>
                  </ui.Card>
                ))}

                {core?.currentArchiveFiles?.length > 0 && (
                  <div className={core?.currentArchiveFolders?.length > 0 ? "mt-4 pt-2 border-t border-slate-200/60 dark:border-slate-700/60" : ""}>
                    {core?.currentArchiveFolders?.length > 0 && (
                      <h4 className="font-medium text-sm mb-2 pl-2 text-slate-600 dark:text-slate-400">Files</h4>
                    )}
                    {core?.sortedArchiveFiles?.map(f => (
                      <FileCard
                        key={f._id}
                        file={f}
                        onClick={() => core?.openFileAndClose(f)}
                        getFileIcon={() => ({ name: 'CheckCircle2', className: 'text-green-500' })}
                        getFileBadgeClass={() => ''}
                      />
                    ))}
                  </div>
                )}

                {(!core?.currentArchiveFolders || core.currentArchiveFolders.length === 0) && 
                 (!core?.currentArchiveFiles || core.currentArchiveFiles.length === 0) && (
                  <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                    {core?.currentArchiveFolder ? (
                      <>
                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <ui.icons.FileX size={20} className="opacity-50" />
                        </div>
                        <p className="font-medium">No archived files in this folder</p>
                        <p className="text-xs mt-1">This folder is empty</p>
                      </>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-12 h-12 flex items-center justify-center mx-auto mb-3">
                          <ui.icons.Archive size={20} className="opacity-50" />
                        </div>
                        <p className="font-medium">No archived files yet</p>
                        <p className="text-xs mt-1">Complete some files to start building your archive</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </ui.ScrollArea>
        </ui.CardContent>
      </ui.Card>
    </div>
  );
}

// Dialog Components
function CreateFolderDialog({ state }) {
  return (
    <ui.Dialog open={state.createFolderDialogProps?.open} onOpenChange={state.createFolderDialogProps?.onOpenChange}>
      <ui.DialogContent className="sm:max-w-md">
        <ui.DialogHeader>
          <ui.DialogTitle>Create new folder</ui.DialogTitle>
          <ui.DialogDescription>
            {state.createFolderDialogProps?.parentFolder ? `Creating in: ${state.createFolderDialogProps.parentFolder.name}` : 'Creating in root'}
          </ui.DialogDescription>
        </ui.DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            state.handleCreateFolder?.();
          }}
          className="space-y-4 pt-4"
        >
          <ui.Input
            value={state.createFolderDialogProps?.folderName || ''}
            onChange={(e) => state.createFolderDialogProps?.onFolderNameChange?.(e.target.value)}
            autoFocus
            placeholder="Folder name"
            className="bg-white/80 dark:bg-slate-800/80"
          />
          <ui.DialogFooter>
            <ui.Button variant="outline" onClick={state.createFolderDialogProps?.onCancel}>Cancel</ui.Button>
            <ui.Button type="submit">Create</ui.Button>
          </ui.DialogFooter>
        </form>
      </ui.DialogContent>
    </ui.Dialog>
  );
}

function EditFolderDialog({ state }) {
  return (
    <ui.Dialog open={state.editFolderDialogProps?.open} onOpenChange={state.editFolderDialogProps?.onOpenChange}>
      <ui.DialogContent className="sm:max-w-md">
        <ui.DialogHeader>
          <ui.DialogTitle>Edit folder</ui.DialogTitle>
          <ui.DialogDescription>Update the folder name</ui.DialogDescription>
        </ui.DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            state.handleEditFolder?.();
          }}
          className="space-y-4 pt-4"
        >
          <ui.Input 
            value={state.editFolderDialogProps?.folderName || ''} 
            onChange={(e) => state.editFolderDialogProps?.onFolderNameChange?.(e.target.value)} 
            autoFocus
          />
          <ui.DialogFooter>
            <ui.Button variant="outline" onClick={state.editFolderDialogProps?.onCancel}>Cancel</ui.Button>
            <ui.Button type="submit">Update</ui.Button>
          </ui.DialogFooter>
        </form>
      </ui.DialogContent>
    </ui.Dialog>
  );
}

function DeleteFolderDialog({ state }) {
  return (
    <ui.AlertDialog open={state.deleteFolderDialogProps?.open} onOpenChange={state.deleteFolderDialogProps?.onOpenChange}>
      <ui.AlertDialogContent>
        <ui.AlertDialogHeader>
          <ui.AlertDialogTitle>Are you sure?</ui.AlertDialogTitle>
          <ui.AlertDialogDescription>
            This will permanently delete "{state.deleteFolderDialogProps?.folder?.name}" and its files.
          </ui.AlertDialogDescription>
        </ui.AlertDialogHeader>
        <ui.AlertDialogFooter>
          <ui.AlertDialogCancel>Cancel</ui.AlertDialogCancel>
          <ui.AlertDialogAction onClick={state.deleteFolderDialogProps?.onConfirm} className="bg-red-600 hover:bg-red-700">
            Delete
          </ui.AlertDialogAction>
        </ui.AlertDialogFooter>
      </ui.AlertDialogContent>
    </ui.AlertDialog>
  );
}