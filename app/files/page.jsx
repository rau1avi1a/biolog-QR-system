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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* mobile drawer --------------------------------------------- */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[85vw] sm:max-w-md p-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-slate-950/95 dark:supports-[backdrop-filter]:bg-slate-950/90">
          <SheetHeader className="border-b bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4">
            <SheetTitle className="text-lg font-semibold">Document Explorer</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-[calc(100%-73px)]">
            <FileNavigator
              view={f.view}
              setView={f.setView}
              root={f.root}
              files={f.files}
              currentFolder={f.currentFolder}
              setCurrentFolder={f.setCurrentFolder}
              search={f.search}
              setSearch={f.setSearch}
              uploading={f.uploading}
              createFolder={f.createFolder}
              updateFolder={f.updateFolder}
              deleteFolder={f.deleteFolder}
              handleFiles={f.handleFiles}
              onFolderUpload={f.onFolderUpload}
              openFile={f.openFile}
              refreshTrigger={f.refreshTrigger}
              closeDrawer={() => setDrawer(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* desktop layout ------------------------------------------- */}
      <div className="hidden md:flex h-screen">
        <aside className="w-80 border-r bg-white/50 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:bg-slate-950/50 dark:supports-[backdrop-filter]:bg-slate-950/80 shadow-sm">
          <div className="h-full border-r border-slate-200/60 dark:border-slate-800/60">
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-4 border-b border-slate-200/60 dark:border-slate-800/60">
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Document Explorer</h1>
              {/* <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Manage your documents</p> */}
            </div>
            <FileNavigator
              view={f.view}
              setView={f.setView}
              root={f.root}
              files={f.files}
              currentFolder={f.currentFolder}
              setCurrentFolder={f.setCurrentFolder}
              search={f.search}
              setSearch={f.setSearch}
              uploading={f.uploading}
              createFolder={f.createFolder}
              updateFolder={f.updateFolder}
              deleteFolder={f.deleteFolder}
              handleFiles={f.handleFiles}
              onFolderUpload={f.onFolderUpload}
              openFile={f.openFile}
              refreshTrigger={f.refreshTrigger}
              closeDrawer={() => {}}
            />
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-950/50 dark:to-slate-900/50">
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
          <div className="border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 dark:bg-slate-950/95 flex items-center justify-between px-4 py-3 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-3">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={() => setDrawer(true)} 
                title="Menu"
                className="hover:bg-primary/10 transition-colors"
              >
                <Menu size={18} />
              </Button>
              <div>
                <span className="font-semibold text-slate-900 dark:text-slate-100">Document Explorer</span>
                <p className="text-xs text-slate-600 dark:text-slate-400">Laboratory Documents</p>
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
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
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Enhanced empty state component                                 */
function EmptyState({ mobile = false, onBrowse }) {
  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-950/50 dark:to-slate-900/50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="p-4 rounded-full bg-gradient-to-br from-primary/10 to-primary/20 w-20 h-20 flex items-center justify-center mx-auto mb-6">
          <FileIcon size={mobile ? 24 : 32} className="text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">No document selected</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
          {mobile 
            ? 'Open the menu to select a file from your document library' 
            : 'Select a file from the sidebar to preview and edit it with our advanced PDF tools'
          }
        </p>
        {mobile && (
          <Button 
            size="default" 
            onClick={onBrowse} 
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 transition-all shadow-md"
          >
            Browse Files
          </Button>
        )}
      </div>
    </div>
  );
}