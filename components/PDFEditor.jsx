"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Menu,
  Pencil,
  Undo,
  Save,
  CheckCircle,
  Printer,
  ChevronLeft,
  ChevronRight,
  SendToBack,
  ArrowRightCircle
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// --- configure worker for react‑pdf ---
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

/* ------------------------------------------------------------------ */
/* Small helper – toolbar button                                      */
/* ------------------------------------------------------------------ */
function Tool({ icon: Icon, label, className = "", ...rest }) {
  return (
    <Button
      size="icon"
      variant="ghost"
      title={label}
      className={className}
      {...rest}
    >
      <Icon size={18} />
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                     */
/* ------------------------------------------------------------------ */
export default function PDFEditor({ 
  doc, 
  onToggleDrawer, 
  mobileModeActive = false,
  isDraw: externalIsDraw,
  setIsDraw: externalSetIsDraw,
  onUndo: externalUndo,
  onSave: externalSave,
  refreshFiles,
  setCurrentDoc
}) {
  /* ---------- state ---------- */
  const [localIsDraw, setLocalIsDraw] = useState(true);
  const isDraw = externalIsDraw !== undefined ? externalIsDraw : localIsDraw;
  const setIsDraw = externalSetIsDraw || setLocalIsDraw;
  const [isDown, setIsDown] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // Track position in history
  const [overlay, setOverlay] = useState(null);
  const [blobUri, setBlobUri] = useState(doc?.pdf);
  const [pages, setPages] = useState(1);
  const [pageNo, setPageNo] = useState(1);
  const [pageReady, setPageReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const pageContainerRef = useRef(null);

  /* ---------- initialize canvas on page rendered ---------- */
  const initializeCanvas = useCallback(() => {
    const container = pageContainerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return; // page not visible yet

    // Use a higher pixel density for better quality drawings
    const scaleFactor = 4; // Higher quality (was 2 before)
    
    // Set the canvas to be higher resolution
    canvas.width = width * scaleFactor;
    canvas.height = height * scaleFactor;
    
    // But keep the display size the same
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    // Reset transform and apply scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scaleFactor, scaleFactor);
    
    ctx.lineCap = "round";
    ctx.lineJoin = "round"; // Smoother corners without using curves
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctxRef.current = ctx;

    // redraw overlay, if any
    if (overlay) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = overlay;
    }
    
    setPageReady(true);
  }, [overlay]);

  /* ---------- keep canvas size in sync with layout changes ---------- */
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const ro = new ResizeObserver(initializeCanvas);
    ro.observe(pageContainerRef.current);
    return () => ro.disconnect();
  }, [initializeCanvas]);
  
  // Expose functions to parent component
  useEffect(() => {
    if (externalUndo) {
      externalUndo.current = undo;
    }
    if (externalSave) {
      externalSave.current = save;
    }
  }, [externalUndo, externalSave]);

  /* ---------- when doc changes ---------- */
  useEffect(() => {
    setBlobUri(doc?.pdf || null);
    setPageNo(1);
    setHistory([]);
    setHistoryIndex(-1);
    setOverlay(null);
    setPageReady(false);
  }, [doc]);

  /* ---------- pointer helpers ---------- */
  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    
    // Handle both mouse and touch events properly
    let pageX, pageY;
    
    // Touch event
    if (e.touches && e.touches.length) {
      pageX = e.touches[0].clientX;
      pageY = e.touches[0].clientY;
    } 
    // Mouse/pointer event
    else if (e.clientX !== undefined) {
      pageX = e.clientX;
      pageY = e.clientY;
    }
    // Fallback (shouldn't happen)
    else {
      return { x: 0, y: 0 };
    }
    
    // Simple relative position - scale is handled by the context
    const x = pageX - rect.left;
    const y = pageY - rect.top;
    
    return { x, y };
  };

  const down = (e) => {
    if (!isDraw || !ctxRef.current || !pageReady) return;
    
    // Must prevent default to stop scrolling on touch devices
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    
    setIsDown(true);
    const p = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(p.x, p.y);
    
    // Save current state before drawing
    if (canvasRef.current) {
      const currentState = canvasRef.current.toDataURL();
      
      // If we're in the middle of the history, truncate
      if (historyIndex >= 0 && historyIndex < history.length - 1) {
        setHistory(history.slice(0, historyIndex + 1));
      }
      
      setHistory(prev => [...prev, currentState]);
      setHistoryIndex(prev => prev + 1);
    }
  };
  
  const move = (e) => {
    if (!isDraw || !isDown || !ctxRef.current || !pageReady) return;
    
    // Prevent default to stop scrolling on touch devices
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    
    const p = getPos(e);
    ctxRef.current.lineTo(p.x, p.y);
    ctxRef.current.stroke();
  };
  
  const up = (e) => {
    if (!isDraw || !ctxRef.current || !pageReady) return;
    
    // Prevent default on touch devices
    if (e && e.preventDefault) e.preventDefault();
    
    // Close the current path but don't start a new one
    ctxRef.current.closePath();
    setIsDown(false);
    
    // Don't reset the overlay on every pen lift - only save to history
    if (canvasRef.current) {
      // We save the current state as our overlay when lifting the pen
      // But we don't redraw it (which would cause a flicker)
      setOverlay(canvasRef.current.toDataURL());
    }
  };

  /* ---------- toolbar handlers ---------- */
  const undo = () => {
    // Ensure we track whether this is mobile mode to handle different undo behaviors
    if (historyIndex <= 0) {
      // Clear canvas if at beginning of history
      if (ctxRef.current && canvasRef.current) {
        // For tablet mode, we want to maintain some history
        if (mobileModeActive) {
          setHistoryIndex(-1);
          setOverlay(null);
          return;
        }
        
        // For desktop mode, we clear everything
        const { width, height } = canvasRef.current.getBoundingClientRect();
        ctxRef.current.clearRect(0, 0, width, height);
        setOverlay(null);
        setHistoryIndex(-1);
      }
      return;
    }
    
    // Go back one step in history
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    
    if (newIndex >= 0) {
      const prevState = history[newIndex];
      setOverlay(prevState);
      
      if (ctxRef.current && canvasRef.current) {
        const { width, height } = canvasRef.current.getBoundingClientRect();
        ctxRef.current.clearRect(0, 0, width, height);
        
        const img = new Image();
        img.onload = () => {
          ctxRef.current.drawImage(img, 0, 0, width, height);
        };
        img.src = prevState;
      }
    } else {
      // Clear canvas if we're back to the beginning
      if (ctxRef.current && canvasRef.current) {
        const { width, height } = canvasRef.current.getBoundingClientRect();
        ctxRef.current.clearRect(0, 0, width, height);
        setOverlay(null);
      }
    }
  };

  const saveVersion = async (newStatus = null) => {
    if (!doc?._id) {
      console.error("No document ID provided");
      return false;
    }
    
    try {
      const payload = {
        overlayPng: overlay,
        actor: "user", // In a real app, this would be the current user
        metadata: {
          page: pageNo
        }
      };
      
      // Create a new version
      const response = await fetch(`/api/files/${doc._id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error("Failed to save version");
      }
      
      // If a status change is requested, update the file status
      if (newStatus) {
        const statusRes = await fetch(`/api/files/${doc._id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        });
        
        if (!statusRes.ok) {
          throw new Error("Failed to update status");
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error saving version:", error);
      return false;
    }
  };

// Updated save method for the PDFEditor component
const save = async (advance = false) => {
  if (!overlay) return alert("No changes to save");
  setIsSaving(true);

  try {
    const isMaster = !doc.status || doc.status === "New";

    let next = doc.status ?? "New";
    if (advance) {
      next =
        next === "New" || next === "In Progress" ? "Review"
        : next === "Review"                       ? "Completed"
        : next;
    }

    const res = await fetch(
      `/api/files/${doc._id}/versions${isMaster ? "?clone=true" : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overlayPng: overlay,
          actor: "user",
          metadata: {
            page: pageNo,
            ...(advance && !isMaster ? { forceStatus: next } : {})
          }
        }),
      }
    );
    if (!res.ok) throw new Error("save failed");
    const { newFile } = await res.json();

    /* reload the fresh PDF so the drawing is baked-in */
    const idToFetch = newFile?._id || doc._id;
    const fresh = await fetch(`/api/files?id=${idToFetch}`).then(r => r.json());
    setCurrentDoc(fresh.file);

    setHistory([]); setHistoryIndex(-1); setOverlay(null);
    refreshFiles?.();
  } catch (e) {
    console.error(e);
    alert("Save error");
  } finally {
    setIsSaving(false);
  }
};

  /* ---------------- LETTER-SIZING helper lives right here ---------- */
  /* -------- helper: return raw bytes (Uint8Array), not a Data-URL -------- */
  const buildLetterPdf = async (srcDataUrl) => {
    const LETTER_W = 612, LETTER_H = 792;

    const srcBytes = Uint8Array.from(
      atob(srcDataUrl.split(",")[1]),
      c => c.charCodeAt(0)
    );
    const srcDoc = await PDFDocument.load(srcBytes);
    const outDoc = await PDFDocument.create();

    const embeds = await outDoc.embedPages(srcDoc.getPages());
    embeds.forEach((ep) => {
      // pick portrait Letter every time
      const PAGE_W = 612, PAGE_H = 792;
    
      // ep.width / ep.height already reflect any rotation
      const scale = Math.min(PAGE_W / ep.width, PAGE_H / ep.height);
      const x = (PAGE_W - ep.width  * scale) / 2;
      const y = (PAGE_H - ep.height * scale) / 2;
    
      const page = outDoc.addPage([PAGE_W, PAGE_H]);   // always portrait
      page.drawPage(ep, { x, y, xScale: scale, yScale: scale });
    });
    return await outDoc.save();        // Uint8Array
  };

  /* -------- toolbar handler -------- */
  const print = async () => {
    // 1. build a Letter-sized PDF *in memory*
    const bytes = await buildLetterPdf(blobUri);

    // 2. create a Blob URL (safe, tiny)
    const url = URL.createObjectURL(
      new Blob([bytes], { type: "application/pdf" })
    );

    // 3. open it in a new tab and wait until *that* tab is ready
    const w = window.open(url, "_blank");
    if (!w) return;                    // popup blocked

    const onLoad = () => {
      w.removeEventListener("load", onLoad);
      w.focus();
      w.print();                       // 4. print after render
      URL.revokeObjectURL(url);        // 5. clean up
    };
    w.addEventListener("load", onLoad);
  };

  // Get the appropriate save button label based on current document status
  const getSaveButtonLabel = () => {
    if (!doc.status || doc.status === "New") {
      return "Save as Draft";
    } else if (doc.status === "In Progress") {
      return "Submit for Review";
    } else if (doc.status === "Review") {
      return "Submit Final";
    } else {
      return "Save Changes";
    }
  };

  // Get the appropriate save button icon based on current document status
  const getSaveButtonIcon = () => {
    if (!doc.status || doc.status === "New" || doc.status === "In Progress") {
      return ArrowRightCircle;
    } else if (doc.status === "Review") {
      return CheckCircle;
    } else {
      return Save;
    }
  };

  /* ------------------------------------------------------------------ */
  /* render                                                             */
  /* ------------------------------------------------------------------ */
  if (!blobUri) return <div className="p-4">No PDF data.</div>;

  const SaveButtonIcon = getSaveButtonIcon();

  const compact = mobileModeActive;

  return (
    <div className="flex flex-col h-full">
      {/* ---------- toolbar (desktop only) ---------- */}
      <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">
                  {/* left section */}
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleDrawer}
              title="Menu"
            >
              <Menu size={18} />
            </Button>
            <div className="flex flex-col">
              <span className="font-semibold text-sm truncate max-w-[40vw]">
                {doc.fileName}
              </span>
              {doc.status && doc.status !== "New" && (
  <Badge
    variant="outline"
    className={`text-xs ${
      doc.status === "In Progress"
        ? "bg-amber-100 text-amber-800"
        : doc.status === "Review"
        ? "bg-blue-100 text-blue-800"
        : doc.status === "Completed"
        ? "bg-green-100 text-green-800"
        : "bg-gray-100 text-gray-800"
    }`}
  >
    {doc.status}
  </Badge>              )}
            </div>
          </div>

          {/* right tools */}
          <div className="flex items-center gap-3">
            <Tool
              icon={Pencil}
              label={isDraw ? "Draw off" : "Draw on"}
              onClick={() => setIsDraw((d) => !d)}
              className={isDraw ? "text-primary bg-primary/10" : ""} 
            />
            <Tool 
              icon={Undo} 
              label="Undo" 
              onClick={undo}
              className={historyIndex < 0 ? "opacity-50" : ""}
              disabled={historyIndex < 0}
            />
{/* plain save */}
<Button
  variant="outline"
  size="sm"
  disabled={!overlay || isSaving}
  onClick={() => save(false)}
>
  {isSaving
    ? (compact ? <Save size={18} className="animate-spin"/> : "Saving…")
    : (compact ? <Save size={18}/>                         : <><Save size={16}/> Save</>)
  }
</Button>
{/* advance workflow */}
<Button
  variant="outline"
  size="sm"
  disabled={!overlay || isSaving}
  onClick={() => save(true)}
  className="flex items-center gap-1"
>
  <SaveButtonIcon size={16}/>
  {!compact && <span>{getSaveButtonLabel()}</span>}
</Button>
            <Tool icon={Printer} label="Print" onClick={print} />
          </div>
        </div>
      
      
      {/* ---------- viewer ---------- */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center">
        <div 
          ref={pageContainerRef}
          className="relative bg-white shadow my-4"
        >
          {/* page nav */}
          {pages > 1 && (
            <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 flex md:flex-col gap-1">
              <Button
                size="icon"
                variant="secondary"
                className="bg-white shadow"
                onClick={() => setPageNo((p) => Math.max(1, p - 1))}
                disabled={pageNo <= 1}
              >
                <ChevronLeft size={18} />
              </Button>
              <div className="hidden md:flex items-center justify-center text-xs bg-white rounded px-2 py-1 shadow">
                {pageNo}/{pages}
              </div>
              <Button
                size="icon"
                variant="secondary"
                className="bg-white shadow"
                onClick={() => setPageNo((p) => Math.min(pages, p + 1))}
                disabled={pageNo >= pages}
              >
                <ChevronRight size={18} />
              </Button>
            </div>
          )} 

          <Document
            file={blobUri}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            loading={<div className="p-10 text-center">Loading PDF...</div>}
            error={<div className="p-10 text-center text-red-500">Error loading PDF</div>}
          >
            <Page
              pageNumber={pageNo}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onRenderSuccess={initializeCanvas}
              loading={<div className="p-10 text-center">Rendering page...</div>}
              error={<div className="p-10 text-center text-red-500">Error rendering page</div>}
            />
          </Document>

          <canvas
            ref={canvasRef}
            className={`absolute inset-0 ${isDraw ? "cursor-crosshair" : "pointer-events-none"}`}
            style={{ 
              touchAction: isDraw ? "none" : "auto"
            }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            onTouchStart={down}
            onTouchMove={move}
            onTouchEnd={up}
          />
        </div>
      </div>
      
      {/* Mobile action buttons (fixed at bottom) */}
      {/* <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">          <Button
            onClick={save}
            disabled={isSaving}
            className="flex items-center gap-1"
          >
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <SaveButtonIcon size={16} />
                <span>{getSaveButtonLabel()}</span>
              </>
            )}
          </Button>
        </div> */}
      
    </div>
  );
}