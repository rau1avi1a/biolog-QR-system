"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Pencil, Undo, Save, CheckCircle, Printer } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/**
 * PDFEditor
 * - Renders a single PDF page with annotation/drawing overlay.
 * - Uses onRenderSuccess to measure the final rendered page.
 * - Opens a new tab to print the raw PDF.
 * 
 * Changes:
 * - When doc.status is "new", saving sends newVersion:true,
 *   so the backend will create a copy (DocumentVersion) instead of modifying the mother file.
 * - When pageNumber changes, current drawings and undo history are cleared.
 */
export default function PDFEditor({ doc, onStatusChange }) {
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState(null);
  const [undoHistory, setUndoHistory] = useState([]);
  const [workingPdf, setWorkingPdf] = useState(null); // local copy of doc.pdf
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // Set the base64 PDF if it exists
  useEffect(() => {
    if (doc?.pdf) {
      setWorkingPdf(doc.pdf);
    }
  }, [doc?.pdf]);

  // Clear drawings and undo history when page changes
  useEffect(() => {
    setDrawings(null);
    setUndoHistory([]);
  }, [pageNumber]);

  // Called when the PDF is loaded (all pages)
  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
  }

  /**
   * Called each time a page finishes rendering.
   * Measures the rendered PDF page (from react-pdf) and resizes the overlay canvas to match.
   */
  function handlePageRenderSuccess() {
    // Query for the actual rendered canvas from react-pdf
    const renderedCanvas = document.querySelector(".react-pdf__Page__canvas");
    if (!renderedCanvas) return;

    const { width, height } = renderedCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    const canvas = canvasRef.current;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
    context.lineCap = "round";
    context.strokeStyle = "black";
    context.lineWidth = 2;
    contextRef.current = context;

    // If there are existing drawings, re-draw them
    if (drawings) {
      const img = new Image();
      img.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, width, height);
      };
      img.src = drawings;
    }
  }

  // Helper to get pointer coordinates relative to the canvas
  const getMousePos = useCallback((evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (evt.clientX - rect.left) * (canvas.width / (rect.width * dpr));
    const y = (evt.clientY - rect.top) * (canvas.height / (rect.height * dpr));

    return { x, y };
  }, []);

  // Start drawing
  const handlePointerDown = useCallback(
    (evt) => {
      if (!isDrawMode || !contextRef.current) return;
      setIsDrawing(true);
      const pos = getMousePos(evt);
      contextRef.current.beginPath();
      contextRef.current.moveTo(pos.x, pos.y);

      // Save current canvas state for undo
      if (canvasRef.current) {
        const currentDrawing = canvasRef.current.toDataURL();
        setUndoHistory((prev) => [...prev, currentDrawing]);
      }
    },
    [isDrawMode, getMousePos]
  );

  // Continue drawing
  const handlePointerMove = useCallback(
    (evt) => {
      if (!isDrawMode || !isDrawing || !contextRef.current) return;
      const pos = getMousePos(evt);
      contextRef.current.lineTo(pos.x, pos.y);
      contextRef.current.stroke();
    },
    [isDrawMode, isDrawing, getMousePos]
  );

  // Stop drawing
  const handlePointerUp = useCallback(() => {
    if (!isDrawMode || !contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    if (canvasRef.current) {
      setDrawings(canvasRef.current.toDataURL());
    }
  }, [isDrawMode]);

  // Toggle drawing mode
  const toggleDrawMode = () => setIsDrawMode((prev) => !prev);

  // Undo last stroke
  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const previousState = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, -1));
    setDrawings(previousState);
  };

  /**
   * Save changes – merge overlay into the PDF.
   * If doc.status is "new", include newVersion flag so backend creates a copy.
   */
  const handleSaveChanges = async () => {
    if (!drawings) {
      alert("No drawings to save");
      return;
    }
    try {
      const pdfData = doc.pdf.split(",")[1];
      const pdfBytes = Uint8Array.from(atob(pdfData), (c) => c.charCodeAt(0));
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const drawingData = drawings.split(",")[1];
      const drawingBytes = Uint8Array.from(atob(drawingData), (c) => c.charCodeAt(0));
      const drawingImage = await pdfDoc.embedPng(drawingBytes);

      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();
      page.drawImage(drawingImage, { x: 0, y: 0, width, height });

      const modifiedPdfBytes = await pdfDoc.save();
      const base64PDF = `data:application/pdf;base64,${Buffer.from(modifiedPdfBytes).toString("base64")}`;

      const payload = {
        docId: doc._id,
        drawingData: drawings,
        updatedPdf: base64PDF,
        status: "inProgress",
        metadata: {},
      };

      // If the doc is "new", include a flag so backend creates a version copy
      if (doc.status === "new") {
        payload.newVersion = true;
      }

      const response = await fetch("/api/docs/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to save changes");
      const result = await response.json();

      // Optionally update local PDF if backend returns updated data
      if (result.document?.pdf?.data) {
        const pdfBlob = new Blob([Buffer.from(result.document.pdf.data)], {
          type: "application/pdf",
        });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        setWorkingPdf(pdfUrl);
      }

      // Clear drawings and undo history after saving
      setDrawings(null);
      setUndoHistory([]);
      if (contextRef.current && canvasRef.current) {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      alert("Changes saved successfully!");
      if (onStatusChange) {
        onStatusChange(result.document.status);
      }
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Error saving changes");
    }
  };

  // Submit changes (optionally, after saving)
  const handleSubmit = async () => {
    if (drawings) {
      try {
        await handleSaveChanges();
      } catch (error) {
        console.error("Error saving drawings before submit:", error);
        return;
      }
    }
    try {
      const newStatus =
        doc.status === "inProgress"
          ? "review"
          : doc.status === "review"
          ? "completed"
          : null;
      if (!newStatus) return;
      const response = await fetch("/api/docs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc._id, newStatus }),
      });
      if (!response.ok) throw new Error("Failed to submit document");
      const updatedDoc = await response.json();
      alert(`Document submitted successfully as ${newStatus}`);
      if (onStatusChange) {
        onStatusChange(updatedDoc.document.status);
      }
    } catch (error) {
      console.error("Error submitting document:", error);
      alert("Error submitting document");
    }
  };

  // Print the PDF in a new window
  function handlePrint() {
    const pdfDataUrl = doc.pdf;
    const newTab = window.open("");
    newTab.document.write(`
      <iframe 
        width="100%" 
        height="100%" 
        style="border:none" 
        src="${pdfDataUrl}">
      </iframe>
    `);
  }

  if (!doc?.pdf) {
    return <div>No PDF data found in doc.</div>;
  }

  const submitButtonLabel =
    doc.status === "inProgress"
      ? "Submit for Review"
      : doc.status === "review"
      ? "Submit Final"
      : "";

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div className="bg-white border-b p-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold">{doc.fileName}</h2>
        <div className="flex items-center gap-4">
          <Button variant={isDrawMode ? "default" : "ghost"} onClick={toggleDrawMode} title={isDrawMode ? "Disable Drawing" : "Enable Drawing"}>
            <Pencil className="w-4 h-4 mr-1" />
            {isDrawMode ? "Drawing On" : "Drawing Off"}
          </Button>
          <Button variant="ghost" onClick={handleUndo} title="Undo">
            <Undo className="w-4 h-4 mr-1" />
            Undo
          </Button>
          <Button variant="ghost" onClick={handleSaveChanges} title="Save Changes">
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
          {(doc.status === "inProgress" || doc.status === "review") && (
            <Button variant="ghost" onClick={handleSubmit} title="Submit">
              <CheckCircle className="w-4 h-4 mr-1" />
              {submitButtonLabel}
            </Button>
          )}
          <Button variant="ghost" onClick={handlePrint} title="Print PDF">
            <Printer className="w-4 h-4 mr-1" />
            Print PDF
          </Button>
        </div>
      </div>

      {/* PDF and Canvas Wrapper */}
      <div className="flex-1 relative overflow-auto bg-gray-100">
        <div className="flex justify-center py-8">
          <div
            className="pdf-print-area relative bg-white shadow-lg"
            style={{
              width: "850px",
              minHeight: "1100px",
              display: "inline-block",
              margin: "0 auto",
            }}
          >
            <Document
              file={workingPdf || doc.pdf}
              onLoadSuccess={onDocumentLoadSuccess}
              className="absolute inset-0"
              loading={<div className="text-center py-4">Loading PDF...</div>}
              error={<div className="text-center py-4 text-red-500">Error loading PDF!</div>}
            >
              <Page
                pageNumber={pageNumber}
                onRenderSuccess={handlePageRenderSuccess}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </Document>
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 ${isDrawMode ? "cursor-crosshair" : "pointer-events-none"}`}
              style={{ touchAction: "none", width: "100%", height: "100%" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
