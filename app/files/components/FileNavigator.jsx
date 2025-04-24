// app/files/components/FileNavigator.jsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FolderPlus, Folder as FolderIcon, FileIcon, UploadCloud, Loader2, Menu,
  Search, Clock, CheckCircle2, CircleDot, Home, ChevronRight, ChevronDown,
  MoreHorizontal, Trash2, Edit2, ChevronDown as Caret
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';

import { api } from '../lib/api';

/* ------------------------------------------------------------------ */
/* Search box                                                         */
/* ------------------------------------------------------------------ */
function FileSearch({ onSearchResults }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy]   = useState(false);

  const run = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const { files } = await api.files();
    const res = files.filter((f) =>
      f.fileName.toLowerCase().includes(query.toLowerCase())
    );
    onSearchResults(res);
    setBusy(false);
  };

  return (
    <form onSubmit={run} className="relative mb-4">
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files…" className="pr-8" />
      <button
        type="submit"
        disabled={busy}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Single file row                                                    */
/* ------------------------------------------------------------------ */
function FileItem({ file, onSelect, onStatusChange }) {
  const icon = {
    'In Progress': <Clock size={14} className="text-amber-500" />,
    Review       : <CircleDot size={14} className="text-blue-500" />,
    Completed    : <CheckCircle2 size={14} className="text-green-500" />
  }[file.status] || <FileIcon size={14} />;

  const badge = {
    'In Progress': 'bg-amber-100 text-amber-800',
    Review       : 'bg-blue-100  text-blue-800',
    Completed    : 'bg-green-100 text-green-800'
  }[file.status] || 'bg-muted-foreground/20 text-muted-foreground';

  return (
    <DropdownMenu>
      <div
        onClick={() => onSelect(file)}
        className="flex items-center gap-2 hover:bg-muted rounded px-2 py-1.5 mb-1 cursor-pointer group"
      >
        {icon}
        <span className="truncate flex-1">{file.fileName}</span>
        {file.status && (
          <Badge variant="outline" className={`text-xs py-0 px-2 ${badge}`}>
            {file.status}
          </Badge>
        )}
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onStatusChange(file._id, 'In Progress')}>
          <Clock size={14} className="mr-2 text-amber-500" />
          Mark as In Progress
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange(file._id, 'Review')}>
          <CircleDot size={14} className="mr-2 text-blue-500" />
          Move to Review
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange(file._id, 'Completed')}>
          <CheckCircle2 size={14} className="mr-2 text-green-500" />
          Mark as Completed
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Edit-/Delete folder dialog                                         */
/* ------------------------------------------------------------------ */
function EditFolderDialog({ folder, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(folder?.name || '');
  const [del, setDel]   = useState(false);

  useEffect(() => { if (folder) setName(folder.name); }, [folder]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Edit2 size={14} className="mr-2" /> Rename Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDel(true)} className="text-red-600">
            <Trash2 size={14} className="mr-2" /> Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* rename */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit folder</DialogTitle>
            <DialogDescription>Update the folder name</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) onUpdate(folder._id, name.trim());
              setOpen(false);
            }}
            className="space-y-4 pt-4"
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* delete */}
      <AlertDialog open={del} onOpenChange={setDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete “{folder?.name}” and its files.
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

/* ------------------------------------------------------------------ */
/* Recursive folder node                                              */
/* ------------------------------------------------------------------ */
function FolderNode({
  node, depth = 0, currentFolder, onSelect,
  onFileSelect, onFolderUpdate, onFolderDelete, refreshFolders
}) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const isSel = currentFolder && currentFolder._id === node._id;

  useEffect(() => { if (isSel && !open) load(); }, [currentFolder, refreshFolders]);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    const [fRes, fileRes] = await Promise.all([api.folders(node._id), api.files(node._id)]);
    setKids(fRes.folders || []);
    setFiles(fileRes.files || []);
    setOpen(true);
    setLoading(false);
  };

  const toggle = () => (!open ? load() : setOpen(false));

  const changeStatus = async (id, s) => {
    await api.updateFileStatus(id, s);
    const { files: upd } = await api.files(node._id);
    setFiles(upd || []);
  };

  return (
    <div className="select-none">
      <div
        onClick={toggle}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-2 py-1.5 group ${
          isSel ? 'bg-primary/10 text-primary font-medium' : ''
        }`}
      >
        <span className="text-muted-foreground mr-1">
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : open ? (
            <ChevronDown size={14} />
          ) : (
            <ChevronRight size={14} />
          )}
        </span>
        <FolderIcon size={14} className={isSel ? 'text-primary' : ''} />
        <span className="truncate" onClick={(e) => (e.stopPropagation(), onSelect(node))}>
          {node.name}
        </span>
        {kids.length > 0 && (
          <Badge variant="outline" className="ml-auto text-xs py-0 px-1.5">
            {kids.length}
          </Badge>
        )}
        <EditFolderDialog folder={node} onUpdate={onFolderUpdate} onDelete={onFolderDelete} />
      </div>

      {open && (
        <div className="pl-2">
          {kids.map((c) => (
            <FolderNode
              key={c._id}
              node={c}
              depth={depth + 1}
              currentFolder={currentFolder}
              onSelect={onSelect}
              onFileSelect={onFileSelect}
              onFolderUpdate={onFolderUpdate}
              onFolderDelete={onFolderDelete}
              refreshFolders={refreshFolders}
            />
          ))}

          {files.length > 0 && (
            <div className="ml-8 mt-1 border-l pl-2 border-muted">
              {files.map((file) => (
                <FileItem key={file._id} file={file} onSelect={onFileSelect} onStatusChange={changeStatus} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create folder dialog                                               */
/* ------------------------------------------------------------------ */
function CreateFolderDialog({ onCreateFolder, parentFolder }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Create folder">
          <FolderPlus size={16} />
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
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onCreateFolder(name.trim());
            setName('');
            setOpen(false);
          }}
          className="space-y-4 pt-4"
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Folder name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Breadcrumb                                                         */
/* ------------------------------------------------------------------ */
function EnhancedBreadcrumb({ folder, onNavigate }) {
  const [path, setPath] = useState([]);
  useEffect(() => { setPath(folder ? [folder] : []); }, [folder]);

  return (
    <Breadcrumb className="mb-4 text-sm">
      <BreadcrumbItem>
        <BreadcrumbLink onClick={() => onNavigate(null)} className="flex items-center gap-1">
          <FolderIcon size={14} /> <span>Root</span>
        </BreadcrumbLink>
      </BreadcrumbItem>
      {path.map((item, i) => (
        <React.Fragment key={item._id}>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => onNavigate(item)}
              className={`hover:text-primary ${i === path.length - 1 ? 'font-medium' : ''}`}
            >
              {item.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </React.Fragment>
      ))}
    </Breadcrumb>
  );
}

/* ------------------------------------------------------------------ */
/* Status tabs                                                        */
/* ------------------------------------------------------------------ */
function StatusTabs({ openFile, refreshTrigger, closeDrawer }) {
  const [tabFiles, setTabFiles] = useState({ inProgress: [], review: [], completed: [] });
  const [loading, setLoading]   = useState({ inProgress: false, review: false, completed: false });
  const [order, setOrder]       = useState('newest');

  const load = async (key) => {
    setLoading((p) => ({ ...p, [key]: true }));
    const map = { inProgress: 'In Progress', review: 'Review', completed: 'Completed' };
    const { files } = await api.getFilesByStatus(map[key]);
    setTabFiles((p) => ({ ...p, [key]: files || [] }));
    setLoading((p) => ({ ...p, [key]: false }));
  };

  useEffect(() => {
    load('inProgress');
    load('review');
    load('completed');
  }, [refreshTrigger]);

  const sort = (arr) => {
    const list = [...arr];
    if (order === 'name') return list.sort((a, b) => a.fileName.localeCompare(b.fileName));
    const k = (f) => new Date(f.updatedAt || f.createdAt).getTime();
    return list.sort((a, b) => (order === 'newest' ? k(b) - k(a) : k(a) - k(b)));
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="inProgress" onValueChange={load}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="inProgress">
            <Clock size={14} /> <span>Progress</span>
          </TabsTrigger>
          <TabsTrigger value="review">
            <CircleDot size={14} /> <span>Review</span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircle2 size={14} /> <span>Done</span>
          </TabsTrigger>
        </TabsList>

        {/* sort */}
        <div className="mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 w-full justify-between">
                <span>
                  Sort by:{' '}
                  {order === 'newest' ? 'Newest' : order === 'oldest' ? 'Oldest' : 'Name'}
                </span>
                <Caret size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setOrder('newest')}>Newest first</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOrder('oldest')}>Oldest first</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setOrder('name')}>Name (A-Z)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {['inProgress', 'review', 'completed'].map((key) => (
          <TabsContent key={key} value={key}>
            <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-2">
              {loading[key] ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin mr-2" size={16} /> Loading…
                </div>
              ) : (
                <>
                  {sort(tabFiles[key]).map((f) => (
                    <div
                      key={f._id}
                      onClick={() => { openFile(f); closeDrawer?.(); }}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1"
                    >
                      {key === 'inProgress' ? (
                        <Clock size={16} className="text-amber-500" />
                      ) : key === 'review' ? (
                        <CircleDot size={16} className="text-blue-500" />
                      ) : (
                        <CheckCircle2 size={16} className="text-green-500" />
                      )}
                      <div className="truncate flex-1">{f.fileName}</div>
                      {f.updatedAt && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(f.updatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {tabFiles[key].length === 0 && (
                    <div className="text-center p-4 text-muted-foreground">No documents</div>
                  )}
                </>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main sidebar component                                             */
/* ------------------------------------------------------------------ */
export default function FileNavigator({
  openFile,
  refreshTrigger,
  triggerRefresh,
  closeDrawer
}) {
  const [view, setView] = useState('folders');
  const [root, setRoot] = useState([]);
  const [files, setFiles] = useState([]);
  const [search, setSearch] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [folderRefresh, setFolderRefresh] = useState(0);
  const [currentFolder, setCurrentFolder] = useState(null);

  const inputRef = useRef();
  const router   = useRouter();

  // load root folders
  useEffect(() => { api.folders().then(({ folders }) => setRoot(folders || [])); },
    [folderRefresh, refreshTrigger]);

  // load files for current folder
  useEffect(() => {
    if (currentFolder) api.files(currentFolder._id).then(({ files }) => setFiles(files || []));
    else if (view === 'folders') api.files().then(({ files }) => setFiles(files || []));
  }, [currentFolder, view, folderRefresh, refreshTrigger]);

  /* CRUD */
  const createFolder  = async (name) => { await api.newFolder(name, currentFolder?._id); setFolderRefresh((p) => p + 1);} ;
  const updateFolder  = async (id, n) => { await api.updateFolder(id, n);              setFolderRefresh((p) => p + 1);} ;
  const deleteFolder  = async (id)   => {
    await api.deleteFolder(id);
    if (currentFolder?._id === id) setCurrentFolder(null);
    setFolderRefresh((p) => p + 1);
  };

  /* uploads */
  const beginUpload = () => inputRef.current?.click();
  const handleFiles = async (list) => {
    if (!list.length) return;
    setUploading(true);
    for (const f of list) await api.upload(f, currentFolder?._id);
    setUploading(false);
    triggerRefresh();
  };

  /* helper wrapper so every openFile closes drawer on mobile */
  const openAndClose = (file) => {
    openFile(file);
    closeDrawer?.();
  };

  return (
    <div className="flex flex-col h-full">
      <input
        type="file"
        multiple
        ref={inputRef}
        hidden
        accept="application/pdf"
        onChange={(e) => handleFiles(Array.from(e.target.files))}
      />

      {/* home + search */}
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/home')} className="flex items-center gap-1">
            <Home size={14} /> <span>Home</span>
          </Button>
          <div className="flex-1">
            <FileSearch onSearchResults={setSearch} />
          </div>
        </div>
      </div>

      {/* view tabs */}
      <div className="px-2">
        <div className="flex space-x-1 border-b mb-2">
          <Button
            variant={view === 'folders' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => (setView('folders'), setSearch(null))}
            className="flex-1 flex items-center gap-1"
          >
            <FolderIcon size={14} /> <span>Files</span>
          </Button>
          <Button
            variant={view === 'status' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => (setView('status'), setSearch(null))}
            className="flex-1 flex items-center gap-1"
          >
            <CheckCircle2 size={14} /> <span>Status</span>
          </Button>
        </div>
      </div>

      {/* main area */}
      <div className="flex-1 overflow-hidden px-2">
        {/* search results */}
        {search && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-sm">Search Results</h3>
              <Button variant="ghost" size="sm" onClick={() => setSearch(null)} className="h-6 text-xs">
                Clear
              </Button>
            </div>
            <ScrollArea className="h-[calc(100vh-280px)]">
              {search.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">No results found</div>
              ) : (
                search.map((f) => (
                  <div
                    key={f._id}
                    onClick={() => { openFile(f); closeDrawer?.(); }}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1"
                  >
                    <FileIcon size={16} />
                    <span className="truncate flex-1">{f.fileName}</span>
                    {f.status && (
                      <Badge variant="outline" className="text-xs">
                        {f.status}
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </ScrollArea>
          </div>
        )}

        {/* folders view */}
        {!search && view === 'folders' && (
          <div className="h-full flex flex-col">
            <EnhancedBreadcrumb folder={currentFolder} onNavigate={setCurrentFolder} />

            {/* actions */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Folders & Files</h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={beginUpload} title="Upload">
                  <UploadCloud size={16} />
                </Button>
                <CreateFolderDialog onCreateFolder={createFolder} parentFolder={currentFolder} />
              </div>
            </div>

            {/* tree */}
            <ScrollArea className="flex-grow">
              {root.map((folder) => (
                <FolderNode
                  key={folder._id}
                  node={folder}
                  currentFolder={currentFolder}
                  onSelect={setCurrentFolder}
                  onFileSelect={openAndClose}
                  onFolderUpdate={updateFolder}
                  onFolderDelete={deleteFolder}
                  refreshFolders={folderRefresh}
                />
              ))}

              {!currentFolder && files.length > 0 && (
                <div className="mt-2 border-t pt-2">
                  <h4 className="font-medium text-sm mb-1 pl-2">Root Files</h4>
                  {files.map((file) => (
                    <FileItem key={file._id} file={file} onSelect={openAndClose} onStatusChange={() => {}} />
                  ))}
                </div>
              )}

              {root.length === 0 && files.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderPlus size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No folders or files yet</p>
                  <p className="text-sm">Create a folder or upload files to get started</p>
                </div>
              )}

              {uploading && (
                <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded shadow flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> <span>Uploading files…</span>
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {/* status view */}
        {!search && view === 'status' && (
          <StatusTabs openFile={openFile} refreshTrigger={refreshTrigger} closeDrawer={closeDrawer} />
        )}
      </div>
    </div>
  );
}
