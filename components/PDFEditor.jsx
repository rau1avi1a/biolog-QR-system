import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Undo, Save, CheckCircle } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

const PDFEditor = ({ doc, onStatusChange }) => {
  // We only use a pencil tool here.
  const [isDrawing, setIsDrawing] = useState(false);
  // “drawings” holds the current canvas drawing as a data URL (PNG).
  const [drawings, setDrawings] = useState(null);
  // Maintain undo history as an array of data URLs.
  const [undoHistory, setUndoHistory] = useState([]);
  // Holds a Base64-encoded PDF that has the drawing “baked in.”
  const [annotatedPdf, setAnnotatedPdf] = useState(doc.pdf);

  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  // We'll wrap the embed in a div so we can measure its dimensions
  const pdfContainerRef = useRef(null);

  // ─────────────────────────────────────────────────────────────
  // 1. Set up or reset the Canvas dimensions
  //    to match the PDF <embed> container.
  // ─────────────────────────────────────────────────────────────
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = pdfContainerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    // Use the container’s client width/height
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Set the canvas’s internal resolution for high-DPI rendering.
    canvas.width = containerWidth * dpr;
    canvas.height = containerHeight * dpr;
    // Display size matches the container.
    canvas.style.width = `${containerWidth}px`;
    canvas.style.height = `${containerHeight}px`;

    const context = canvas.getContext('2d');
    // Reset transform, then scale for dpr.
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.strokeStyle = 'blue';
    context.lineWidth = 2;
    contextRef.current = context;

    // Restore any previously saved drawing onto the canvas.
    if (drawings) {
      const img = new Image();
      img.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, containerWidth, containerHeight);
      };
      img.src = drawings;
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [drawings]);

  useEffect(() => {
    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, [setupCanvas]);

  // ─────────────────────────────────────────────────────────────
  // 2. Utility: getMousePos relative to the canvas
  // ─────────────────────────────────────────────────────────────
  const getMousePos = (canvas, evt) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  };

  // ─────────────────────────────────────────────────────────────
  // 3. Drawing events
  // ─────────────────────────────────────────────────────────────
  const startDrawing = (e) => {
    if (!canvasRef.current || !contextRef.current) return;
    const pos = getMousePos(canvasRef.current, e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);
    setIsDrawing(true);

    // Save the current state for undo.
    const currentDrawing = canvasRef.current.toDataURL();
    setUndoHistory((prev) => [...prev, currentDrawing]);
  };

  const draw = (e) => {
    if (!isDrawing || !contextRef.current) return;
    const pos = getMousePos(canvasRef.current, e);
    contextRef.current.lineTo(pos.x, pos.y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (!contextRef.current || !canvasRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    // Save the updated drawing state.
    const newDrawing = canvasRef.current.toDataURL();
    setDrawings(newDrawing);
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const lastState = undoHistory[undoHistory.length - 1];
    setUndoHistory((prev) => prev.slice(0, -1));
    setDrawings(lastState);

    // Redraw from the undone state.
    if (canvasRef.current && contextRef.current) {
      const dpr = window.devicePixelRatio || 1;
      const container = pdfContainerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;

      canvasRef.current.width = containerWidth * dpr;
      canvasRef.current.height = containerHeight * dpr;
      contextRef.current.scale(dpr, dpr);

      const img = new Image();
      img.onload = () => {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        contextRef.current.drawImage(img, 0, 0, containerWidth, containerHeight);
      };
      img.src = lastState;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 4. “Bake” the drawing into the PDF (client-side)
  //    using pdf-lib, then update local preview as base64 dataURL
  // ─────────────────────────────────────────────────────────────
  const bakeDrawingIntoPdf = async (pdfBase64, drawingBase64) => {
    // If either is missing, skip
    if (!pdfBase64 || !drawingBase64) return pdfBase64;

    try {
      // 1) pdf-lib can read data URIs directly, but let's split
      //    if doc.pdf is "data:application/pdf;base64,JVBER...".
      const base64Data = pdfBase64.split(',')[1];
      const originalPdfBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      // 2) Load the PDF into pdf-lib
      const pdfDoc = await PDFDocument.load(originalPdfBytes);

      // 3) Convert the drawing (PNG) base64 to bytes
      const base64Png = drawingBase64.replace(/^data:image\/png;base64,/, '');
      const pngBytes = Uint8Array.from(atob(base64Png), (c) => c.charCodeAt(0));

      // 4) Embed the PNG in the PDF
      const pngImage = await pdfDoc.embedPng(pngBytes);

      // 5) Draw it onto the first page
      const pages = pdfDoc.getPages();
      if (pages.length < 1) return pdfBase64; // No pages? unexpected
      const page = pages[0];

      // We'll draw the PNG full-page
      const { width, height } = page.getSize();
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width,
        height,
      });

      // 6) Save the PDF directly as a base64 data URI
      const bakedPdfUri = await pdfDoc.saveAsBase64({ dataUri: true });
      return bakedPdfUri;
    } catch (error) {
      console.error('Error baking drawing into PDF:', error);
      throw error;
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 5. Save changes: bake the drawing, then (optionally)
  //    POST the new PDF to the server
  // ─────────────────────────────────────────────────────────────
  const handleSaveChanges = async () => {
    if (!drawings) {
      alert('No drawing found');
      return;
    }

    try {
      // Bake the drawing into the currently displayed PDF
      const bakedPdf = await bakeDrawingIntoPdf(annotatedPdf, drawings);

      // Update our local PDF state so the <embed> displays the annotated PDF
      setAnnotatedPdf(bakedPdf);

      // If you want to store this updated PDF in the server:
      const response = await fetch('/api/docs/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: doc._id,
          updatedPdf: bakedPdf, // The annotated PDF
          status: 'inProgress',
          metadata: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      alert('Changes saved successfully with annotations baked in!');
      const updatedDoc = await response.json();
      if (onStatusChange) onStatusChange(updatedDoc.document.status);
    } catch (error) {
      console.error('Error saving changes:', error);
      alert('Error saving changes');
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 6. Submit changes (similar logic, but might set status)
  // ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Suppose we want to ensure any current drawing is baked before submission
    if (drawings) {
      try {
        const bakedPdf = await bakeDrawingIntoPdf(annotatedPdf, drawings);
        setAnnotatedPdf(bakedPdf);
      } catch (error) {
        console.error('Error baking before submit:', error);
      }
    }

    try {
      let newStatus;
      if (doc.status === 'inProgress') {
        newStatus = 'review';
      } else if (doc.status === 'review') {
        newStatus = 'completed';
      } else {
        return;
      }

      const submitData = { docId: doc._id, newStatus };
      const response = await fetch('/api/docs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit document');
      }

      alert(`Document submitted successfully as ${newStatus}`);
      const updatedDoc = await response.json();
      if (onStatusChange) {
        onStatusChange(updatedDoc.document.status);
      }
    } catch (error) {
      console.error('Error submitting document:', error);
      alert('Error submitting document');
    }
  };

  // If the doc doesn’t have a PDF, show a fallback
  if (!doc?.pdf) return <div>No PDF data found in doc.</div>;

  // 7. Determine the label for the Submit button
  let submitButtonLabel = '';
  if (doc.status === 'inProgress') {
    submitButtonLabel = 'Submit for Review';
  } else if (doc.status === 'review') {
    submitButtonLabel = 'Submit Final';
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Render with layout that avoids “cut off” PDF
  //    - Use flex column with a top header and a scrollable main
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* Header */}
      <div
        className="bg-white border-b p-4 flex items-center justify-between"
        style={{ flexShrink: 0 }}
      >
        <h2 className="text-lg font-bold">{doc.fileName}</h2>
        <div className="flex items-center gap-4">
          {/* Pencil is the only tool, so its button is mostly just UI */}
          <button className="p-2 rounded hover:bg-gray-100" title="Pencil">
            <Pencil className="w-5 h-5" />
          </button>
          <button onClick={handleUndo} className="p-2 rounded hover:bg-gray-100" title="Undo">
            <Undo className="w-5 h-5" />
          </button>
          <button onClick={handleSaveChanges} className="p-2 rounded hover:bg-gray-100" title="Save Changes">
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

      {/* Scrollable container for the PDF and canvas overlay */}
      <div style={{ flex: 1, position: 'relative', overflow: 'auto' }}>
        <div
          ref={pdfContainerRef}
          style={{ position: 'relative', width: '100%', minHeight: '100%' }}
        >
          {/* Display the annotated PDF */}
          <embed
            src={annotatedPdf}
            type="application/pdf"
            className="w-full"
            style={{
              display: 'block',
              minHeight: '100vh', // so there's room to scroll if the PDF is tall
            }}
          />
          {/* The canvas overlays the PDF */}
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>
      </div>
    </div>
  );
};

export default PDFEditor;
