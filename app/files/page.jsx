// app/files/page.jsx
'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Menu, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

import useFilesPage from './hooks/useFilesPage';

const FileNavigator = dynamic(() => import('./components/FileNavigator'), { ssr: false });
const PDFEditor     = dynamic(() => import('./components/PDFEditor'),     { ssr: false });

export default function FilesPage() {
  /* ── single source of truth ───────────────────── */
  const f   = useFilesPage();               // <- every state & helper
  const [drawer, setDrawer] = React.useState(false);

  /* ─────────────────────────────────────────────── */
  return (
    <>
      {/* mobile drawer --------------------------------------------- */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[85vw] sm:max-w-md p-0">
          <SheetHeader className="border-b px-4 py-2">
            <SheetTitle>Document Explorer</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-[calc(100%-53px)]">
            <FileNavigator {...f} closeDrawer={() => setDrawer(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* desktop layout ------------------------------------------- */}
      <div className="hidden md:flex h-screen">
        <aside className="w-80 border-r">
          <FileNavigator {...f} closeDrawer={() => {}} />
        </aside>

        <main className="flex-1 overflow-y-auto">
          {f.currentDoc ? (
            <PDFEditor
              doc={f.currentDoc}
              isDraw={f.isDraw}
              setIsDraw={f.setIsDraw}
              onUndo={f.undoRef}
              onSave={f.saveRef}
              refreshFiles={f.triggerRefresh}
              setCurrentDoc={f.setCurrentDoc}
            />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>

      {/* mobile layout -------------------------------------------- */}
      <div className="lg:hidden h-screen overflow-hidden flex flex-col">
        {!f.currentDoc && (
          <div className="border-b bg-white flex items-center justify-between px-4 py-2 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" onClick={() => setDrawer(true)} title="Menu">
                <Menu size={18} />
              </Button>
              <span className="font-medium text-sm truncate max-w-[60vw]">Document Explorer</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Tap <Menu className="inline h-3 w-3" /> to browse files
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {f.currentDoc ? (
            <PDFEditor
              doc={f.currentDoc}
              mobileModeActive
              isDraw={f.isDraw}
              setIsDraw={f.setIsDraw}
              onUndo={f.undoRef}
              onSave={f.saveRef}
              onToggleDrawer={() => setDrawer(true)}
              refreshFiles={f.triggerRefresh}
              setCurrentDoc={f.setCurrentDoc}
            />
          ) : (
            <EmptyState mobile onBrowse={() => setDrawer(true)} />
          )}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------- */
/* tiny helper component                                          */
function EmptyState({ mobile = false, onBrowse }) {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30">
      <div className="text-center max-w-md mx-auto p-6">
        <FileIcon size={mobile ? 32 : 48} className="mx-auto mb-4 opacity-40" />
        <h3 className="text-xl font-medium mb-2">No document selected</h3>
        <p className="mb-4">{mobile ? 'Open the menu to select a file' : 'Select a file from the sidebar to preview and edit it'}</p>
        {mobile && (
          <Button size="sm" onClick={onBrowse} className="mx-auto">
            Browse Files
          </Button>
        )}
      </div>
    </div>
  );
}
