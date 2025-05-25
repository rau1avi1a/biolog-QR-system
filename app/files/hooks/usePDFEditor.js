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

    /* Get the exact size that the PDF is being rendered at */
    const { width, height } = ctn.getBoundingClientRect();
    
    console.log('Container dimensions:', { width, height });
    
    // Use integer pixel dimensions to avoid sub-pixel rendering issues
    const pixelWidth = Math.round(width);
    const pixelHeight = Math.round(height);
    
    // Set canvas to match the exact container size
    cvs.width  = pixelWidth;
    cvs.height = pixelHeight;
    cvs.style.width  = `${pixelWidth}px`;
    cvs.style.height = `${pixelHeight}px`;

    const ctx = cvs.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Don't scale the context - draw at 1:1 pixel ratio
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth   = 2;
    ctxRef.current  = ctx;

    /* paint existing overlay */
    const o = overlaysRef.current[pageNo];
    if (o) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
      img.src    = o;
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

/* ─────────────────────── SAVE ────────────────────────────────── */
  const save = useCallback(
    async (action = 'save') => {
      const overlays = Object.fromEntries(
        Object.entries(overlaysRef.current).filter(([, png]) => png)
      );
      
      console.log('Saving with overlays:', overlays);
      console.log('Action:', action);
      
      // For rejection, we don't require new overlays - just change status
      if (action === 'reject' && Object.keys(overlays).length === 0) {
        setIsSaving(true);
        try {
          const updateData = { status: 'In Progress' };
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
      
      // For other actions, require overlays
      if (Object.keys(overlays).length === 0) {
        alert('No changes to save'); return;
      }

      // Get canvas and PDF container dimensions for proper scaling
      const canvas = canvasRef.current;
      const container = pageContainerRef.current;
      
      // Get the actual PDF page dimensions from react-pdf
      const pdfPageElement = container?.querySelector('.react-pdf__Page__canvas');
      const pdfDimensions = pdfPageElement ? {
        width: pdfPageElement.width,
        height: pdfPageElement.height,
        displayWidth: pdfPageElement.offsetWidth,
        displayHeight: pdfPageElement.offsetHeight
      } : null;
      
      const canvasDimensions = canvas ? {
        width: canvas.width,
        height: canvas.height,
        displayWidth: canvas.style.width ? parseFloat(canvas.style.width) : canvas.width,
        displayHeight: canvas.style.height ? parseFloat(canvas.style.height) : canvas.height,
        pdfDimensions: pdfDimensions
      } : null;

      console.log('Canvas dimensions:', canvasDimensions);
      console.log('PDF element dimensions:', pdfDimensions);

      setIsSaving(true);
      try {
        const isOriginal = !doc.isBatch && !doc.originalFileId;
        
        if (isOriginal) {
          // Original file - create new batch
          console.log('Creating new batch from original file');
          const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
          const { batch } = await api.saveBatchFromEditor(doc._id, {
            overlayPng: firstOverlay,
            annotations: overlays,
            canvasDimensions: canvasDimensions // Pass canvas dimensions for proper scaling
          }, action);

          console.log('Created batch:', batch);

          // Load the newly created batch and switch to it
          const { batch: loadedBatch } = await api.getBatch(batch._id);
          console.log('Loaded batch:', loadedBatch);
          
          setCurrentDoc({
            ...loadedBatch,
            pdf: loadedBatch.pdf || doc.pdf, // Use baked PDF if available, fallback to original
            isBatch: true,
            originalFileId: loadedBatch.fileId
          });
          
          // Clear overlays since they're now baked into the PDF
          overlaysRef.current  = {};
          historiesRef.current = {};
          setOverlay(null);
          setHistory([]);
          setHistIdx(-1);
        } else {
          // Existing batch - update it
          console.log('Updating existing batch');
          const firstOverlay = overlays[1] || overlays[Object.keys(overlays)[0]];
          const updateData = {
            overlayPng: firstOverlay,
            annotations: overlays,
            canvasDimensions: canvasDimensions // Pass canvas dimensions for proper scaling
          };

          // Update status based on action
          if (action === 'submit_review') {
            updateData.status = 'Review';
          } else if (action === 'submit_final') {
            updateData.status = 'Completed';
          } else if (action === 'reject') {
            updateData.status = 'In Progress';
            // For rejection, we want to keep the overlay changes
            // The reviewer's markups should be preserved
          }
          // For 'save', keep current status

          const { batch } = await api.updateBatch(doc._id, updateData);
          console.log('Updated batch:', batch);
          
          // Reload the batch to get the updated PDF
          const { batch: reloadedBatch } = await api.getBatch(doc._id);
          
          // Update current doc with new data but keep the view
          setCurrentDoc({
            ...doc,
            ...reloadedBatch,
            pdf: reloadedBatch.pdf || doc.pdf, // Use updated PDF if available
            isBatch: true
          });
          
          // Clear overlays since they're now baked into the PDF
          overlaysRef.current  = {};
          historiesRef.current = {};
          setOverlay(null);
          setHistory([]);
          setHistIdx(-1);
        }

        // Don't reset drawings here anymore - they're cleared above after baking
        refreshFiles?.();
      } catch (err) {
        console.error('Save error:', err);
        alert('Save error: ' + (err.message || 'Unknown error'));
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
    save,
    gotoPage,
    print,
    initCanvas,
    setPages,
  };
}