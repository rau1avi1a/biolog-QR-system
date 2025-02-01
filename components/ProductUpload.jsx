// components/ProductUploadButton.jsx
"use client";

import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function ProductUploadButton({ onUploadComplete }) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const isCSV = file.type === "text/csv" || 
                 file.name.toLowerCase().endsWith(".csv");

    if (!isCSV) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a valid CSV file.",
        variant: "destructive"
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      console.log("Uploading file:", file.name);

      const response = await fetch("/api/products/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to upload file");
      }

      toast({
        title: "Upload Successful",
        description: `${result.modifiedCount} products updated, ${result.upsertedCount} new products added.`
      });

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      event.target.value = null;
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
        ref={fileInputRef}
        disabled={isUploading}
      />
      <Button
        variant="outline"
        onClick={handleButtonClick}
        disabled={isUploading}
        className="flex items-center gap-2"
      >
        <Upload className="h-4 w-4" />
        {isUploading ? "Uploading..." : "Upload from Netsuite"}
      </Button>
    </>
  );
}