"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  FolderPlus,
  Folder as FolderIcon,
  FileIcon,
  UploadCloud,
  Loader2,
  Menu,
  Search,
  Clock,
  CheckCircle2,
  CircleDot,
  Home,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Edit2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import PDFEditor from "@/components/PDFEditor";

/* ------------------------------------------------------------------ */
/* API service                                                        */
/* ------------------------------------------------------------------ */
const api = {
  folders: (p) => fetch(`/api/folders${p ? `?parentId=${p}` : ""}`).then((r) => r.json()),
  files:   (f) => fetch(`/api/files${f ? `?folderId=${f}` : ""}`).then((r) => r.json()),
  newFolder: (name, parentId) =>
    fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    }).then((r) => r.json()),
  updateFolder: (id, name) =>
    fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => r.json()),
  deleteFolder: (id) =>
    fetch(`/api/folders/${id}`, {
      method: "DELETE"
    }).then((r) => r.json()),
  upload: (file, folderId) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("fileName", file.name);
    if (folderId) fd.append("folderId", folderId);
    return fetch("/api/files", { method: "POST", body: fd });
  },
  load: (id) => fetch(`/api/files?id=${id}`).then((r) => r.json()),
  getFilesByStatus: (status) => fetch(`/api/files/status?status=${status}`).then((r) => r.json()),
  updateFileStatus: (id, status) =>
    fetch(`/api/files/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => r.json()),
  saveVersion: (fileId, overlayPng, metadata = {}) =>
    fetch(`/api/files/${fileId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        overlayPng, 
        actor: "user", 
        metadata 
      }),
    }).then((r) => r.json()),
};

/* ------------------------------------------------------------------ */
/* Search component                                                   */
/* ------------------------------------------------------------------ */
function FileSearch({ onSearchResults }) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      // Simulated loose search for now
      // In a real app you would implement this in your API
      const { files } = await api.files();
      // Simple case-insensitive include search on fileName
      const results = files.filter(file => 
        file.fileName.toLowerCase().includes(query.toLowerCase())
      );
      onSearchResults(results || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };
  
  return (
    <form onSubmit={handleSearch} className="relative mb-4">
      <Input
        type="text"
        placeholder="Search files..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="pr-8"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground bg-transparent border-none cursor-pointer"
        disabled={isSearching}
      >
        {isSearching ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Search size={16} />
        )}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* File Item component with context menu                              */
