import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Undo, Save, CheckCircle } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

const PDFEditor = ({ doc, onStatusChange }) => {
  const [isDrawMode, setIsDrawMode] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState(null);
  const [undoHistory, setUndoHistory] = useState([]);
  const [workingPdf, setWorkingPdf] = useState(null);
  const [pdfDimensions, setPdfDimensions] = useState(null);
  const [scale, setScale] = useState(1);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const pdfContainerRef = useRef(null);
  const embedRef = useRef(null);

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

  // Update scale when PDF embed loads or container size changes
  useEffect(() => {
    const updateScale = () => {
      if (!embedRef.current || !pdfDimensions) return;
      
      const embedWidth = embedRef.current.clientWidth;
      const newScale = embedWidth / pdfDimensions.width;
      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [pdfDimensions]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = embedRef.current;
    if (!canvas || !container || !pdfDimensions || !scale) return;

    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = pdfDimensions.width * scale;
    const scaledHeight = pdfDimensions.height * scale;
    
    // Set canvas dimensions to match scaled PDF size
    canvas.width = scaledWidth * dpr;
    canvas.height = scaledHeight * dpr;
    canvas.style.width = `${scaledWidth}px`;
    canvas.style.height = `${scaledHeight}px`;

    const context = canvas.getContext('2d');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.lineWidth = 2;
    contextRef.current = context;

    // Restore drawings if they exist
    if (drawings) {
      const img = new Image();
      img.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(img, 0, 0, scaledWidth, scaledHeight);
      };
      img.src = drawings;
    } else {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [drawings, pdfDimensions, scale]);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas, scale]);

  const getMousePos = useCallback((canvas, evt) => {
    if (!embedRef.current) return { x: 0, y: 0 };

    // Get all scrollable parents
    const getScrollOffsets = (element) => {
      let offsetX = 0;
      let offsetY = 0;
      let current = element;

      while (current) {
        offsetX += current.scrollLeft || 0;
        offsetY += current.scrollTop || 0;
        current = current.parentElement;
      }
      return { offsetX, offsetY };
    };

    const { offsetX, offsetY } = getScrollOffsets(canvas);
    const pdfRect = embedRef.current.getBoundingClientRect();
    
    // Calculate position relative to the PDF, accounting for scroll
    const x = evt.clientX + offsetX - pdfRect.left;
    const y = evt.clientY + offsetY - pdfRect.top;
    
    return { x, y };
  }, []);

  const startDrawing = useCallback((e) => {
    if (!isDrawMode || !canvasRef.current || !contextRef.current) return;
    const pos = getMousePos(canvasRef.current, e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(pos.x, pos.y);
    setIsDrawing(true);

    const currentDrawing = canvasRef.current.toDataURL();
    setUndoHistory(prev => [...prev, currentDrawing]);
  }, [isDrawMode, getMousePos]);

  const draw = useCallback((e) => {
    if (!isDrawMode || !isDrawing || !contextRef.current) return;
    const pos = getMousePos(canvasRef.current, e);
    contextRef.current.lineTo(pos.x, pos.y);
    contextRef.current.stroke();
  }, [isDrawMode, isDrawing, getMousePos]);

  const stopDrawing = useCallback(() => {
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
      const response = await fetch('/api/docs/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docId: doc._id,
          drawingData: drawings,
          status: 'inProgress',
          metadata: {},
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      const result = await response.json();
      
      // Update working PDF with the one returned from server
      if (result.document?.pdf?.data) {
        const pdfBlob = new Blob([Buffer.from(result.document.pdf.data)], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        setWorkingPdf(pdfUrl);
      }

      // Clear canvas for new drawings
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

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={pdfContainerRef}
          className="relative w-full h-full"
        >
          <embed
            ref={embedRef}
            src={workingPdf || doc.pdf}
            type="application/pdf"
            className="w-full h-full"
            style={{ display: 'block' }}
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 ${isDrawMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
            style={{ 
              touchAction: 'none',
              width: '100%',
              height: '100%'
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