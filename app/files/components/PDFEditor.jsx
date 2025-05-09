// app/files/components/PDFEditor.jsx
'use client';

import React, { useState } from 'react';
import {
  Menu, Pencil, Undo, Save, CheckCircle, Printer, Settings,
  ChevronLeft, ChevronRight, ArrowRightCircle
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';

import { Button } from '@/components/ui/button';
import { Badge  } from '@/components/ui/badge';

import usePdfEditorLogic from '../hooks/usePDFEditor';
import FileMetaDrawer   from './FileMetaDrawer';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

/* tiny icon button */
const Tool = ({ icon:Icon, label, ...rest }) => (
  <Button size="icon" variant="ghost" title={label} {...rest}>
    <Icon size={18}/>
  </Button>
);

export default function PDFEditor(props) {
  /* drawer flag inside the component */
  const [metaOpen, setMetaOpen] = useState(false);

  /* logic hook */
  const {
    canvasRef, pageContainerRef,
    blobUri, pages, pageNo, isDraw, overlay, histIdx, isSaving,
    setIsDraw, down, move, up, undo, save, gotoPage, print, initCanvas, setPages
  } = usePdfEditorLogic(props);

  if (!blobUri) return <div className="p-4">No PDF data.</div>;
  const { doc, onToggleDrawer, mobileModeActive, refreshFiles } = props;
  const compact = mobileModeActive;

  /* toolbar helpers */
  const saveLabel =
    !doc.status || doc.status==='New' ? 'Save as Draft' :
    doc.status==='In Progress'        ? 'Submit for Review' :
    doc.status==='Review'             ? 'Submit Final'      : 'Save Changes';

  const SaveIcon =
    !doc.status || doc.status==='New' || doc.status==='In Progress'
      ? ArrowRightCircle : doc.status==='Review' ? CheckCircle : Save;

  /* ───────────────────── render ───────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* top bar */}
      <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {onToggleDrawer && (
            <Button size="icon" variant="ghost" onClick={onToggleDrawer} title="Menu">
              <Menu size={18}/>
            </Button>
          )}

          {/* file name + page switch */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate max-w-[30vw]">{doc.fileName}</span>

            {pages>1 && (
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={()=>gotoPage(pageNo-1)} disabled={pageNo<=1}>
                  <ChevronLeft size={14}/>
                </Button>
                <span className="text-xs w-10 text-center">{pageNo}/{pages}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={()=>gotoPage(pageNo+1)} disabled={pageNo>=pages}>
                  <ChevronRight size={14}/>
                </Button>
              </div>
            )}

            {doc.status && doc.status!=='New' && (
              <Badge variant="outline" className={`text-xs ${
                doc.status==='In Progress' ? 'bg-amber-100 text-amber-800' :
                doc.status==='Review'     ? 'bg-blue-100 text-blue-800'   :
                                             'bg-green-100 text-green-800'
              }`}>{doc.status}</Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* file-properties drawer */}
          <Tool icon={Settings} label="File properties" onClick={()=>setMetaOpen(true)}/>

          <Tool icon={Pencil} label={isDraw?'Draw off':'Draw on'}
                onClick={()=>setIsDraw(d=>!d)}
                style={isDraw?{color:'var(--primary)'}:{}}/>

          <Tool icon={Undo} label="Undo" onClick={undo}
                disabled={histIdx<0}
                className={histIdx<0?'opacity-50':''}/>

          <Button variant="outline" size="sm"
                  disabled={!overlay||isSaving} onClick={()=>save(false)}>
            {isSaving ? (compact ? <Save size={18} className="animate-spin"/> : 'Saving…')
                      : compact ? <Save size={18}/> : 'Save'}
          </Button>

          <Button variant="outline" size="sm"
                  disabled={!overlay||isSaving} onClick={()=>save(true)}
                  className="flex items-center gap-1">
            <SaveIcon size={16}/>
            {!compact && <span>{saveLabel}</span>}
          </Button>

          <Tool icon={Printer} label="Print" onClick={print}/>
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
            className={`absolute inset-0 ${isDraw?'cursor-crosshair':'pointer-events-none'}`}
            style={{ touchAction:isDraw?'none':'auto' }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
          />
        </div>
      </div>

      {/* drawer */}
      <FileMetaDrawer
        file={doc}
        open={metaOpen}
        onOpenChange={setMetaOpen}
        onSaved={refreshFiles}
      />
    </div>
  );
}
