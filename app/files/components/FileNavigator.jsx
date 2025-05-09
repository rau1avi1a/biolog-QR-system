// app/files/components/FileNavigator.jsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Clock,
  CircleDot,
  Loader2,
  Home,
  ChevronRight,
  ChevronDown as ChevronDownIcon,
  Search,
  Folder as FolderIcon,
  File as FileIcon,
  FolderPlus,
  UploadCloud,
  MoreHorizontal,
  Edit2,
  Trash2,
  CheckCircle2
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
import { api } from '../lib/api';
import { useRouter } from 'next/navigation';

// ──────────────────────────────────────────────────────────────────────
// Breadcrumb for folder navigation
// ──────────────────────────────────────────────────────────────────────
function EnhancedBreadcrumb({ folder, onNavigate }) {
  const [path, setPath] = useState([]);
  useEffect(() => { setPath(folder ? [folder] : []); }, [folder]);

  return (
    <Breadcrumb className="mb-4 text-sm">
      <BreadcrumbItem>
        <BreadcrumbLink
          onClick={() => onNavigate(null)}
          className="flex items-center gap-1"
        >
          <FolderIcon size={14}/> <span>Root</span>
        </BreadcrumbLink>
      </BreadcrumbItem>
      {path.map((item, i) => (
        <React.Fragment key={item._id}>
          <BreadcrumbSeparator/>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => onNavigate(item)}
              className={`hover:text-primary ${i === path.length-1 ? 'font-medium' : ''}`}
            >
              {item.name}
            </BreadcrumbLink>
          </BreadcrumbItem>
        </React.Fragment>
      ))}
    </Breadcrumb>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Search box
// ──────────────────────────────────────────────────────────────────────
function FileSearch({ onSearchResults }) {
  const [query, setQuery] = useState('');
  const [busy,  setBusy]  = useState(false);

  const run = async e => {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    const { files } = await api.files();
    onSearchResults(files.filter(f =>
      f.fileName.toLowerCase().includes(query.toLowerCase())
    ));
    setBusy(false);
  };

  return (
    <form onSubmit={run} className="relative mb-4">
      <Input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search files…"
        className="pr-8"
      />
      <button
        type="submit"
        disabled={busy}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
      >
        {busy
          ? <Loader2 size={16} className="animate-spin"/>
          : <Search size={16}/>
        }
      </button>
    </form>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Single file row
// ──────────────────────────────────────────────────────────────────────
function FileItem({ file, onSelect, onStatusChange }) {
  const icon = {
    'In Progress': <Clock        size={14} className="text-amber-500"/>,
    Review       : <CircleDot    size={14} className="text-blue-500"/>,
    Completed    : <CheckCircle2 size={14} className="text-green-500"/>
  }[file.status] || <FileIcon size={14}/>;

  const badgeClass = {
    'In Progress': 'bg-amber-100 text-amber-800',
    Review       : 'bg-blue-100  text-blue-800',
    Completed    : 'bg-green-100 text-green-800'
  }[file.status] || 'bg-muted-foreground/20 text-muted-foreground';

  return (
    <DropdownMenu>
      <div
        onClick={()=>onSelect(file)}
        className="flex items-center gap-2 hover:bg-muted rounded px-2 py-1.5 mb-1 cursor-pointer group"
      >
        {icon}
        <span className="truncate flex-1">{file.fileName}</span>
        {file.status && (
          <Badge variant="outline" className={`text-xs py-0 px-2 ${badgeClass}`}>
            {file.status}
          </Badge>
        )}
        {onStatusChange && (
          <>
            <DropdownMenuTrigger asChild onClick={e=>e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                <MoreHorizontal size={14}/>
              </Button>
            </DropdownMenuTrigger>
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
          </>
        )}
      </div>
    </DropdownMenu>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Edit / Delete Folder Dialog
// ──────────────────────────────────────────────────────────────────────
function EditFolderDialog({ folder, onUpdate, onDelete }) {
  const [open,    setOpen]    = useState(false);
  const [name,    setName]    = useState(folder?.name||'');
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { if(folder) setName(folder.name); }, [folder]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
            <MoreHorizontal size={14}/>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={()=>setOpen(true)}>
            <Edit2 size={14} className="mr-2"/> Rename Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator/>
          <DropdownMenuItem onClick={()=>setConfirm(true)} className="text-red-600">
            <Trash2 size={14} className="mr-2"/> Delete Folder
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
            onSubmit={e=>{
              e.preventDefault();
              if(name.trim()) onUpdate(folder._id,name.trim());
              setOpen(false);
            }}
            className="space-y-4 pt-4"
          >
            <Input value={name} onChange={e=>setName(e.target.value)} autoFocus/>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* delete */}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete “{folder?.name}” and its files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={()=>onDelete(folder._id)} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Recursive folder node
// ──────────────────────────────────────────────────────────────────────
function FolderNode({
  node, depth=0, currentFolder, onSelect,
  onFileSelect, onFolderUpdate, onFolderDelete,
  refreshTrigger
}) {
  const [open, setOpen]       = useState(false);
  const [kids, setKids]       = useState([]);
  const [files, setFiles]     = useState([]);
  const [loading, setLoading] = useState(false);
  const isSelected = currentFolder?._id === node._id;

  useEffect(() => {
    if (isSelected && !open) load();
  }, [currentFolder, refreshTrigger]);

  const load = async () => {
    if (loading) return;
    setLoading(true);
    const [fRes, fileRes] = await Promise.all([
      api.folders(node._id),
      api.files(node._id)
    ]);
    setKids (fRes.folders || []);
    setFiles(fileRes.files || []);
    setOpen(true);
    setLoading(false);
  };

  const toggle = () => (!open ? load() : setOpen(false));
  const changeStatus = async (id,s) => {
    await api.updateFileStatus(id,s);
    const { files: upd } = await api.files(node._id);
    setFiles(upd||[]);
  };

  return (
    <div className="select-none">
      <div
        onClick={toggle}
        style={{ paddingLeft:8+depth*12 }}
        className={`flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-2 py-1.5 group ${
          isSelected?'bg-primary/10 text-primary font-medium':''}`}
      >
        <span className="text-muted-foreground mr-1">
          {loading
            ? <Loader2 size={14} className="animate-spin"/>
            : open
              ? <ChevronDownIcon size={14}/>
              : <ChevronRight size={14}/>
          }
        </span>
        <FolderIcon size={14} className={isSelected?'text-primary':''}/>
        <span className="truncate" onClick={e=>{e.stopPropagation(); onSelect(node);}}>
          {node.name}
        </span>
        {kids.length>0 && (
          <Badge variant="outline" className="ml-auto text-xs py-0 px-1.5">
            {kids.length}
          </Badge>
        )}
        <EditFolderDialog
          folder={node}
          onUpdate={onFolderUpdate}
          onDelete={onFolderDelete}
        />
      </div>

      {open && (
        <div className="pl-2">
          {kids.map(c=>(
            <FolderNode key={c._id}
              node={c}
              depth={depth+1}
              currentFolder={currentFolder}
              onSelect={onSelect}
              onFileSelect={onFileSelect}
              onFolderUpdate={onFolderUpdate}
              onFolderDelete={onFolderDelete}
              refreshTrigger={refreshTrigger}
            />
          ))}
          {files.length>0 && (
            <div className="ml-8 mt-1 border-l pl-2 border-muted">
              {files.map(f=>(
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

// ──────────────────────────────────────────────────────────────────────
// Create Folder dialog
// ──────────────────────────────────────────────────────────────────────
function CreateFolderDialog({ onCreateFolder, parentFolder }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Create folder">
          <FolderPlus size={16}/>
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
          onSubmit={e=>{
            e.preventDefault();
            if(name.trim()) onCreateFolder(name.trim());
            setName(''); setOpen(false);
          }}
          className="space-y-4 pt-4"
        >
          <Input
            value={name}
            onChange={e=>setName(e.target.value)}
            autoFocus
            placeholder="Folder name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────────────────────────────────────────────────
// STATUS TABS (In Progress & Review) – now pulling from files API
// ──────────────────────────────────────────────────────────────────────
function StatusTabs({ openFile, refreshTrigger, closeDrawer }) {
  const [order, setOrder] = useState('newest');

  // two statuses we display
  const statuses = ['In Progress', 'Review'];

  // trigger two parallel queries
  const results = useQueries({
    queries: statuses.map(status => ({
      queryKey: ['filesByStatus', status, refreshTrigger],
      queryFn: () => api.getFilesByStatus(status).then(r => r.files || []),
      staleTime: 30_000
    }))
  });

  const loading  = { inProgress: results[0].isFetching, review: results[1].isFetching };
  const tabFiles = { inProgress: results[0].data || [], review: results[1].data || [] };

  const sortList = arr => {
    const a = [...arr];
    if (order === 'name') return a.sort((x,y)=>x.fileName.localeCompare(y.fileName));
    const ts = f => new Date(f.updatedAt||f.createdAt).getTime();
    return a.sort((x,y)=> order==='newest' ? ts(y)-ts(x) : ts(x)-ts(y) );
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="inProgress">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="inProgress"> <Clock size={14}/> Progress </TabsTrigger>
          <TabsTrigger value="review">     <CircleDot size={14}/> Review   </TabsTrigger>
        </TabsList>

        <div className="mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex w-full justify-between">
                Sort by: {order==='newest'?'Newest':order==='oldest'?'Oldest':'Name'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={()=>setOrder('newest')}>Newest first</DropdownMenuItem>
              <DropdownMenuItem onClick={()=>setOrder('oldest')}>Oldest first</DropdownMenuItem>
              <DropdownMenuItem onClick={()=>setOrder('name')}>Name (A–Z)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {['inProgress','review'].map((key,i)=>(
          <TabsContent key={key} value={key}>
            <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-2">
              {loading[key] ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={16} className="animate-spin mr-2"/> Loading…
                </div>
              ) : sortList(tabFiles[key]).length ? (
                sortList(tabFiles[key]).map(f=>(
                  <div key={f._id}
                       onClick={()=>{ openFile(f); closeDrawer?.(); }}
                       className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1">
                    {key==='inProgress'
                      ? <Clock      size={16} className="text-amber-500"/>
                      : <CircleDot  size={16} className="text-blue-500"/>}
                    <div className="truncate flex-1">{f.fileName}</div>
                    {f.updatedAt && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(f.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center p-4 text-muted-foreground">No documents</div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// ARCHIVE LIST (Completed) – also from files API
// ──────────────────────────────────────────────────────────────────────
function ArchiveList({ openFile, refreshTrigger, closeDrawer }) {
  const { data: files = [], isFetching } = useQuery(
    ['filesByStatus','Completed', refreshTrigger],
    () => api.getFilesByStatus('Completed').then(r=>r.files||[]),
    { staleTime: 30_000 }
  );
  const [order,setOrder] = useState('newest');

  const sortList = arr => {
    const a = [...arr];
    if (order==='name') return a.sort((x,y)=>x.fileName.localeCompare(y.fileName));
    const ts = f=>new Date(f.updatedAt||f.createdAt).getTime();
    return a.sort((x,y)=> order==='newest' ? ts(y)-ts(x) : ts(x)-ts(y) );
  };

  return (
    <div className="space-y-4">
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex w-full justify-between">
              Sort by: {order==='newest'?'Newest':order==='oldest'?'Oldest':'Name'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={()=>setOrder('newest')}>Newest first</DropdownMenuItem>
            <DropdownMenuItem onClick={()=>setOrder('oldest')}>Oldest first</DropdownMenuItem>
            <DropdownMenuItem onClick={()=>setOrder('name')}>Name (A-Z)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-2">
        {isFetching ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={16} className="animate-spin mr-2"/> Loading…
          </div>
        ) : sortList(files).length ? (
          sortList(files).map(f=>(
            <div key={f._id}
                 onClick={()=>{ openFile(f); closeDrawer?.(); }}
                 className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1">
              <CheckCircle2 size={16} className="text-green-500"/>
              <div className="truncate flex-1">{f.fileName}</div>
              {f.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(f.updatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="text-center p-4 text-muted-foreground">Archive is empty</div>
        )}
      </ScrollArea>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// FOLDERS PANE (unchanged logic)
// ──────────────────────────────────────────────────────────────────────
function FoldersPane({
  root, files, currentFolder, setCurrentFolder,
  createFolder, updateFolder, deleteFolder,
  openFile, beginUpload, uploading, refreshTrigger
}) {
  return (
    <div className="h-full flex flex-col">
      <EnhancedBreadcrumb folder={currentFolder} onNavigate={setCurrentFolder}/>
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Folders & Files</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={beginUpload} title="Upload">
            <UploadCloud size={16}/>
          </Button>
          <CreateFolderDialog onCreateFolder={createFolder} parentFolder={currentFolder}/>
        </div>
      </div>
      <ScrollArea className="flex-grow">
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
    <div className="mt-2 border-t pt-2">
      <h4 className="font-medium text-sm mb-1 pl-2">Root Files</h4>
      {files.map(f => (
        <FileItem
          key={f._id}
          file={f}
          onSelect={openFile}
        />
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
      <Loader2 size={16} className="animate-spin" /> Uploading…
    </div>
  )}
</ScrollArea>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// MAIN SIDEBAR
// ──────────────────────────────────────────────────────────────────────
export default function FileNavigator({
  view, setView,
  root, files,
  currentFolder, setCurrentFolder,
  search, setSearch,
  uploading,
  createFolder, updateFolder, deleteFolder,
  handleFiles,
  openFile, closeDrawer,
  refreshTrigger
}) {
  const inputRef = useRef();
  const router   = useRouter();

  const beginUpload  = () => inputRef.current?.click();
  const openAndClose = f => { openFile(f); closeDrawer?.(); };

  return (
    <div className="flex flex-col h-full">
      <input
        ref={inputRef}
        hidden multiple accept="application/pdf"
        onChange={e=>handleFiles(Array.from(e.target.files))}
        type="file"
      />

      {/* HOME + SEARCH */}
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" size="sm"
                  onClick={()=>router.push('/home')}
                  className="flex items-center gap-1">
            <Home size={14}/> <span>Home</span>
          </Button>
          <div className="flex-1">
            <FileSearch onSearchResults={setSearch}/>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="px-2">
        <div className="flex space-x-1 border-b mb-2">
          <Button
            variant={view==='folders'?'default':'ghost'} size="sm"
            onClick={()=>{setView('folders'); setSearch(null);}}
            className="flex-1 flex items-center gap-1"
          >
            <FolderIcon size={14}/> Files
          </Button>
          <Button
            variant={view==='status'?'default':'ghost'} size="sm"
            onClick={()=>{setView('status'); setSearch(null);}}
            className="flex-1 flex items-center gap-1"
          >
            <CircleDot size={14}/> Status
          </Button>
          <Button
            variant={view==='archive'?'default':'ghost'} size="sm"
            onClick={()=>{setView('archive'); setSearch(null);}}
            className="flex-1 flex items-center gap-1"
          >
            <CheckCircle2 size={14}/> Archive
          </Button>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-hidden px-2">
        {search ? (
          /* … your existing search UI … */
          <ScrollArea className="h-[calc(100vh-280px)]">{/* … */}</ScrollArea>
        ) : view==='folders' ? (
          <FoldersPane
            root={root}
            files={files}
            currentFolder={currentFolder}
            setCurrentFolder={setCurrentFolder}
            createFolder={createFolder}
            updateFolder={updateFolder}
            deleteFolder={deleteFolder}
            openFile={openAndClose}
            beginUpload={beginUpload}
            uploading={uploading}
            refreshTrigger={refreshTrigger}
          />
        ) : view==='status' ? (
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
