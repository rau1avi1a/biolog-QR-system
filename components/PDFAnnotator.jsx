"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  PenTool,
  Eraser,
  Save,
  CheckSquare,
  Plus,
  Undo,
  RotateCcw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export default function PDFAnnotator({ doc, onUpdateStatus }) {
  const [tool, setTool] = useState("draw");
  const [annotations, setAnnotations] = useState([]);
  const [chemicalData, setChemicalData] = useState({
    chemicals: [],
    pH: "",
  });
  const [showChemicalForm, setShowChemicalForm] = useState(false);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pdfRef = useRef(null);
  const isDrawing = useRef(false);
  const currentPath = useRef([]);

  // Initialize annotations from doc
  useEffect(() => {
    if (doc.currentAnnotations) {
      setAnnotations(doc.currentAnnotations);
    }
  }, [doc]);

  // Handle canvas setup after PDF loads
  const setupCanvas = () => {
    if (!canvasRef.current || !pdfRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const pdf = pdfRef.current;
    
    // Get container dimensions
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Set canvas size
    const canvas = canvasRef.current;
    canvas.width = containerWidth * 2;  // For high DPI
    canvas.height = containerHeight * 2;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);  // Scale for high DPI
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = tool === 'draw' ? 2 : 20;
    ctx.strokeStyle = tool === 'draw' ? '#000000' : '#ffffff';

    redrawCanvas();
  };

  // Handle PDF load
  const handlePDFLoad = () => {
    setIsLoading(false);
    setupCanvas();
  };

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      setupCanvas();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle tool changes
  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth = tool === 'draw' ? 2 : 20;
    ctx.strokeStyle = tool === 'draw' ? '#000000' : '#ffffff';
  }, [tool]);

  const redrawCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    annotations.forEach(annotation => {
      if (!annotation.path || annotation.path.length < 2) return;
      
      ctx.beginPath();
      ctx.moveTo(annotation.path[0][0], annotation.path[0][1]);
      annotation.path.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.stroke();
    });
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const startDrawing = (e) => {
    isDrawing.current = true;
    const { x, y } = getMousePos(e);
    currentPath.current = [[x, y]];
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const { x, y } = getMousePos(e);
    currentPath.current.push([x, y]);
    redrawCanvas();

    // Draw current path
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(currentPath.current[0][0], currentPath.current[0][1]);
    currentPath.current.forEach(([px, py]) => ctx.lineTo(px, py));
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;

    if (currentPath.current.length > 1) {
      const newAnnotation = {
        type: tool,
        path: currentPath.current,
        timestamp: new Date().toISOString()
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    }
    currentPath.current = [];
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
    redrawCanvas();
  };

  const handleClear = () => {
    setAnnotations([]);
    redrawCanvas();
  };

  const handleChemicalSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/docs/annotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: doc._id,
          annotations,
          status: "inProgress",
          metadata: {
            chemicals: chemicalData.chemicals,
            pH: chemicalData.pH,
          },
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      onUpdateStatus("inProgress");
      setShowChemicalForm(false);
    } catch (error) {
      console.error("Error saving:", error);
    }
  };

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex justify-between items-center p-4 border-b bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button
            variant={tool === "draw" ? "default" : "outline"}
            onClick={() => setTool("draw")}
            size="sm"
          >
            <PenTool className="w-4 h-4 mr-2" />
            Draw
          </Button>
          <Button
            variant={tool === "erase" ? "default" : "outline"}
            onClick={() => setTool("erase")}
            size="sm"
          >
            <Eraser className="w-4 h-4 mr-2" />
            Erase
          </Button>
          <Button variant="outline" onClick={handleUndo} size="sm">
            <Undo className="w-4 h-4 mr-2" />
            Undo
          </Button>
          <Button variant="outline" onClick={handleClear} size="sm">
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm w-16 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setScale(s => Math.min(2, s + 0.1))}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>

          {doc.status === "new" && (
            <Sheet open={showChemicalForm} onOpenChange={setShowChemicalForm}>
              <SheetTrigger asChild>
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Chemical Information</SheetTitle>
                </SheetHeader>
                <form onSubmit={handleChemicalSubmit} className="space-y-4 mt-4">
                  {chemicalData.chemicals.map((chemical, index) => (
                    <div key={index} className="space-y-2 pb-4 border-b">
                      <div className="flex justify-between items-center">
                        <Label>Chemical {index + 1}</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setChemicalData(prev => ({
                              ...prev,
                              chemicals: prev.chemicals.filter((_, i) => i !== index)
                            }));
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Input
                        placeholder="Chemical name"
                        value={chemical.name}
                        onChange={(e) => {
                          const newChemicals = [...chemicalData.chemicals];
                          newChemicals[index] = {
                            ...newChemicals[index],
                            name: e.target.value
                          };
                          setChemicalData(prev => ({
                            ...prev,
                            chemicals: newChemicals
                          }));
                        }}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          placeholder="Amount"
                          value={chemical.amount}
                          onChange={(e) => {
                            const newChemicals = [...chemicalData.chemicals];
                            newChemicals[index] = {
                              ...newChemicals[index],
                              amount: e.target.value
                            };
                            setChemicalData(prev => ({
                              ...prev,
                              chemicals: newChemicals
                            }));
                          }}
                        />
                        <Input
                          placeholder="Unit"
                          value={chemical.unit}
                          onChange={(e) => {
                            const newChemicals = [...chemicalData.chemicals];
                            newChemicals[index] = {
                              ...newChemicals[index],
                              unit: e.target.value
                            };
                            setChemicalData(prev => ({
                              ...prev,
                              chemicals: newChemicals
                            }));
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setChemicalData(prev => ({
                        ...prev,
                        chemicals: [
                          ...prev.chemicals,
                          { name: "", amount: "", unit: "" }
                        ]
                      }));
                    }}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Chemical
                  </Button>

                  <div className="space-y-2">
                    <Label>pH Measurement</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="Enter pH value"
                      value={chemicalData.pH}
                      onChange={(e) => setChemicalData(prev => ({
                        ...prev,
                        pH: e.target.value
                      }))}
                    />
                  </div>

                  <SheetFooter>
                    <Button type="submit" className="w-full">
                      Save and Continue
                    </Button>
                  </SheetFooter>
                </form>
              </SheetContent>
            </Sheet>
          )}

          {doc.status === "inProgress" && (
            <Button onClick={() => onUpdateStatus("review")}>
              <CheckSquare className="w-4 h-4 mr-2" />
              Submit for Review
            </Button>
          )}
        </div>
      </div>

      {/* PDF Container */}
      <div className="flex-1 overflow-hidden bg-gray-100 relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        )}
        <div className="h-full w-full relative">
          <embed
            ref={pdfRef}
            src={doc.pdf}
            type="application/pdf"
            className="w-full h-full"
            style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            onLoad={handlePDFLoad}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 cursor-crosshair"
            style={{
              width: '100%',
              height: '100%',
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
    </div>
  );
}