/* ------------------------------------------------------------------ */
function FileItem({ file, onSelect, onStatusChange }) {
  const getStatusIcon = (status) => {
    switch(status) {
      case "In Progress":
        return <Clock size={14} className="text-amber-500" />;
      case "Review":
        return <CircleDot size={14} className="text-blue-500" />;
      case "Completed":
        return <CheckCircle2 size={14} className="text-green-500" />;
      default:
        return <FileIcon size={14} />;
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "In Progress":
        return "bg-amber-100 text-amber-800";
      case "Review":
        return "bg-blue-100 text-blue-800";
      case "Completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-muted-foreground/20 text-muted-foreground";
    }
  };

  return (
    <DropdownMenu>
      <div
        className="flex items-center gap-2 hover:bg-muted rounded px-2 py-1.5 mb-1 group cursor-pointer"
        onClick={() => onSelect(file)}
      >
        {getStatusIcon(file.status)}
        <span className="truncate flex-1">{file.fileName}</span>
        {file.status && (
          <Badge variant="outline" className={`text-xs py-0 px-2 ${getStatusColor(file.status)}`}>
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
        <DropdownMenuItem onClick={() => onStatusChange(file._id, "In Progress")}>
          <Clock size={14} className="mr-2 text-amber-500" />
          Mark as In Progress
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange(file._id, "Review")}>
          <CircleDot size={14} className="mr-2 text-blue-500" />
          Move to Review
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onStatusChange(file._id, "Completed")}>
          <CheckCircle2 size={14} className="mr-2 text-green-500" />
          Mark as Completed
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Edit Folder Dialog                                                 */
/* ------------------------------------------------------------------ */
function EditFolderDialog({ folder, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState(folder?.name || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  useEffect(() => {
    if (folder) {
      setFolderName(folder.name);
    }
  }, [folder]);
  
  const handleUpdate = (e) => {
    e.preventDefault();
    if (folderName.trim() && folder?._id) {
      onUpdate(folder._id, folderName.trim());
      setOpen(false);
    }
  };
  
  const handleDelete = () => {
    if (folder?._id) {
      onDelete(folder._id);
      setShowDeleteConfirm(false);
      setOpen(false);
    }
  };
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <Edit2 size={14} className="mr-2" />
            Rename Folder
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600"
          >
            <Trash2 size={14} className="mr-2" />
            Delete Folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit folder</DialogTitle>
            <DialogDescription>
              Update the folder name
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUpdate} className="space-y-4 pt-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              autoFocus
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Update</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder "{folder?.name}" and all files inside it.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Enhanced folder node with collapsible folders                      */
/* ------------------------------------------------------------------ */
function FolderNode({ 
  node, 
  depth = 0, 
  onSelect, 
  currentFolder, 
  onFileSelect,
  onFolderUpdate,
  onFolderDelete,
  refreshFolders
}) {
  const [open, setOpen] = useState(false);
  const [kids, setKids] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Determine if this folder is currently selected
  const isSelected = currentFolder && currentFolder._id === node._id;

  useEffect(() => {
    // If this is the currently selected folder, ensure it's open
    if (isSelected && !open) {
      loadFolderContent();
    }
  }, [currentFolder, refreshFolders]);

  const loadFolderContent = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const [foldersRes, filesRes] = await Promise.all([
        api.folders(node._id),
        api.files(node._id)
      ]);
      
      setKids(foldersRes.folders || []);
      setFiles(filesRes.files || []);
      setOpen(true);
    } catch (error) {
      console.error("Error loading folder content:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!open) {
      await loadFolderContent();
    } else {
      setOpen(false);
    }
  };

  const handleFolderSelect = (e) => {
    e.stopPropagation();
    onSelect(node);
  };

  const handleStatusChange = async (fileId, newStatus) => {
    try {
      await api.updateFileStatus(fileId, newStatus);
      // Refresh files after status change
      const { files: updatedFiles } = await api.files(node._id);
      setFiles(updatedFiles || []);
    } catch (error) {
      console.error("Error updating file status:", error);
    }
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 cursor-pointer hover:bg-muted rounded px-2 py-1.5 transition-colors group ${
          isSelected ? "bg-primary/10 text-primary font-medium" : ""
        }`}
        style={{ paddingLeft: `${(depth * 12) + 8}px` }}
        onClick={toggle}
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
        <FolderIcon size={14} className={isSelected ? "text-primary" : ""} /> 
        <span className="truncate" onClick={handleFolderSelect}>{node.name}</span>
        {kids.length > 0 && (
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
          {/* Show child folders */}
          {kids.map((c) => (
            <FolderNode 
              key={c._id} 
              node={c} 
              depth={depth + 1} 
              onSelect={onSelect} 
              currentFolder={currentFolder}
              onFileSelect={onFileSelect}
              onFolderUpdate={onFolderUpdate}
              onFolderDelete={onFolderDelete}
              refreshFolders={refreshFolders}
            />
          ))}
          
          {/* Show files in this folder */}
          {files.length > 0 && (
            <div className="ml-8 mt-1 border-l pl-2 border-muted">
              {files.map((file) => (
                <FileItem
                  key={file._id}
                  file={file}
                  onSelect={onFileSelect}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Create Folder Dialog                                               */
/* ------------------------------------------------------------------ */
function CreateFolderDialog({ onCreateFolder, parentFolder }) {
  const [open, setOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName("");
      setOpen(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          size="icon" 
          variant="ghost" 
          title="Create new folder"
          className="h-8 w-8"
        >
          <FolderPlus size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new folder</DialogTitle>
          <DialogDescription>
            {parentFolder ? `Creating in: ${parentFolder.name}` : "Creating in root folder"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <Input
            placeholder="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
          />
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
/* Enhanced breadcrumb component                                      */
/* ------------------------------------------------------------------ */
function EnhancedBreadcrumb({ folder, onNavigate, className = "" }) {
  const [path, setPath] = useState([]);
  
  useEffect(() => {
    if (folder) {
      // In a real app, you would fetch the full path here
      // For now, we'll just use the current folder
      setPath([folder]);
    } else {
      setPath([]);
    }
  }, [folder]);

  return (
    <Breadcrumb className={`mb-4 ${className}`}>
      <BreadcrumbItem>
        <BreadcrumbLink 
          onClick={() => onNavigate(null)} 
          className="flex items-center gap-1 hover:text-primary transition-colors"
        >
          <FolderIcon size={14} />
          <span>Root</span>
        </BreadcrumbLink>
      </BreadcrumbItem>
      
      {path.map((item, i) => (
        <React.Fragment key={item._id || i}>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink 
              onClick={() => onNavigate(item)}
              className={`hover:text-primary transition-colors ${i === path.length - 1 ? "font-medium" : ""}`}
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
/* Status tab view with filtering                                     */
/* ------------------------------------------------------------------ */
function StatusTabs({ setCurrentDoc, closeDrawer, refreshTrigger }) {
  const [tabFiles, setTabFiles] = useState({
    inProgress: [],
    review: [],
    completed: []
  });
  const [loading, setLoading] = useState({
    inProgress: false,
    review: false,
    completed: false
  });
  const [sortOrder, setSortOrder] = useState("newest");
  
  const loadTabFiles = async (status) => {
    setLoading(prev => ({ ...prev, [status]: true }));
    try {
      // Convert UI status key to actual status value
      const statusMap = {
        "inProgress": "In Progress",
        "review": "Review",
        "completed": "Completed"
      };
      
      const actualStatus = statusMap[status];
      
      // Call the API to get files by status
      const response = await api.getFilesByStatus(actualStatus);
      setTabFiles(prev => ({ ...prev, [status]: response.files || [] }));
    } catch (error) {
      console.error(`Error loading ${status} files:`, error);
    } finally {
      setLoading(prev => ({ ...prev, [status]: false }));
    }
  };

  const handleTabChange = (value) => {
    loadTabFiles(value);
  };

  // Load initial files when the component mounts or refreshTrigger changes
  useEffect(() => {
    loadTabFiles("inProgress");
    loadTabFiles("review");
    loadTabFiles("completed");
  }, [refreshTrigger]);

  const sortFiles = (files) => {
    if (sortOrder === "newest") {
      return [...files].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    } else if (sortOrder === "oldest") {
      return [...files].sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt));
    } else if (sortOrder === "name") {
      return [...files].sort((a, b) => a.fileName.localeCompare(b.fileName));
    }
    return files;
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="inProgress" className="w-full" onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="inProgress" className="flex items-center gap-1">
            <Clock size={14} />
            <span>Progress</span>
          </TabsTrigger>
          <TabsTrigger value="review" className="flex items-center gap-1">
            <CircleDot size={14} />
            <span>Review</span>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-1">
            <CheckCircle2 size={14} />
            <span>Done</span>
          </TabsTrigger>
        </TabsList>
        
        {/* Sort dropdown */}
        <div className="mb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1 w-full justify-between">
                <span>Sort by: {sortOrder === "newest" ? "Newest" : sortOrder === "oldest" ? "Oldest" : "Name"}</span>
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-full">
              <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("name")}>
                Name (A-Z)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        <TabsContent value="inProgress" className="mt-0">
          <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-2">
            {loading.inProgress ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin mr-2" size={16} />
                <span>Loading...</span>
              </div>
            ) : (
              <>
                {sortFiles(tabFiles.inProgress).map(file => (
                  <div
                    key={file._id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1 transition-colors"
                    onClick={async () => {
                      const { file: loaded } = await api.load(file._id);   // GET /api/files?id=...
                      setCurrentDoc({ ...loaded, pdf: loaded.pdf });
                      if (typeof closeDrawer === 'function') {
                        closeDrawer();
                      }
                    }}
                  >
                    <Clock size={16} className="text-amber-500" />
                    <div className="truncate flex-1">{file.fileName}</div>
                    {file.updatedAt && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
                {tabFiles.inProgress.length === 0 && (
                  <div className="text-center p-4 text-muted-foreground">
                    No documents in progress
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="review" className="mt-0">
          <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-2">
            {loading.review ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin mr-2" size={16} />
                <span>Loading...</span>
              </div>
            ) : (
              <>
                {sortFiles(tabFiles.review).map(file => (
                  <div
                    key={file._id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1 transition-colors"
                    onClick={async () => {
                      const { file: loaded } = await api.load(file._id);   // GET /api/files?id=...
                      setCurrentDoc({ ...loaded, pdf: loaded.pdf });
                      if (typeof closeDrawer === 'function') {
                        closeDrawer();
                      }
                    }}
                  >
                    <CircleDot size={16} className="text-blue-500" />
                    <div className="truncate flex-1">{file.fileName}</div>
                    {file.updatedAt && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
                {tabFiles.review.length === 0 && (
                  <div className="text-center p-4 text-muted-foreground">
                    No documents in review
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </TabsContent>
        
        <TabsContent value="completed" className="mt-0">
          <ScrollArea className="h-[calc(100vh-250px)] border rounded-md p-2">
            {loading.completed ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin mr-2" size={16} />
                <span>Loading...</span>
              </div>
            ) : (
              <>
                {sortFiles(tabFiles.completed).map(file => (
                  <div
                    key={file._id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1 transition-colors"
                    onClick={async () => {
                      const { file: loaded } = await api.load(file._id);   // GET /api/files?id=...
                      setCurrentDoc({ ...loaded, pdf: loaded.pdf });
                      if (typeof closeDrawer === 'function') {
                        closeDrawer();
                      }
                    }}
                  >
                    <CheckCircle2 size={16} className="text-green-500" />
                    <div className="truncate flex-1">{file.fileName}</div>
                    {file.updatedAt && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(file.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
                {tabFiles.completed.length === 0 && (
                  <div className="text-center p-4 text-muted-foreground">
                    No completed documents
                  </div>
                )}
              </>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Enhanced navigator with tabs                                       */
/* ------------------------------------------------------------------ */
function EnhancedNavigator({ currentFolder, setCurrentFolder, setCurrentDoc, closeDrawer, refreshTrigger, triggerRefresh }) {
  const [view, setView] = useState("folders"); // "folders" or "status"
  const [rootFolders, setRootFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [folderRefreshTrigger, setFolderRefreshTrigger] = useState(0);
  const inputRef = useRef();
  const router = useRouter();

  /* Load root folders on mount and when refresh is triggered */
  useEffect(() => {
    api.folders().then(({ folders }) => setRootFolders(folders || []));
  }, [folderRefreshTrigger, refreshTrigger]);

  /* Load files when folder changes */
  useEffect(() => {
    if (currentFolder) {
      api.files(currentFolder._id).then(({ files }) => setFiles(files || []));
    } else if (view === "folders") {
      api.files().then(({ files }) => setFiles(files || []));
    }
  }, [currentFolder, view, folderRefreshTrigger, refreshTrigger]);

  const handleCreateFolder = async (name) => {
    if (!name) return;
    
    try {
      await api.newFolder(name, currentFolder?._id);
      // Refresh folder list to show the new folder
      setFolderRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error creating folder:", error);
    }
  };

  const handleUpdateFolder = async (id, name) => {
    if (!id || !name) return;
    
    try {
      await api.updateFolder(id, name);
      // Refresh folder list
      setFolderRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error updating folder:", error);
    }
  };

  const handleDeleteFolder = async (id) => {
    if (!id) return;
    
    try {
      await api.deleteFolder(id);
      // If we're deleting the current folder, navigate back to parent
      if (currentFolder && currentFolder._id === id) {
        setCurrentFolder(null);
      }
      // Refresh folder list
      setFolderRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error("Error deleting folder:", error);
    }
  };

  const handleFileUpload = () => inputRef.current?.click();
  
  const onFilesSelected = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    
    setUploading(true);
    try {
      for (const f of list) {
        await api.upload(f, currentFolder?._id);
      }
      // Refresh file list
      if (triggerRefresh) {
        triggerRefresh();
      } else {
        setFolderRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setUploading(false);
    }
  };

  /* Handle drag and drop file upload */
  const handleFileDrop = async (e) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (!items) return;
    const queue = [];

    const walk = async (entry) => {
      if (entry.isFile) {
        const f = await new Promise((res) => entry.file(res));
        queue.push(f);
      } else if (entry.isDirectory) {
        const r = entry.createReader();
        const ents = await new Promise((res) => r.readEntries(res));
        await Promise.all(ents.map(walk));
      }
    };

    for (const i of items) {
      const ent = i.webkitGetAsEntry?.();
      if (ent) await walk(ent);
    }
    
    if (!queue.length) return;
    
    setUploading(true);
    try {
      for (const f of queue) {
        await api.upload(f, currentFolder?._id);
      }
      // Refresh file list
      if (triggerRefresh) {
        triggerRefresh();
      } else {
        setFolderRefreshTrigger(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
    } finally {
      setUploading(false);
    }
  };

  const goToHome = () => {
    router.push('/home');
  };

  const renderFilesList = () => {
    if (searchResults) {
      return (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm">Search Results</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSearchResults(null)}
              className="h-6 text-xs"
            >
              Clear
            </Button>
          </div>
          
          <ScrollArea className="h-[calc(100vh-280px)]">
            {searchResults.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                No results found
              </div>
            ) : (
              searchResults.map((file) => (
                <div
                  key={file._id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded p-2 mb-1"
                  onClick={async () => {
                    const { file: loadedFile } = await api.load(file._id);
                    setCurrentDoc({ ...loadedFile, pdf: loadedFile.pdf });
                    if (typeof closeDrawer === 'function') {
                      closeDrawer();
                    }
                  }}
                >
                  <FileIcon size={16} />
                  <span className="truncate flex-1">{file.fileName}</span>
                  {file.status && (
                    <Badge variant="outline" className="text-xs">
                      {file.status}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </ScrollArea>
        </div>
      );
    }
    
    return null;
  };

  const handleTabChange = (newView) => {
    setView(newView);
    setSearchResults(null);
  };

  return (
    <div className="flex flex-col h-full">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept="application/pdf"
        onChange={onFilesSelected}
      />
      
      {/* Home button and search bar */}
      <div className="px-2 pt-2">
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="outline"
            size="sm" 
            className="flex items-center gap-1"
            onClick={goToHome}
          >
            <Home size={14} />
            <span>Home</span>
          </Button>
          
          <div className="flex-1">
            <FileSearch onSearchResults={setSearchResults} />
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="px-2 overflow-x-auto">
        <div className="flex space-x-1 border-b mb-2">
          <Button 
            variant={view === "folders" ? "default" : "ghost"}
            size="sm" 
            className="flex items-center gap-1 rounded flex-1"
            onClick={() => handleTabChange("folders")}
          >
            <FolderIcon size={14} />
            <span>Files</span>
          </Button>
          <Button 
            variant={view === "status" ? "default" : "ghost"}
            size="sm" 
            className="flex items-center gap-1 rounded flex-1"
            onClick={() => handleTabChange("status")}
          >
            <CheckCircle2 size={14} />
            <span>Status</span>
          </Button>
        </div>
      </div>
      
      {/* Main content based on selected tab */}
      <div className="flex-1 overflow-hidden px-2" onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
        {/* Show search results if available */}
        {renderFilesList()}
        
        {!searchResults && view === "folders" && (
          <div className="h-full flex flex-col">
            {/* Breadcrumb */}
            <EnhancedBreadcrumb 
              folder={currentFolder} 
              onNavigate={setCurrentFolder} 
              className="text-sm"
            />
            
            {/* Action buttons */}
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Folders & Files</h3>
              <div className="flex gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={handleFileUpload} 
                  className="h-8 w-8"
                  title="Upload files"
                >
                  <UploadCloud size={16} />
                </Button>
                
                <CreateFolderDialog 
                  onCreateFolder={handleCreateFolder} 
                  parentFolder={currentFolder}
                />
              </div>
            </div>
            
            {/* Folder tree */}
            <ScrollArea className="flex-grow">
              {rootFolders.map((folder) => (
                <FolderNode
                  key={folder._id}
                  node={folder}
                  onSelect={setCurrentFolder}
                  currentFolder={currentFolder}
                  onFileSelect={async (file) => {
                    const { file: loadedFile } = await api.load(file._id);
                    setCurrentDoc({ ...loadedFile, pdf: loadedFile.pdf });
                    if (typeof closeDrawer === 'function') {
                      closeDrawer();
                    }
                  }}
                  onFolderUpdate={handleUpdateFolder}
                  onFolderDelete={handleDeleteFolder}
                  refreshFolders={folderRefreshTrigger}
                />
              ))}
              
              {/* Root level files */}
              {!currentFolder && files.length > 0 && (
                <div className="mt-2 border-t pt-2">
                  <h4 className="font-medium text-sm mb-1 pl-2">Root Files</h4>
                  {files.map((file) => (
                    <FileItem
                      key={file._id}
                      file={file}
                      onSelect={async () => {
                        const { file: loadedFile } = await api.load(file._id);
                        setCurrentDoc({ ...loadedFile, pdf: loadedFile.pdf });
                        if (typeof closeDrawer === 'function') {
                          closeDrawer();
                        }
                      }}
                      onStatusChange={async (fileId, status) => {
                        await api.updateFileStatus(fileId, status);
                        // Refresh file list to reflect status change
                        if (triggerRefresh) {
                          triggerRefresh();
                        } else {
                          setFolderRefreshTrigger(prev => prev + 1);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
              
              {rootFolders.length === 0 && files.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderPlus size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No folders or files yet</p>
                  <p className="text-sm">Create a folder or upload files to get started</p>
                </div>
              )}
              
              {/* Upload status */}
              {uploading && (
                <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-md flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} />
                  <span>Uploading files...</span>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
        
        {!searchResults && view === "status" && (
          <StatusTabs 
            setCurrentDoc={setCurrentDoc} 
            closeDrawer={closeDrawer}
            refreshTrigger={refreshTrigger}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main file browser component                                        */
/* ------------------------------------------------------------------ */
export default function FileBrowser() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currFolder, setCurrFolder] = useState(null);
  const [currDoc, setCurrDoc] = useState(null);
  const [isDraw, setIsDraw] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Create refs to hold the undo and save functions
  const undoRef = useRef(null);
  const saveRef = useRef(null);

  // Function to refresh files
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      {/* Side drawer for mobile devices */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-[85vw] sm:max-w-md p-0">
          <SheetHeader className="border-b px-4 py-2">
            <SheetTitle>Document Explorer</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-[calc(100%-53px)]">
            <EnhancedNavigator
              currentFolder={currFolder}
              setCurrentFolder={setCurrFolder}
              setCurrentDoc={setCurrDoc}
              closeDrawer={() => setDrawerOpen(false)}
              refreshTrigger={refreshTrigger}
              triggerRefresh={triggerRefresh}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop layout with sidebar */}
      <div className="hidden md:flex h-screen">
        <div className="w-80 border-r">
          <EnhancedNavigator
            currentFolder={currFolder}
            setCurrentFolder={setCurrFolder}
            setCurrentDoc={setCurrDoc}
            refreshTrigger={refreshTrigger}
            triggerRefresh={triggerRefresh}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {currDoc ? (
            <PDFEditor
              doc={currDoc}
              isDraw={isDraw}
              setIsDraw={setIsDraw}
              onUndo={undoRef}
              onSave={saveRef}
              refreshFiles={triggerRefresh}
              setCurrentDoc={setCurrDoc}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30">
              <div className="text-center max-w-md mx-auto p-6">
                <FileIcon size={48} className="mx-auto mb-4 opacity-40" />
                <h3 className="text-xl font-medium mb-2">No document selected</h3>
                <p className="mb-4">Select a file from the sidebar to preview and edit it</p>
                <p className="text-sm">You can upload files by dragging them to the sidebar or using the upload button</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden h-screen overflow-hidden flex flex-col">
                        {/* Mobile toolbar */}
        
                        {!currDoc && (
    <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setDrawerOpen(true)}
          title="Menu"
        >
          <Menu size={18} />
        </Button>
        <span className="font-medium text-sm truncate max-w-[60vw]">
          Document Explorer
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        Tap <Menu className="inline h-3 w-3" /> to browse files
      </div>
    </div>
  )}

  {/* Mobile content area */}
  <div className="flex-1 overflow-hidden">
    {currDoc ? (
      <PDFEditor
        doc={currDoc}
        mobileModeActive={true}
        isDraw={isDraw}
        setIsDraw={setIsDraw}
        onUndo={undoRef}
        onSave={saveRef}
        onToggleDrawer={() => setDrawerOpen(true)}
        refreshFiles={triggerRefresh}
        setCurrentDoc={setCurrDoc}
      />
    ) : (
      <div className="h-full flex items-center justify-center text-center text-muted-foreground">
        <div className="p-4">
          <FileIcon size={32} className="mx-auto mb-3 opacity-40" />
          <h3 className="font-medium mb-1">No document selected</h3>
          <p className="text-sm mb-3">Open the menu to select a file</p>
          <Button size="sm" onClick={() => setDrawerOpen(true)} className="mx-auto">
            Browse Files
          </Button>
        </div>
      </div>
    )}
  </div>
</div>
    </>
  );
}