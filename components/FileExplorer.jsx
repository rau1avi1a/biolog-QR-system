'use client';

import React, { useState, useCallback } from 'react';
import { 
  LayoutGrid, 
  List as ListIcon,
  ChevronRight, 
  Home,
  FolderPlus,
  Upload,
  MoreVertical,
  FileIcon,
  FolderIcon,
  Trash,
  Pencil
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FileExplorer = () => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('name'); // 'name', 'date', 'type'
  const [path, setPath] = useState([]); // Current path as array of folder names
  const [items, setItems] = useState([]); // Files and folders in current directory
  const [newFolderName, setNewFolderName] = useState('');
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Handle file upload
  const handleFileUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('path', path.join('/'));

      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      // Refresh the file list
      fetchCurrentDirectory();
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    }
  }, [path]);

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await fetch('/api/files/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: path.join('/'),
          name: newFolderName,
        }),
      });

      if (!response.ok) throw new Error('Failed to create folder');

      setNewFolderName('');
      setIsNewFolderDialogOpen(false);
      fetchCurrentDirectory();
    } catch (error) {
      console.error('Create folder error:', error);
      alert('Failed to create folder');
    }
  };

  // Fetch current directory contents
  const fetchCurrentDirectory = async () => {
    try {
      const response = await fetch(`/api/files/list?path=${path.join('/')}`);
      if (!response.ok) throw new Error('Failed to fetch directory');
      const data = await response.json();
      setItems(data.items);
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Failed to load directory contents');
    }
  };

  // Delete item (file or folder)
  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return;

    try {
      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: [...path, item.name].join('/'),
          type: item.type,
        }),
      });

      if (!response.ok) throw new Error('Delete failed');
      fetchCurrentDirectory();
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete item');
    }
  };

  // Navigate to folder
  const handleFolderClick = (folderName) => {
    setPath([...path, folderName]);
  };

  // Navigate using breadcrumb
  const handleBreadcrumbClick = (index) => {
    setPath(path.slice(0, index));
  };

  // Handle item selection
  const handleItemClick = (item) => {
    if (item.type === 'folder') {
      handleFolderClick(item.name);
    } else {
      setSelectedItem(item);
    }
  };

  // Render item based on view mode
  const renderItem = (item) => {
    const isFolder = item.type === 'folder';
    const ItemIcon = isFolder ? FolderIcon : FileIcon;

    if (viewMode === 'grid') {
      return (
        <div 
          key={item.name}
          className="relative group p-4 bg-white rounded-lg border hover:border-blue-500 cursor-pointer"
        >
          <div className="flex flex-col items-center">
            <ItemIcon className="w-12 h-12 mb-2 text-blue-600" />
            <span className="text-sm text-center truncate w-full">{item.name}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleDelete(item)}>
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    return (
      <div
        key={item.name}
        className="group flex items-center p-2 hover:bg-gray-100 rounded-md cursor-pointer"
      >
        <ItemIcon className="w-5 h-5 mr-2 text-blue-600" />
        <span className="flex-1 truncate">{item.name}</span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleDelete(item)}>
              <Trash className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Pencil className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-blue-50' : ''}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-blue-50' : ''}
          >
            <ListIcon className="h-4 w-4" />
          </Button>

          <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Folder</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <Input
                  placeholder="Folder name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                />
                <Button onClick={handleCreateFolder}>Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          <label>
            <Button variant="ghost" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
            <input
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              multiple
              accept=".pdf"
            />
          </label>
        </div>
        
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="type">Type</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center p-2 border-b text-sm">
        <Button variant="ghost" size="sm" onClick={() => setPath([])}>
          <Home className="h-4 w-4 mr-1" />
          Home
        </Button>
        {path.map((folder, index) => (
          <React.Fragment key={index}>
            <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => handleBreadcrumbClick(index + 1)}
            >
              {folder}
            </Button>
          </React.Fragment>
        ))}
      </div>

      {/* File/Folder Grid or List */}
      <div className={`flex-1 p-4 overflow-auto ${
        viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' : 'space-y-1'
      }`}>
        {items.map(item => renderItem(item))}
      </div>
    </div>
  );
};

export default FileExplorer;