import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Eraser, Download, Undo, Save, User } from 'lucide-react';

const PDFEditor = ({ doc }) => {
  const [tool, setTool] = useState('pencil');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawings, setDrawings] = useState({});
  const [undoHistory, setUndoHistory] = useState({});
  const [scale, setScale] = useState(1.0);
  const [signatureMode, setSignatureMode] = useState(null); // null, 'operator', 'verifier', 'manager'
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  
  useEffect(() => {
    const resizeCanvas = () => {
      if (canvasRef.current && pdfRef.current) {
        const pdf = pdfRef.current;
        const canvas = canvasRef.current;
        
        // Match canvas size to PDF size
        canvas.width = pdf.clientWidth * 2; // For high DPI
        canvas.height = pdf.clientHeight * 2;
        
        const context = canvas.getContext('2d');
        context.scale(2, 2); // Scale for high DPI
        context.lineCap = 'round';
        context.strokeStyle = tool === 'pencil' ? 'blue' : 'white';
        context.lineWidth = tool === 'pencil' ? 2 : 20;
        contextRef.current = context;
        
        // Restore saved drawings
        if (drawings.current) {
          const img = new Image();
          img.onload = () => {
            context.drawImage(img, 0, 0);
          };
          img.src = drawings.current;
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [tool, drawings, scale]);

  const getMousePos = (canvas, evt) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width * scale);
    const scaleY = canvas.height / (rect.height * scale);
    
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    const { x, y } = getMousePos(canvasRef.current, e);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    
    // Save current state for undo
    const currentDrawing = canvasRef.current.toDataURL();
    setUndoHistory(prev => ({
      ...prev,
      current: [...(prev.current || []), currentDrawing]
    }));
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const { x, y } = getMousePos(canvasRef.current, e);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
    
    // Save current drawing
    const drawing = canvasRef.current.toDataURL();
    setDrawings(prev => ({
      ...prev,
      current: drawing
    }));
  };

  const addSignature = (role) => {
    setSignatureMode(role);
    setTool('pencil');
    // Could add specific colors for different roles
    if (contextRef.current) {
      contextRef.current.strokeStyle = 
        role === 'operator' ? 'blue' :
        role === 'verifier' ? 'green' :
        role === 'manager' ? 'purple' : 'black';
    }
  };

  const handleSave = async () => {
    try {
      const saveData = {
        docId: doc._id,
        drawings: drawings.current,
        lastModified: new Date().toISOString(),
        metadata: {
          signedBy: signatureMode,
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch('/api/docs/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(saveData),
      });

      if (!response.ok) {
        throw new Error('Failed to save annotations');
      }

      // Show success message
      alert('Annotations saved successfully');
    } catch (error) {
      console.error('Error saving annotations:', error);
      alert('Failed to save annotations');
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = `${doc.fileName}-annotated.png`;
    link.href = drawings.current;
    link.click();
  };

  if (!doc?.pdf) {
    return <div>No PDF data found in doc.</div>;
  }

  return (
    <div className="relative">
      <div className="sticky top-0 z-10 bg-white border-b mb-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{doc.fileName}</h2>
            {doc.product?.catalogNumber && (
              <div className="text-sm text-gray-600">
                Catalog # <span className="font-semibold">{doc.product.catalogNumber}</span>
                {doc.product.productName && ` - ${doc.product.productName}`}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Signature Tools */}
            <div className="flex items-center gap-2 border-r pr-4">
              <button
                onClick={() => addSignature('operator')}
                className={`p-2 rounded flex items-center gap-1 ${
                  signatureMode === 'operator' ? 'bg-blue-100' : 'hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-sm">Operator</span>
              </button>
              <button
                onClick={() => addSignature('verifier')}
                className={`p-2 rounded flex items-center gap-1 ${
                  signatureMode === 'verifier' ? 'bg-green-100' : 'hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-sm">Verifier</span>
              </button>
              <button
                onClick={() => addSignature('manager')}
                className={`p-2 rounded flex items-center gap-1 ${
                  signatureMode === 'manager' ? 'bg-purple-100' : 'hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="text-sm">Manager</span>
              </button>
            </div>

            {/* Drawing Tools */}
            <div className="flex items-center gap-2 border-r pr-4">
              <button
                onClick={() => setTool('pencil')}
                className={`p-2 rounded ${tool === 'pencil' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                title="Pencil"
              >
                <Pencil className="w-5 h-5" />
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`p-2 rounded ${tool === 'eraser' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                title="Eraser"
              >
                <Eraser className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (contextRef.current) {
                    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    setDrawings(prev => ({ ...prev, current: null }));
                  }
                }}
                className="p-2 rounded hover:bg-gray-100"
                title="Clear All"
              >
                Clear
              </button>
            </div>

            {/* Save/Download Tools */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                className="p-2 rounded hover:bg-gray-100"
                title="Save"
              >
                <Save className="w-5 h-5" />
              </button>
              <button
                onClick={handleDownload}
                className="p-2 rounded hover:bg-gray-100"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                className="px-2 py-1 rounded hover:bg-gray-100"
              >
                -
              </button>
              <span className="text-sm">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
                className="px-2 py-1 rounded hover:bg-gray-100"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative" ref={containerRef}>
        {/* Native PDF viewer */}
        <embed
          ref={pdfRef}
          src={doc.pdf}
          type="application/pdf"
          className="w-full h-screen"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
        />
        
        {/* Drawing canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-auto"
          style={{ 
            touchAction: 'none',
            opacity: 0.7,
            transform: `scale(${scale})`,
            transformOrigin: 'top left'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
      </div>
    </div>
  );
};

export default PDFEditor;