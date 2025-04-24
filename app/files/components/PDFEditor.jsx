// app/files/components/PDFEditor.jsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Menu, Pencil, Undo, Save, CheckCircle, Printer,
  ChevronLeft, ChevronRight, ArrowRightCircle
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/* tiny helper */
const Tool = ({ icon: Icon, label, ...rest }) => (
  <Button size="icon" variant="ghost" title={label} {...rest}>
    <Icon size={18} />
  </Button>
);

export default function PDFEditor({
  doc,
  onToggleDrawer,
  mobileModeActive = false,
  isDraw: extDraw,
  setIsDraw: extSetDraw,
  onUndo: extUndo,
  onSave: extSave,
  refreshFiles,
  setCurrentDoc
}) {
  /* ─── per-component state ─── */
  const [localDraw, setLocalDraw] = useState(true);
  const isDraw    = extDraw   ?? localDraw;
  const setIsDraw = extSetDraw ?? setLocalDraw;

  const [blobUri, setBlobUri]       = useState(doc?.pdf);
  const [pages, setPages]           = useState(1);
  const [pageNo, setPageNo]         = useState(1);
  const [pageReady, setPageReady]   = useState(false);

  /* overlay / history per page */
  const overlaysRef = useRef({});               // { pageNum: dataURL }
  const [overlay, setOverlay]   = useState(null);

  const historiesRef = useRef({});              // { pageNum: [dataURL,…] }
  const [history,  setHistory]  = useState([]);
  const [histIdx,  setHistIdx]  = useState(-1);

  const [isDown,   setIsDown]   = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canvasRef        = useRef(null);
  const ctxRef           = useRef(null);
  const pageContainerRef = useRef(null);

  /* ───────────────── helpers ───────────────── */
  const initCanvas = useCallback(() => {
    const ctn = pageContainerRef.current;
    const cvs = canvasRef.current;
    if (!ctn || !cvs) return;
    const { width, height } = ctn.getBoundingClientRect();
    const scale = 4;
    cvs.width  = width  * scale;
    cvs.height = height * scale;
    cvs.style.width  = `${width}px`;
    cvs.style.height = `${height}px`;

    const ctx = cvs.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctxRef.current = ctx;

    /* draw overlay for this page (if any) */
    const o = overlaysRef.current[pageNo];
    if (o) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = o;
    }
    setPageReady(true);
  }, [pageNo]);

  /* keep size in sync */
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const ro = new ResizeObserver(initCanvas);
    ro.observe(pageContainerRef.current);
    return () => ro.disconnect();
  }, [initCanvas]);

  /* reset when doc changes */
  useEffect(() => {
    setBlobUri(doc?.pdf || null);
    setPageNo(1);
    overlaysRef.current = {};
    historiesRef.current = {};
    setOverlay(null);
    setHistory([]);
    setHistIdx(-1);
    setPageReady(false);
  }, [doc]);

  /* pointer helpers */
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

    const snap = canvasRef.current.toDataURL();
    const hist = historiesRef.current[pageNo] ?? [];
    const curIdx = histIdx + 1;
    historiesRef.current[pageNo] = [...hist.slice(0, curIdx), snap];
    setHistory(historiesRef.current[pageNo]);
    setHistIdx(curIdx);
  };
  const move = (e) => {
    if (!isDraw || !isDown || !pageReady) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
  };
  const up = () => {
    if (!isDraw || !pageReady) return;
    ctxRef.current.closePath();
    setIsDown(false);
    const snap = canvasRef.current.toDataURL();
    overlaysRef.current[pageNo] = snap;
    setOverlay(snap);
  };

  /* ─── undo (per page) ─── */
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
        ctxRef.current.drawImage(
          img,
          0,
          0,
          canvasRef.current.width / 4,
          canvasRef.current.height / 4
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

    /* ─── save *all* page overlays ─── */
    const save = useCallback(
      async (advance) => {
        const pagesWithDrawings = Object.entries(overlaysRef.current).filter(
          ([, png]) => png
        );
        if (!pagesWithDrawings.length) return alert('No changes to save');
    
        setIsSaving(true);
        try {
          /* 1️⃣ clone the mother once */
          const [firstPageStr, firstPng] = pagesWithDrawings[0];
          const cloneRes = await fetch(
            `/api/files/${doc._id}/versions?clone=true`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                overlayPng: firstPng,
                actor: 'user',
                metadata: { page: Number(firstPageStr) }
              })
            }
          );
          if (!cloneRes.ok) throw new Error('clone failed');
          const { newFile } = await cloneRes.json();
          const targetId = newFile._id;
    
          /* 2️⃣ push the remaining page overlays to the clone */
          for (const [, [pageStr, png]] of pagesWithDrawings.slice(1).entries()) {
            await fetch(`/api/files/${targetId}/versions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                overlayPng: png,
                actor: 'user',
                metadata: { page: Number(pageStr) }
              })
            });
          }
    
          /* 3️⃣ if the user hit the “advance” button, shift status ONCE */
          if (advance) {
            /* simple linear workflow: New → In Progress → Review → Completed */
            const next =
              doc.status === 'New' || !doc.status
                ? 'In Progress'
                : doc.status === 'In Progress'
                ? 'Review'
                : doc.status === 'Review'
                ? 'Completed'
                : doc.status;
    
            await fetch(`/api/files/${targetId}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: next })
            });
          }
    
          /* 4️⃣ reload the fresh PDF (the clone) */
          const fresh = await fetch(`/api/files?id=${targetId}`).then((r) => r.json());
          setCurrentDoc(fresh.file);
    
          /* 5️⃣ wipe local drawings */
          overlaysRef.current = {};
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
    
  /* expose */
  useEffect(() => {
    if (extUndo) extUndo.current = undo;
    if (extSave) extSave.current = () => save(false);
  }, [extUndo, extSave, undo, save]);

  /* page switch – save current overlay, restore next overlay */
  const gotoPage = (next) => {
    if (next < 1 || next > pages) return;
    // current overlay already stored in overlaysRef on pointer up
    setHistIdx(-1);
    setHistory(historiesRef.current[next] ?? []);
    setOverlay(overlaysRef.current[next] ?? null);
    setPageNo(next);
    setPageReady(false);
  };

  /* print helper (unchanged) */
  const buildLetterPdf = async (dataUrl) => {
    const [W, H] = [612, 792];
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const embeds = await out.embedPages(src.getPages());
    embeds.forEach((ep) => {
      const scale = Math.min(W / ep.width, H / ep.height);
      const x = (W - ep.width * scale) / 2;
      const y = (H - ep.height * scale) / 2;
      const pg = out.addPage([W, H]);
      pg.drawPage(ep, { x, y, xScale: scale, yScale: scale });
    });
    return await out.save();
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

  /* toolbar helpers */
  const saveLabel =
    !doc.status || doc.status === 'New'
      ? 'Save as Draft'
      : doc.status === 'In Progress'
      ? 'Submit for Review'
      : doc.status === 'Review'
      ? 'Submit Final'
      : 'Save Changes';

  const SaveIcon =
    !doc.status || doc.status === 'New' || doc.status === 'In Progress'
      ? ArrowRightCircle
      : doc.status === 'Review'
      ? CheckCircle
      : Save;

  if (!blobUri) return <div className="p-4">No PDF data.</div>;
  const compact = mobileModeActive;

  /* ─── render ─── */
  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {onToggleDrawer && (
            <Button size="icon" variant="ghost" onClick={onToggleDrawer} title="Menu">
              <Menu size={18} />
            </Button>
          )}

          {/* file name + page switcher */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate max-w-[30vw]">{doc.fileName}</span>

            {pages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => gotoPage(pageNo - 1)}
                  disabled={pageNo <= 1}
                >
                  <ChevronLeft size={14} />
                </Button>
                <span className="text-xs w-10 text-center">
                  {pageNo}/{pages}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => gotoPage(pageNo + 1)}
                  disabled={pageNo >= pages}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}

            {doc.status && doc.status !== 'New' && (
              <Badge
                variant="outline"
                className={`text-xs ${
                  doc.status === 'In Progress'
                    ? 'bg-amber-100 text-amber-800'
                    : doc.status === 'Review'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-green-100 text-green-800'
                }`}
              >
                {doc.status}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Tool
            icon={Pencil}
            label={isDraw ? 'Draw off' : 'Draw on'}
            onClick={() => setIsDraw((d) => !d)}
            style={isDraw ? { color: 'var(--primary)' } : {}}
          />
          <Tool
            icon={Undo}
            label="Undo"
            onClick={undo}
            disabled={histIdx < 0}
            className={histIdx < 0 ? 'opacity-50' : ''}
          />

          <Button variant="outline" size="sm" disabled={!overlay || isSaving} onClick={() => save(false)}>
            {isSaving ? (compact ? <Save size={18} className="animate-spin" /> : 'Saving…') : compact ? <Save size={18} /> : 'Save'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={!overlay || isSaving}
            onClick={() => save(true)}
            className="flex items-center gap-1"
          >
            <SaveIcon size={16} />
            {!compact && <span>{saveLabel}</span>}
          </Button>

          <Tool icon={Printer} label="Print" onClick={print} />
        </div>
      </div>

      {/* viewer */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center">
        <div ref={pageContainerRef} className="relative bg-white shadow my-4">
          <Document
            file={blobUri}
            onLoadSuccess={({ numPages }) => setPages(numPages)}
            loading={<div className="p-10 text-center">Loading PDF…</div>}
            error={<div className="p-10 text-center text-red-500">Error loading PDF</div>}
          >
            <Page
              pageNumber={pageNo}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              onRenderSuccess={initCanvas}
              loading={<div className="p-10 text-center">Rendering…</div>}
            />
          </Document>

          <canvas
            ref={canvasRef}
            className={`absolute inset-0 ${isDraw ? 'cursor-crosshair' : 'pointer-events-none'}`}
            style={{ touchAction: isDraw ? 'none' : 'auto' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
          />
        </div>
      </div>
    </div>
  );
}
