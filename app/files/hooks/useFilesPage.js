'use client';

import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';

/*  A single hook that the page uses to share state across panes.   */
export default function useFilesPage() {
  const [currentDoc, setCurrentDoc] = useState(null);
  const [isDraw, setIsDraw]         = useState(true);
  const [refresh, setRefresh]       = useState(0);

  /* expose editor refs so toolbar buttons can call them */
  const undoRef = useRef(null);
  const saveRef = useRef(null);

  /* helper to open/load a file */
  const openFile = useCallback(async (file) => {
    const { file: loaded } = await api.load(file._id);
    setCurrentDoc({ ...loaded, pdf: loaded.pdf });
  }, []);

  return {
    /* state shared between navigator + editor */
    currentDoc, setCurrentDoc,
    isDraw, setIsDraw,
    refresh, triggerRefresh: () => setRefresh((p) => p + 1),

    /* helpers/refs */
    openFile,
    undoRef,
    saveRef
  };
}
