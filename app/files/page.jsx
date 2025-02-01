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
} from "lucide-react";
import PDFAnnotator from "@/components/PDFAnnotator";

/**
 * This page:
 * - Lists folders/files from Dropbox
 * - Lets you select a file to display in <PDFAnnotator>
 * - Keeps a dictionary { [filePath]: annotationArray } so each file has its own scribbles
 * - "Save Draft" => Moves the file to In Progress
 * - "Submit" => Flatten scribbles into final PDF in Completed + Audit
 */
export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("production");

  // Dictionary of annotations keyed by file path
  const [annotationsByFile, setAnnotationsByFile] = useState({});

  useEffect(() => {
    fetchFiles(activeTab);
  }, [activeTab]);

  async function fetchFiles(folder) {
    try {
      setLoading(true);
      const res = await fetch(`/api/dropbox?folder=${encodeURIComponent(folder)}`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(file) {
    if (file[".tag"] === "folder") {
      // If folder, load that folder's contents
      await fetchFiles(file.path_lower);
      return;
    }

    // If it's a file, fetch a temporary link to display the PDF
    try {
      const tempRes = await fetch(
        `/api/dropbox/temp?path=${encodeURIComponent(file.path_lower)}`
      );
      if (!tempRes.ok) throw new Error("Failed to get temporary link");
      const tempData = await tempRes.json();

      setSelectedFile({
        ...file,
        content: tempData.link, // direct link for PDFAnnotator
      });
    } catch (err) {
      console.error("Error getting temp link:", err);
    }
  }

  /**
   * Called by <PDFAnnotator> whenever user finishes a stroke or modifies annotations.
   * We store them in a dictionary keyed by file path.
   */
  function handleAnnotationsChange(filePath, newAnnotations) {
    setAnnotationsByFile((prev) => ({
      ...prev,
      [filePath]: newAnnotations,
    }));
  }

  /**
   * Called by <PDFAnnotator> when user clicks "Save Draft" or "Submit"
   */
  async function handleSaveAnnotations(annotations, status) {
    if (!selectedFile) return;

    const filePath = selectedFile.path_lower;

    if (status === "inProgress") {
      // Move from current path -> In Progress
      try {
        const formData = new FormData();
        formData.append("currentPath", filePath); // from
        formData.append("targetFolder", "inProgress"); // to
        formData.append("filename", selectedFile.name);

        const moveRes = await fetch("/api/dropbox", {
          method: "PUT",
          body: formData,
        });
        if (!moveRes.ok) {
          const err = await moveRes.json();
          throw new Error(err.message || "Failed to move file to In Progress");
        }
        fetchFiles(activeTab);
      } catch (err) {
        console.error("Save Draft error:", err);
      }
    } else if (status === "review") {
      // Flatten scribbles => Completed + Audit
      try {
        const patchRes = await fetch("/api/dropbox", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dropboxPath: filePath,
            annotations,
          }),
        });
        if (!patchRes.ok) {
          const e = await patchRes.json();
          throw new Error(e.message || "Failed to flatten PDF");
        }
        fetchFiles(activeTab);
      } catch (error) {
        console.error("Submit error:", error);
      }
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
                    {files.map((file) => (
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

            {/* RIGHT: PDF / Annotator */}
            <Card className="md:col-span-2">
              <CardContent className="p-0 min-h-[600px]">
                {selectedFile ? (
                  <PDFAnnotator
                    file={selectedFile}
                    // Provide any saved annotations for this file
                    initialAnnotations={annotationsByFile[selectedFile.path_lower] || []}
                    // Called once per stroke, so no infinite loop
                    onAnnotationsChange={(anns) =>
                      handleAnnotationsChange(selectedFile.path_lower, anns)
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
