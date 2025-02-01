// app/files/page.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileIcon, FolderIcon, CheckCircleIcon, ClockIcon, PencilIcon } from "lucide-react";
import PDFAnnotator from '@/components/PDFAnnotator';

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('production');
  
  useEffect(() => {
    // Initially load files from the preset folder (e.g. "production")
    fetchFiles(activeTab);
  }, [activeTab]);

  async function fetchFiles(folder) {
    try {
      setLoading(true);
      const response = await fetch(`/api/dropbox?folder=${encodeURIComponent(folder)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(file) {
    // If the item is a folder, update the file list using the folder’s full path.
    if (file[".tag"] === "folder") {
      await fetchFiles(file.path_lower);
      return;
    }
  
    // If it's a file, instead of calling the download endpoint,
    // fetch a temporary link so that the PDF can be rendered.
    try {
      const tempRes = await fetch(`/api/dropbox/temp?path=${encodeURIComponent(file.path_lower)}`);
      if (!tempRes.ok) {
        throw new Error('Failed to get temporary link');
      }
      const tempData = await tempRes.json();
      setSelectedFile({
        ...file,
        content: tempData.link
      });
    } catch (error) {
      console.error('Error fetching temporary link:', error);
    }
  }  

  async function handleSaveAnnotations(annotations, status) {
    try {
      const formData = new FormData();
      // For saving, you may need to re-download the original file or
      // pass along the annotations as needed.
      // Here we assume the original file's path is sufficient.
      formData.append('file', selectedFile.content);
      formData.append('currentPath', selectedFile.path_lower);
      formData.append('targetFolder', status);
      formData.append('filename', selectedFile.name);

      const response = await fetch('/api/dropbox', {
        method: 'PUT',
        body: formData
      });
      if (!response.ok) throw new Error('Failed to save file');
      // Refresh the current folder.
      fetchFiles(activeTab);
    } catch (error) {
      console.error('Error saving file:', error);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl mx-auto">
          <TabsTrigger value="production">
            <FolderIcon className="mr-2 h-4 w-4" />
            Production Files
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
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Files</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map(file => (
                      <Button 
                        key={file.id}
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => handleFileSelect(file)}
                      >
                        {file[".tag"] === "folder" ? (
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

            <Card className="md:col-span-2">
              <CardContent className="p-0 min-h-[600px]">
                {selectedFile ? (
                  <PDFAnnotator
                    file={selectedFile}
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
