"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileIcon,
  FolderIcon,
  CheckCircleIcon,
  ClockIcon,
  PencilIcon,
  Upload,
  FolderPlus,
} from "lucide-react";
import PDFAnnotator from "@/components/PDFEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("production");
  const [currentPath, setCurrentPath] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);

  // Dictionary of annotations keyed by file path
  const [annotationsByFile, setAnnotationsByFile] = useState({});

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath, activeTab]);

  async function fetchFiles(path) {
    try {
      setLoading(true);
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data.items);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(file) {
    if (file.type === "folder") {
      setCurrentPath(currentPath ? `${currentPath}/${file.name}` : file.name);
      return;
    }

    try {
      // Fetch the full file with PDF data
      const res = await fetch(`/api/files?fileId=${file._id}`);
      if (!res.ok) throw new Error("Failed to fetch file");
      const data = await res.json();
      
      // Convert Buffer to Blob
      const buffer = Buffer.from(data.file.data);
      const blob = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      setSelectedFile({
        ...file,
        content: url,
      });
    } catch (err) {
      console.error("Error getting file:", err);
    }
  }

  async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      formData.append('path', currentPath);
      formData.append('operation', 'upload');

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      fetchFiles(currentPath);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload files');
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;

    try {
      const formData = new FormData();
      formData.append('operation', 'createFolder');
      formData.append('path', currentPath);
      formData.append('name', newFolderName);

      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create folder');

      setNewFolderName('');
      setIsNewFolderDialogOpen(false);
      fetchFiles(currentPath);
    } catch (error) {
      console.error('Create folder error:', error);
      alert('Failed to create folder');
    }
  }

  function handleAnnotationsChange(filePath, newAnnotations) {
    setAnnotationsByFile((prev) => ({
      ...prev,
      [filePath]: newAnnotations,
    }));
  }

  async function handleSaveAnnotations(annotations, status) {
    if (!selectedFile) return;

    try {
      // Create a new version of the PDF with annotations
      const formData = new FormData();
      formData.append('operation', 'upload');
      formData.append('path', status); // Use status as the path ('inProgress' or 'review')
      formData.append('files', annotations); // This should be your annotated PDF file
      
      const response = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to save annotated PDF');
      
      // Refresh the current directory
      fetchFiles(currentPath);
      setSelectedFile(null);
    } catch (error) {
      console.error('Save annotations error:', error);
      alert('Failed to save annotations');
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
          <TabsTrigger value="production">
            <FolderIcon className="mr-2 h-4 w-4" />
            Production
          </TabsTrigger>
          <TabsTrigger value="inProgress">
            <ClockIcon className="mr-2 h-4 w-4" />
            In Progress
          </TabsTrigger>
          <TabsTrigger value="review">
            <PencilIcon className="mr-2 h-4 w-4" />
            Ready for Review
          </TabsTrigger>
          <TabsTrigger value="completed">
            <CheckCircleIcon className="mr-2 h-4 w-4" />
            Completed
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* LEFT: file list */}
            <Card className="md:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Files</CardTitle>
                <div className="flex space-x-2">
                  <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <FolderPlus className="h-4 w-4" />
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
                    <Button variant="outline" size="icon">
                      <Upload className="h-4 w-4" />
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
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentPath && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => {
                          const newPath = currentPath.split('/').slice(0, -1).join('/');
                          setCurrentPath(newPath);
                        }}
                      >
                        <FolderIcon className="mr-2 h-4 w-4" />
                        ..
                      </Button>
                    )}
                    {files.map((file) => (
                      <Button
                        key={file._id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleFileSelect(file)}
                      >
                        {file.type === "folder" ? (
                          <FolderIcon className="mr-2 h-4 w-4" />
                        ) : (
                          <FileIcon className="mr-2 h-4 w-4" />
                        )}
                        {file.name}
                      </Button>
                    ))}
                    {files.length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        No files found in this folder
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* RIGHT: PDF / Annotator */}
            <Card className="md:col-span-2">
              <CardContent className="p-0 min-h-[600px]">
                {selectedFile ? (
                  <PDFAnnotator
                    file={selectedFile}
                    initialAnnotations={annotationsByFile[selectedFile._id] || []}
                    onAnnotationsChange={(anns) =>
                      handleAnnotationsChange(selectedFile._id, anns)
                    }
                    onSave={handleSaveAnnotations}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Select a file to view
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
}