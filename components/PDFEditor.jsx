'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Undo, Save, CheckCircle } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';

// Configure PDF.js worker
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const PDFEditor = ({ doc, onStatusChange }) => {
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState(null);
  const [undoHistory, setUndoHistory] = useState([]);
  const [workingPdf, setWorkingPdf] = useState(null);
  const [pdfDimensions, setPdfDimensions] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const pdfContainerRef = useRef(null);

  // Initialize working PDF
  useEffect(() => {
    if (doc?.pdf) {
      setWorkingPdf(doc.pdf);
      
      // Load the PDF to get its actual dimensions
      const loadPdfDimensions = async () => {
        try {
          const pdfData = doc.pdf.split(',')[1];
          const pdfBytes = Uint8Array.from(atob(pdfData), c => c.charCodeAt(0));
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const page = pdfDoc.getPages()[0];
          const { width, height } = page.getSize();
          setPdfDimensions({ width, height });
        } catch (error) {
          console.error('Error loading PDF dimensions:', error);
        }
      };
      
      loadPdfDimensions();
    }
  }, [doc?.pdf]);

  function onDocumentLoadSuccess({ numPages }) {
    setNumPages(numPages);
    if (pdfContainerRef.current) {
      const { width, height } = pdfContainerRef.current.getBoundingClientRect();
      setPdfDimensions({ width, height });
    }
  }

  // Update scale when PDF dimensions change
  useEffect(() => {
    if (pdfDimensions) {
      setupCanvas();
    }
  }, [pdfDimensions]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfDimensions) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = pdfDimensions.width * dpr;
    canvas.height = pdfDimensions.height * dpr;
    canvas.style.width = `${pdfDimensions.width}px`;
    canvas.style.height = `${pdfDimensions.height}px`;

    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    contextRef.current = context;

    if (drawings) {
      const img = new Image();
      img.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, pdfDimensions.width, pdfDimensions.height);
      };
      img.src = drawings;
    }
  }, [drawings, pdfDimensions]);

  const getMousePos = useCallback((evt) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (evt.clientX - rect.left) * (canvas.width / (rect.width * dpr));
    const y = (evt.clientY - rect.top) * (canvas.height / (rect.height * dpr));
    
    return { x, y };
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (!isDrawMode || !contextRef.current) return;
    const pos = getMousePos(e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);
    setIsDrawing(true);

    if (canvasRef.current) {
      const currentDrawing = canvasRef.current.toDataURL();
      setUndoHistory(prev => [...prev, currentDrawing]);
    }
  }, [isDrawMode, getMousePos]);

  const handlePointerMove = useCallback((e) => {
    if (!isDrawMode || !isDrawing || !contextRef.current) return;
    const pos = getMousePos(e);
    contextRef.current.lineTo(pos.x, pos.y);
    contextRef.current.stroke();
  }, [isDrawMode, isDrawing, getMousePos]);

  const handlePointerUp = useCallback(() => {
    if (!isDrawMode || !contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    
    if (canvasRef.current) {
      const newDrawing = canvasRef.current.toDataURL();
      setDrawings(newDrawing);
    }
  }, [isDrawMode]);

  const toggleDrawMode = () => setIsDrawMode(!isDrawMode);

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const previousState = undoHistory[undoHistory.length - 1];
    setUndoHistory(prev => prev.slice(0, -1));
    setDrawings(previousState);
  };

  const handleSaveChanges = async () => {
    if (!drawings) {
      alert('No drawings to save');
      return;
    }

    try {
      // Create a copy of the original PDF with drawings
      const pdfData = doc.pdf.split(',')[1];
      const pdfBytes = Uint8Array.from(atob(pdfData), c => c.charCodeAt(0));
      const pdfDoc = await PDFDocument.load(pdfBytes);
      
      // Convert drawing to PDF-compatible format
      const drawingData = drawings.split(',')[1];
      const drawingBytes = Uint8Array.from(atob(drawingData), c => c.charCodeAt(0));
      const drawingImage = await pdfDoc.embedPng(drawingBytes);
      
      const page = pdfDoc.getPages()[0];
      const { width, height } = page.getSize();
      
      // Add drawing to the PDF copy
      page.drawImage(drawingImage, {
        x: 0,
        y: 0,
        width,
        height,
      });
      
      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      const base64PDF = `data:application/pdf;base64,${Buffer.from(modifiedPdfBytes).toString('base64')}`;

      const response = await fetch('/api/docs/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: doc._id,
          drawingData: drawings,
          updatedPdf: base64PDF,
          status: 'inProgress',
          metadata: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const result = await response.json();
      
      if (result.document?.pdf?.data) {
        const pdfBlob = new Blob([Buffer.from(result.document.pdf.data)], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        setWorkingPdf(pdfUrl);
      }

      setDrawings(null);
      setUndoHistory([]);
      if (contextRef.current && canvasRef.current) {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }

      alert('Changes saved successfully!');
      if (onStatusChange) {
        onStatusChange(result.document.status);
      }
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error saving changes');
    }
  };

  const handleSubmit = async () => {
    if (drawings) {
      try {
        await handleSaveChanges();
      } catch (error) {
        console.error('Error saving drawings before submit:', error);
        return;
      }
    }

    try {
      const newStatus = doc.status === 'inProgress' ? 'review' : 
                       doc.status === 'review' ? 'completed' : null;
      
      if (!newStatus) return;

      const response = await fetch('/api/docs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: doc._id,
          newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit document');
      }

      const updatedDoc = await response.json();
      alert(`Document submitted successfully as ${newStatus}`);
      if (onStatusChange) {
        onStatusChange(updatedDoc.document.status);
      }
    } catch (error) {
      console.error('Error submitting document:', error);
      alert('Error submitting document');
    }
  };

  if (!doc?.pdf) return <div>No PDF data found in doc.</div>;

  const submitButtonLabel = doc.status === 'inProgress' ? 'Submit for Review' :
                          doc.status === 'review' ? 'Submit Final' : '';

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b p-4 flex items-center justify-between flex-shrink-0">
        <h2 className="text-lg font-bold">{doc.fileName}</h2>
        <div className="flex items-center gap-4">
          <button 
            className={`p-2 rounded ${isDrawMode ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
            onClick={toggleDrawMode}
            title={isDrawMode ? 'Disable Drawing' : 'Enable Drawing'}
          >
            <Pencil className="w-5 h-5" />
          </button>
          <button 
            onClick={handleUndo} 
            className="p-2 rounded hover:bg-gray-100"
            title="Undo"
          >
            <Undo className="w-5 h-5" />
          </button>
          <button 
            onClick={handleSaveChanges} 
            className="p-2 rounded hover:bg-gray-100"
            title="Save Changes"
          >
            <Save className="w-5 h-5" />
          </button>
          {(doc.status === 'inProgress' || doc.status === 'review') && (
            <button
              onClick={handleSubmit}
              className="p-2 rounded hover:bg-gray-100 flex items-center"
              title="Submit"
            >
              <CheckCircle className="w-5 h-5" />
              <span className="ml-1 text-sm">{submitButtonLabel}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-auto bg-gray-100">
        <div
          ref={pdfContainerRef}
          className="relative mx-auto bg-white shadow-lg"
          style={{ 
            width: '850px',
            minHeight: '1100px',
            margin: '2rem auto'
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
              width={850}
              className="mx-auto"
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={<div>Loading page...</div>}
            />
          </Document>
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 ${isDrawMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
            style={{ 
              touchAction: 'none',
              width: '100%',
              height: '100%'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFEditor;