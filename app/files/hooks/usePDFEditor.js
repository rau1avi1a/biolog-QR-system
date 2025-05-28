// app/files/hooks/usePDFEditor.js
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { api } from '../lib/api';

export default function usePdfEditorLogic({
  doc,
  refreshFiles,
  setCurrentDoc,
  externalDraw,
  externalSetDraw,
  externalUndo,
  externalSave,
}) {
/* ── draw-mode flag (local or lifted) ───────────────────────────── */
  const [localDraw, setLocalDraw] = useState(true);
  const isDraw    = externalDraw     ?? localDraw;
  const setIsDraw = externalSetDraw ?? setLocalDraw;

/* ── PDF + page state ───────────────────────────────────────────── */
  const [blobUri, setBlobUri]     = useState(doc?.pdf);
  const [pages,   setPages]       = useState(1);
  const [pageNo,  setPageNo]      = useState(1);
  const [pageReady, setPageReady] = useState(false);

/* ── overlay / history refs ────────────────────────────────────── */
  const overlaysRef  = useRef({});      // { 1: dataUrl, 2: … }
  const historiesRef = useRef({});      // { 1: [dataUrl,…] }

  const [overlay, setOverlay] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

/* ── canvas refs ───────────────────────────────────────────────── */
  const canvasRef        = useRef(null);
  const ctxRef           = useRef(null);
  const pageContainerRef = useRef(null);

/* ── misc flags ────────────────────────────────────────────────── */
  const [isDown,   setIsDown]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);

/* ───────────────────── initialise canvas on each page ─────────── */
  const initCanvas = useCallback(() => {
    const ctn = pageContainerRef.current;
    const cvs = canvasRef.current;
    if (!ctn || !cvs) return;

    // Get container size
    const containerRect = ctn.getBoundingClientRect();
    const { width: containerWidth, height: containerHeight } = containerRect;
    
    console.log('Container dimensions:', { containerWidth, containerHeight });
    
    // Find the actual PDF canvas to get the real PDF rendering dimensions
    const pdfCanvas = ctn.querySelector('.react-pdf__Page__canvas');
    if (pdfCanvas) {
      const pdfRect = pdfCanvas.getBoundingClientRect();
      
      console.log('PDF canvas actual dimensions:', { 
        width: pdfRect.width, 
        height: pdfRect.height,
        left: pdfRect.left - containerRect.left,
        top: pdfRect.top - containerRect.top
      });
      
      // Set our overlay canvas to exactly match the PDF canvas
      const pdfWidth = Math.round(pdfRect.width);
      const pdfHeight = Math.round(pdfRect.height);
      const pdfLeft = Math.round(pdfRect.left - containerRect.left);
      const pdfTop = Math.round(pdfRect.top - containerRect.top);
      
      cvs.width = pdfWidth;
      cvs.height = pdfHeight;
      cvs.style.width = `${pdfWidth}px`;
      cvs.style.height = `${pdfHeight}px`;
      cvs.style.position = 'absolute';
      cvs.style.left = `${pdfLeft}px`;
      cvs.style.top = `${pdfTop}px`;
      
      console.log('Canvas positioned to match PDF:', { 
        width: pdfWidth, 
        height: pdfHeight, 
        left: pdfLeft, 
        top: pdfTop 
      });
    } else {
      // Fallback: use full container
      console.log('PDF canvas not found, using full container');
      cvs.width = Math.round(containerWidth);
      cvs.height = Math.round(containerHeight);
      cvs.style.width = `${containerWidth}px`;
      cvs.style.height = `${containerHeight}px`;
      cvs.style.position = 'absolute';
      cvs.style.left = '0px';
      cvs.style.top = '0px';
    }

    const ctx = cvs.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctxRef.current = ctx;

    // Paint existing overlay
    const o = overlaysRef.current[pageNo];
    if (o) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
      img.src = o;
    }
    setPageReady(true);
  }, [pageNo]);

  /* resize observer keeps canvas crisp on window resize */
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const ro = new ResizeObserver(initCanvas);
    ro.observe(pageContainerRef.current);
    return () => ro.disconnect();
  }, [initCanvas]);

  /* reset when user opens another File */
  useEffect(() => {
    setBlobUri(doc?.pdf || null);
    setPageNo(1);
    
    // For batches with baked PDFs, don't restore overlays since they're already in the PDF
    // Only restore overlays if this is an original file or a batch without a signed PDF
    if (doc?.overlays && !doc?.signedPdf) {
      overlaysRef.current = doc.overlays;
      // Set the overlay for page 1 if it exists
      if (doc.overlays[1]) {
        setOverlay(doc.overlays[1]);
        // Initialize history with the saved overlay
        historiesRef.current[1] = [doc.overlays[1]];
        setHistory([doc.overlays[1]]);
        setHistIdx(0);
      } else {
        setOverlay(null);
        setHistory([]);
        setHistIdx(-1);
      }
    } else {
      // Clear overlays for new documents or baked PDFs
      overlaysRef.current  = {};
      historiesRef.current = {};
      setOverlay(null);
      setHistory([]);
      setHistIdx(-1);
    }
    
    setPageReady(false);
  }, [doc]);

/* ─────────────────── drawing helpers ──────────────────────────── */
  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const p = e.touches?.[0] || e;
    return { x: p.clientX - r.left, y: p.clientY - r.top };
  };

  const down = (e) => {
    if (!isDraw || !pageReady) return;
    e.preventDefault();
    setIsDown(true);
    const { x, y } = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  /* 60 fps throttle */
  const lastMove = useRef(0);
  const move = (e) => {
    if (!isDraw || !isDown || !pageReady) return;
    const now = performance.now();
    if (now - lastMove.current < 16) return;
    lastMove.current = now;

    e.preventDefault();
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };

  const up = () => {
    if (!isDraw || !pageReady) return;
    ctxRef.current.closePath();
    setIsDown(false);

    /* snapshot off-thread */
    (window.requestIdleCallback || window.requestAnimationFrame)(() => {
      const snap = canvasRef.current.toDataURL('image/png');
      overlaysRef.current[pageNo] = snap;

      const hist = historiesRef.current[pageNo] ?? [];
      historiesRef.current[pageNo] = [...hist, snap];
      setHistory(historiesRef.current[pageNo]);
      setHistIdx(historiesRef.current[pageNo].length - 1);

      setOverlay(snap);
    });
  };

/* ───────────────────── undo (per-page) ────────────────────────── */
  const undo = useCallback(() => {
    const hist = historiesRef.current[pageNo] ?? [];
    if (!hist.length) return;
    const newIdx = histIdx - 1;
    setHistIdx(newIdx);
    historiesRef.current[pageNo] = hist;
    setHistory(hist);

    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    if (newIdx >= 0) {
      const img = new Image();
      img.onload = () => {
        // No scaling needed since canvas is now 1:1
        const canvas = canvasRef.current;
        ctxRef.current.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = hist[newIdx];
      overlaysRef.current[pageNo] = hist[newIdx];
      setOverlay(hist[newIdx]);
    } else {
      delete overlaysRef.current[pageNo];
      setOverlay(null);
    }
  }, [histIdx, pageNo]);

/* ─────────────────────── SAVE WITH CONFIRMATION SUPPORT ─────────── */
// Updated save function in usePDFEditor.js - Debug version

const save = useCallback(
  async (action = 'save', confirmationData = null) => {
    const overlays = Object.fromEntries(
      Object.entries(overlaysRef.current).filter(([, png]) => png)
    );
    
    // Handle rejection without overlays
    if (action === 'reject') {
      setIsSaving(true);
      try {
        const updateData = { 
          status: 'In Progress',
          wasRejected: true,
          rejectedAt: new Date(),
          rejectionReason: confirmationData?.reason || 'No reason provided'
        };
        
        const { batch } = await api.updateBatch(doc._id, updateData);
        
        setCurrentDoc({
          ...doc,
          ...batch,
          isBatch: true
        });
        
        refreshFiles?.();
      } catch (err) {
        console.error('Rejection error:', err);
        alert('Error during rejection: ' + (err.message || 'Unknown error'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Get canvas dimensions for proper scaling
    const canvas = canvasRef.current;
    const container = pageContainerRef.current;
    const containerRect = container?.getBoundingClientRect();
    
    const canvasDimensions = canvas ? {
      width: canvas.width,
      height: canvas.height,
      displayWidth: containerRect?.width || canvas.offsetWidth,
      displayHeight: containerRect?.height || canvas.offsetHeight,
      containerRect: containerRect
    } : null;

    setIsSaving(true);
    try {
      const isOriginal = !doc.isBatch && !doc.originalFileId;
      
      if (isOriginal) {
        // Original file - create new batch using the editor API
        const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
        
        const editorData = {
          overlayPng: firstOverlay,
          annotations: overlays,
          canvasDimensions: canvasDimensions
        };

        const { batch } = await api.saveBatchFromEditor(
          doc._id,
          editorData,
          action,
          confirmationData
        );
        
        // Switch to the new batch
        setCurrentDoc({
          ...batch,
          pdf: batch.signedPdf ? 
            `data:application/pdf;base64,${batch.signedPdf.data}` : 
            doc.pdf,
          isBatch: true,
          originalFileId: batch.fileId || doc._id
        });
        
      } else {
        // Existing batch - use updateBatch for all actions
        const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
        const updateData = {
          overlayPng: firstOverlay,
          annotations: overlays,
          canvasDimensions: canvasDimensions
        };

        if (action === 'submit_review' && confirmationData) {
          updateData.status = 'Review';
          updateData.submittedForReviewAt = new Date();
          
          // Handle chemical transactions
          if (confirmationData.components?.length > 0) {
            updateData.chemicalsTransacted = true;
            updateData.transactionDate = new Date();
            updateData.confirmedComponents = confirmationData.components;
          }
          
          // Handle solution creation
          if (confirmationData.solutionLotNumber) {
            updateData.solutionCreated = true;
            updateData.solutionLotNumber = confirmationData.solutionLotNumber;
            updateData.solutionCreatedDate = new Date();
            
            // Include solution quantity if provided
            if (confirmationData.solutionQuantity) {
              updateData.solutionQuantity = confirmationData.solutionQuantity;
            }
            if (confirmationData.solutionUnit) {
              updateData.solutionUnit = confirmationData.solutionUnit;
            }
          }
          
        } else if (action === 'complete') {
          updateData.status = 'Completed';
          updateData.completedAt = new Date();
        } else if (action === 'create_work_order') {
          updateData.status = 'In Progress';
          updateData.workOrderCreated = true;
          updateData.workOrderId = `WO-${Date.now()}`;
          updateData.workOrderCreatedAt = new Date();
        }

        const { batch } = await api.updateBatch(doc._id, updateData);
        
        setCurrentDoc({
          ...doc,
          ...batch,
          pdf: batch.signedPdf ? 
            `data:application/pdf;base64,${batch.signedPdf.data}` : 
            doc.pdf,
          isBatch: true
        });
      }

      refreshFiles?.();
      
    } catch (err) {
      console.error('Save error:', err);
      alert('Save error: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  },
  [doc, refreshFiles, setCurrentDoc]
);

/* expose undo / save to toolbar refs (if parent passed them) */
  useEffect(() => {
    if (externalUndo)  externalUndo.current  = undo;
    if (externalSave)  externalSave.current  = () => save('save');
  }, [externalUndo, externalSave, undo, save]);

/* ───────────────────── page navigation ────────────────────────── */
  const gotoPage = (next) => {
    if (next < 1 || next > pages) return;
    setHistIdx(-1);
    setHistory(historiesRef.current[next] ?? []);
    setOverlay(overlaysRef.current[next] ?? null);
    setPageNo(next);
    setPageReady(false);
  };

/* ───────────────────── "print letter" helper (unchanged) ─────── */
  const buildLetterPdf = async (dataUrl) => {
    const [W, H] = [612, 792];
    const bytes  = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const src    = await PDFDocument.load(bytes);
    const out    = await PDFDocument.create();
    const pages  = await out.embedPages(src.getPages());
    pages.forEach(ep => {
      const s = Math.min(W / ep.width, H / ep.height);
      const x = (W - ep.width  * s) / 2;
      const y = (H - ep.height * s) / 2;
      const pg = out.addPage([W, H]);
      pg.drawPage(ep, { x, y, xScale: s, yScale: s });
    });
    return out.save();
  };

  const print = async () => {
    const url = URL.createObjectURL(
      new Blob([await buildLetterPdf(blobUri)], { type: 'application/pdf' })
    );
    const w = window.open(url, '_blank');
    if (!w) return;
    const ready = () => {
      w.removeEventListener('load', ready);
      w.print();
      URL.revokeObjectURL(url);
    };
    w.addEventListener('load', ready);
  };

/* ───────────────────── exports ────────────────────────────────── */
  return {
    /* refs for the component */
    canvasRef,
    pageContainerRef,

    /* state for the UI */
    blobUri,
    pages,
    pageNo,
    isDraw,
    overlay,
    histIdx,
    isSaving,
    pageReady,

    /* callbacks for the UI */
    setIsDraw,
    down,
    move,
    up,
    undo,
    save, // Now supports confirmationData parameter
    gotoPage,
    print,
    initCanvas,
    setPages,
  };
}