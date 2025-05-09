// app/files/components/usePdfEditorLogic.js
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { api } from '../lib/api';               // ← client fetch helpers

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

    /* size → device-pixel ratio aware */
    const { width, height } = ctn.getBoundingClientRect();
    const scale = window.devicePixelRatio > 2 ? 3 : 2;
    cvs.width  = width  * scale;
    cvs.height = height * scale;
    cvs.style.width  = `${width}px`;
    cvs.style.height = `${height}px`;

    const ctx = cvs.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale, scale);
    ctx.lineCap   = 'round';
    ctx.lineJoin  = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth   = 2;
    ctxRef.current  = ctx;

    /* paint existing overlay */
    const o = overlaysRef.current[pageNo];
    if (o) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
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
    overlaysRef.current  = {};
    historiesRef.current = {};
    setOverlay(null);
    setHistory([]);
    setHistIdx(-1);
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
        const scl = window.devicePixelRatio > 2 ? 3 : 2;
        ctxRef.current.drawImage(
          img,
          0, 0,
          canvasRef.current.width  / scl,
          canvasRef.current.height / scl
        );
      };
      img.src = hist[newIdx];
      overlaysRef.current[pageNo] = hist[newIdx];
      setOverlay(hist[newIdx]);
    } else {
      delete overlaysRef.current[pageNo];
      setOverlay(null);
    }
  }, [histIdx, pageNo]);

/* ─────────────────────── SAVE (→ /api/batches) ────────────────── */
  const save = useCallback(
    async (advance) => {
      const overlays = Object.fromEntries(
        Object.entries(overlaysRef.current).filter(([, png]) => png)
      );
      if (Object.keys(overlays).length === 0) {
        alert('No changes to save'); return;
      }

      setIsSaving(true);
      try {
        /* 1️⃣ create a Batch – server will copy master PDF + store overlays */
        const { batch } = await api.newBatch(doc._id, {
          overlays,
          advanceStatus: advance,
        });

        /* 2️⃣ reload fresh File (server already updated status/meta) */
        const { file } = await api.load(batch.fileId);
        setCurrentDoc(file);

        /* 3️⃣ reset local drawings */
        overlaysRef.current  = {};
        historiesRef.current = {};
        setOverlay(null);
        setHistory([]);
        setHistIdx(-1);
        refreshFiles?.();
      } catch (err) {
        console.error(err);
        alert('Save error');
      } finally {
        setIsSaving(false);
      }
    },
    [doc, refreshFiles, setCurrentDoc]
  );

/* expose undo / save to toolbar refs (if parent passed them) */
  useEffect(() => {
    if (externalUndo)  externalUndo.current  = undo;
    if (externalSave)  externalSave.current  = () => save(false);
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

/* ───────────────────── “print letter” helper (unchanged) ─────── */
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
