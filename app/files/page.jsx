// app/files/page.jsx
'use client';

import { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Menu, FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const FileNavigator = dynamic(() => import('./components/FileNavigator'), { ssr: false });
const PDFEditor     = dynamic(() => import('./components/PDFEditor'),     { ssr: false });

export default function FilesPage() {
  const [currDoc, setCurrDoc] = useState(null);
  const [isDraw,  setIsDraw ] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const undoRef = useRef(null);
  const saveRef = useRef(null);
  const [drawer, setDrawer] = useState(false);

  const openFile = async (file) => {
    const { file: loaded } = await fetch(`/api/files?id=${file._id}`).then((r) => r.json());
    setCurrDoc({ ...loaded, pdf: loaded.pdf });
  };

  return (
    <>
      {/* mobile drawer */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[85vw] sm:max-w-md p-0">
          <SheetHeader className="border-b px-4 py-2">
            <SheetTitle>Document Explorer</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-[calc(100%-53px)]">
            <FileNavigator
              openFile={openFile}
              refreshTrigger={refresh}
              triggerRefresh={() => setRefresh((p) => p + 1)}
              closeDrawer={() => setDrawer(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* desktop */}
      <div className="hidden md:flex h-screen">
        <div className="w-80 border-r">
          <FileNavigator
            openFile={openFile}
            refreshTrigger={refresh}
            triggerRefresh={() => setRefresh((p) => p + 1)}
            closeDrawer={() => {}}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {currDoc ? (
            <PDFEditor
              doc={currDoc}
              isDraw={isDraw}
              setIsDraw={setIsDraw}
              onUndo={undoRef}
              onSave={saveRef}
              refreshFiles={() => setRefresh((p) => p + 1)}
              setCurrentDoc={setCurrDoc}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground bg-muted/30">
              <div className="text-center max-w-md mx-auto p-6">
                <FileIcon size={48} className="mx-auto mb-4 opacity-40" />
                <h3 className="text-xl font-medium mb-2">No document selected</h3>
                <p>Select a file from the sidebar to preview and edit it</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* mobile layout */}
      <div className="lg:hidden h-screen overflow-hidden flex flex-col">
        {!currDoc && (
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
          {currDoc ? (
            <PDFEditor
              doc={currDoc}
              mobileModeActive
              isDraw={isDraw}
              setIsDraw={setIsDraw}
              onUndo={undoRef}
              onSave={saveRef}
              onToggleDrawer={() => setDrawer(true)}
              refreshFiles={() => setRefresh((p) => p + 1)}
              setCurrentDoc={setCurrDoc}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground">
              <div className="p-4">
                <FileIcon size={32} className="mx-auto mb-3 opacity-40" />
                <h3 className="font-medium mb-1">No document selected</h3>
                <p className="text-sm mb-3">Open the menu to select a file</p>
                <Button size="sm" onClick={() => setDrawer(true)} className="mx-auto">
                  Browse Files
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
