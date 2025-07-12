// app/files/components/PDFEditor/hooks/core.js - FIXED PAGE NAVIGATION & OVERLAY HANDLING
'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PDFDocument } from 'pdf-lib';
import { filesApi } from '../../../lib/api';

if (typeof window !== 'undefined') {
  const { pdfjs } = await import('react-pdf');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// FIXED: Updated validateAndCleanBase64 to match your FilesPage version
function validateAndCleanBase64(data, contentType = 'application/pdf') {
  if (!data) return null;
  
  try {
    let cleanedData = data;
    
    // FIXED: Handle object format from backend (most common now)
    if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
      console.log('📄 Processing PDF object format:', {
        hasData: !!data.data,
        dataType: typeof data.data,
        hasContentType: !!data.contentType,
        contentType: data.contentType
      });
      
      if (data.data) {
        // Use the contentType from the object if available
        const objContentType = data.contentType || contentType;
        
        // Recursively call this function to handle the inner data
        return validateAndCleanBase64(data.data, objContentType);
      } else {
        console.error('📄 PDF object has no data property');
        return null;
      }
    }
    
    // If it's already a data URL, extract just the base64 part for validation
    if (typeof data === 'string' && data.startsWith('data:')) {
      const base64Match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const base64Part = base64Match[2];
        // Test if the base64 is valid
        atob(base64Part);
        return data; // Return original data URL if valid
      }
    }
    
    // If it's a Buffer, convert to base64 string
    if (Buffer.isBuffer(data)) {
      const base64String = data.toString('base64');
      // Test if the base64 is valid
      atob(base64String);
      return `data:${contentType};base64,${base64String}`;
    }
    
    // FIXED: Handle serialized Buffer from MongoDB/API
    if (typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
      console.log('📄 Processing serialized Buffer from API');
      const buffer = Buffer.from(data.data);
      const base64String = buffer.toString('base64');
      // Test if the base64 is valid
      atob(base64String);
      return `data:${contentType};base64,${base64String}`;
    }
    
    // If it's a plain string, assume it's base64 and test it
    if (typeof data === 'string') {
      // Remove any whitespace/newlines that might cause issues
      const cleanBase64 = data.replace(/\s/g, '');
      // Test if the base64 is valid
      atob(cleanBase64);
      return `data:${contentType};base64,${cleanBase64}`;
    }
    
    console.error('📄 Unknown data format:', typeof data, data?.constructor?.name);
    return null;
    
  } catch (error) {
    console.error('📄 Base64 validation failed:', error.message);
    console.error('📄 Data info:', {
      type: typeof data,
      constructor: data?.constructor?.name,
      isBuffer: Buffer.isBuffer(data),
      hasData: data?.data ? 'yes' : 'no',
      preview: typeof data === 'string' ? data.substring(0, 100) : 'Not a string'
    });
    return null;
  }
}

// FIXED: Updated debugPdfData for better object format debugging
function debugPdfData(label, data) {
  console.log(`🔍 PDF DEBUG [${label}]:`, {
    hasData: !!data,
    type: typeof data,
    isString: typeof data === 'string',
    isObject: typeof data === 'object' && data !== null,
    isBuffer: Buffer.isBuffer(data),
    hasDataProperty: data?.data ? 'yes' : 'no',
    length: data?.length,
    startsWithData: data?.startsWith?.('data:'),
    startsWithJVBER: data?.startsWith?.('JVBER'),
    first100: data?.substring?.(0, 100),
    containsComma: data?.includes?.(','),
    // Object-specific debugging
    objectKeys: typeof data === 'object' && data !== null ? Object.keys(data) : null,
    dataPropertyType: data?.data ? typeof data.data : null,
    contentType: data?.contentType || null
  });
}

function isValidBase64DataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    console.log('🔍 isValidBase64DataUrl: Invalid input type');
    return false;
  }
  
  // Check if it's a data URL
  if (!dataUrl.startsWith('data:')) {
    console.log('🔍 isValidBase64DataUrl: Not a data URL');
    return false;
  }
  
  // Extract the base64 part
  const parts = dataUrl.split(',');
  if (parts.length !== 2) {
    console.log('🔍 isValidBase64DataUrl: Invalid data URL format - wrong comma count');
    return false;
  }
  
  const base64Part = parts[1];
  if (!base64Part) {
    console.log('🔍 isValidBase64DataUrl: Empty base64 part');
    return false;
  }
  
  // Check for obvious invalid characters first
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Part)) {
    console.log('🔍 isValidBase64DataUrl: Contains invalid base64 characters');
    return false;
  }
  
  // Check length (must be multiple of 4)
  if (base64Part.length % 4 !== 0) {
    console.log('🔍 isValidBase64DataUrl: Invalid base64 length (not multiple of 4)');
    return false;
  }
  
  try {
    // Try to decode base64 - this is where the error was happening
    atob(base64Part);
    console.log('🔍 isValidBase64DataUrl: Valid base64 data');
    return true;
  } catch (error) {
    console.log('🔍 isValidBase64DataUrl: Base64 decode failed:', error.message);
    console.log('🔍 isValidBase64DataUrl: Bad base64 sample:', base64Part.substring(0, 100));
    return false;
  }
}

/**
 * PDFEditor Core Hook
 * 
 * Pure state and data logic for PDF editing including:
 * - PDF rendering and page management
 * - Canvas management and drawing state
 * - Drawing operations with palm rejection
 * - Save operations with workflow support
 * - Work order status management and polling
 * - Print functionality
 */
export function useCore(props) {
  const { doc, refreshFiles, setCurrentDoc, mobileModeActive = false } = props;

  // === CORE PDF STATE ===
  const [blobUri, setBlobUri] = useState(doc?.pdf);
  const [pages, setPages] = useState(1);
  const [pageNo, setPageNo] = useState(1);
  const [pageReady, setPageReady] = useState(false);

  // === DRAWING STATE ===
  const [isDraw, setIsDraw] = useState(true);
  const [isDown, setIsDown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // === OVERLAY & HISTORY STATE ===
  const [overlay, setOverlay] = useState(null);
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);

  // === WORK ORDER STATE ===
  const [workOrderStatus, setWorkOrderStatus] = useState(null);
  const [workOrderLoading, setWorkOrderLoading] = useState(false);
  const [workOrderError, setWorkOrderError] = useState(null);
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [lastWorkOrderNumber, setLastWorkOrderNumber] = useState(null);
  const [userInitiatedCreation, setUserInitiatedCreation] = useState(false);

  // === REFS ===
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const pageContainerRef = useRef(null);
  const overlaysRef = useRef({});
  const bakedOverlaysRef = useRef({}); // Only the overlays that were baked into PDF
  const sessionOverlaysRef = useRef({}); // Only new overlays from current session
  
  const historiesRef = useRef({});
  const activePointerRef = useRef(null);
  const strokeStartedRef = useRef(false);
  const lastMove = useRef(0);
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);
  const pollCountRef = useRef(0);
  const pollingActiveRef = useRef(false);

const stateBackupRef = useRef(null);
const postSaveRef = useRef(false);

  // === COMPUTED PROPERTIES ===
  const isOriginal = useMemo(() => !doc?.isBatch, [doc?.isBatch]);
  const status = useMemo(() => doc?.status || 'Draft', [doc?.status]);
  const isDraft = useMemo(() => status === 'Draft', [status]);
  const isInProgress = useMemo(() => status === 'In Progress', [status]);
  const isInReview = useMemo(() => status === 'Review', [status]);
  const isCompleted = useMemo(() => status === 'Completed', [status]);
  const isArchived = useMemo(() => doc?.isArchived, [doc?.isArchived]);

const backupState = useCallback(() => {
  if (Object.keys(overlaysRef.current).length > 0) {
    stateBackupRef.current = {
      overlays: { ...overlaysRef.current },
      histories: { ...historiesRef.current },
      currentPage: pageNo,
      timestamp: Date.now()
    };
    console.log('💾 Backed up state:', Object.keys(stateBackupRef.current.overlays));
  }
}, [pageNo]);

const restoreState = useCallback(() => {
  if (stateBackupRef.current && (Date.now() - stateBackupRef.current.timestamp < 5000)) {
    console.log('🔄 Restoring state after reload:', Object.keys(stateBackupRef.current.overlays));
    overlaysRef.current = stateBackupRef.current.overlays;
    historiesRef.current = stateBackupRef.current.histories;
    setPageNo(stateBackupRef.current.currentPage);
    
    const pageOverlay = overlaysRef.current[stateBackupRef.current.currentPage];
    const pageHistory = historiesRef.current[stateBackupRef.current.currentPage] || [];
    
    if (pageHistory.length > 0) {
      setHistory(pageHistory);
      setHistIdx(pageHistory.length - 1);
      setOverlay(pageOverlay);
    }
    
    stateBackupRef.current = null; // Clear after use
  }
}, []);

  // === DRAWING PERMISSIONS ===
  const canDraw = useCallback(() => {
    if (!doc) return false;
    if (!doc.isBatch) return false; // Original files - no drawing until work order is created
    if (doc.status === 'Completed') return false; // Completed batches - no drawing allowed
    if (doc.isArchived) return false; // Archived batches - no drawing allowed
    return true; // Draft, In Progress, and Review batches - drawing allowed
  }, [doc?.isBatch, doc?.status, doc?.isArchived]);

 // === CANVAS INITIALIZATION ===
// FIXED initCanvas function in core.js - REPLACE THE EXISTING initCanvas METHOD

const initCanvas = useCallback(() => {
  const ctn = pageContainerRef.current;
  const cvs = canvasRef.current;
  if (!ctn || !cvs) return;

  // Get container size
  const containerRect = ctn.getBoundingClientRect();
  
  // Find the actual PDF canvas to get the real PDF rendering dimensions
  const pdfCanvas = ctn.querySelector('.react-pdf__Page__canvas');
  if (pdfCanvas) {
    const pdfRect = pdfCanvas.getBoundingClientRect();
    
    // ✅ QUALITY FIX: Use device pixel ratio for high-DPI displays
    const devicePixelRatio = window.devicePixelRatio || 1;
    
    // Calculate PDF canvas dimensions
    const pdfWidth = Math.round(pdfRect.width);
    const pdfHeight = Math.round(pdfRect.height);
    const pdfLeft = Math.round(pdfRect.left - containerRect.left);
    const pdfTop = Math.round(pdfRect.top - containerRect.top);
    
    // ✅ QUALITY FIX: Set canvas size with pixel ratio consideration
    const canvasWidth = pdfWidth * devicePixelRatio;
    const canvasHeight = pdfHeight * devicePixelRatio;
    
    // Set internal canvas dimensions (actual drawing area)
    cvs.width = canvasWidth;
    cvs.height = canvasHeight;
    
    // Set CSS dimensions (display size)
    cvs.style.width = `${pdfWidth}px`;
    cvs.style.height = `${pdfHeight}px`;
    cvs.style.position = 'absolute';
    cvs.style.left = `${pdfLeft}px`;
    cvs.style.top = `${pdfTop}px`;
    
    console.log(`🎨 Canvas initialized for page ${pageNo}:`, {
      displaySize: `${pdfWidth}x${pdfHeight}`,
      actualSize: `${canvasWidth}x${canvasHeight}`,
      devicePixelRatio,
      position: `${pdfLeft},${pdfTop}`
    });
    
  } else {
    // Fallback: use full container
    const devicePixelRatio = window.devicePixelRatio || 1;
    const displayWidth = Math.round(containerRect.width);
    const displayHeight = Math.round(containerRect.height);
    
    cvs.width = displayWidth * devicePixelRatio;
    cvs.height = displayHeight * devicePixelRatio;
    cvs.style.width = `${displayWidth}px`;
    cvs.style.height = `${displayHeight}px`;
    cvs.style.position = 'absolute';
    cvs.style.left = '0px';
    cvs.style.top = '0px';
  }

  const ctx = cvs.getContext('2d');
  
  // ✅ QUALITY FIX: Scale the drawing context for high-DPI
  const devicePixelRatio = window.devicePixelRatio || 1;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  
  // Reset transform and set drawing properties
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctxRef.current = ctx;

  // Clear canvas first before drawing overlay
  ctx.clearRect(0, 0, cvs.width / devicePixelRatio, cvs.height / devicePixelRatio);

      const bakedOverlay = bakedOverlaysRef.current[pageNo];
    const sessionOverlay = sessionOverlaysRef.current[pageNo];
    
    console.log(`🎨 Initializing canvas for page ${pageNo}:`, {
      hasBakedOverlay: !!bakedOverlay,
      hasSessionOverlay: !!sessionOverlay,
      combinedOverlay: overlaysRef.current[pageNo] ? 'exists' : 'none'
    });

  // Paint existing overlay for this page
  const o = overlaysRef.current[pageNo];
  if (o) {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, cvs.width / devicePixelRatio, cvs.height / devicePixelRatio);
      
      // ✅ QUALITY FIX: Draw with proper scaling
      ctx.drawImage(img, 0, 0, cvs.width / devicePixelRatio, cvs.height / devicePixelRatio);
    };
    img.onerror = () => {
      console.error('🎨 Failed to load overlay for page:', pageNo);
    };
    img.src = o;
  }
  
  // Load page-specific history and overlay state
  const pageHistory = historiesRef.current[pageNo] || [];
  const pageOverlay = overlaysRef.current[pageNo] || null;
  
  if (pageHistory.length > 0) {
    setHistory(pageHistory);
    setHistIdx(pageHistory.length - 1);
    setOverlay(pageOverlay);
    console.log('🎨 Restored page', pageNo, 'history with', pageHistory.length, 'items');
  } else {
    setHistory([]);
    setHistIdx(-1);
    setOverlay(null);
  }
  
  setPageReady(true);
}, [pageNo]);


// FIXED drawing handlers in core.js - REPLACE THE DRAWING METHODS

// ✅ IMPROVED: Enhanced getPos function with DPI awareness
const getPos = useCallback((e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  const p = e.touches?.[0] || e;
  
  // ✅ QUALITY FIX: Account for device pixel ratio
  const devicePixelRatio = window.devicePixelRatio || 1;
  
  return { 
    x: (p.clientX - rect.left), // Keep in display coordinates
    y: (p.clientY - rect.top)   // Canvas scaling handles DPI
  };
}, []);

// ✅ IMPROVED: Enhanced pointer down with better stroke initialization
const pointerDown = useCallback((e) => {
  if (!isDraw || !pageReady || !canDraw()) return;
  
  // Palm rejection: only allow one active pointer at a time
  if (activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
    return;
  }
  
  e.preventDefault();
  
  activePointerRef.current = e.pointerId;
  strokeStartedRef.current = true;
  setIsDown(true);
  
  const { x, y } = getPos(e);
  const ctx = ctxRef.current;
  
  // ✅ QUALITY FIX: Better stroke initialization
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  // ✅ NEW: Add a small dot for single clicks/taps
  ctx.arc(x, y, ctx.lineWidth / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y);
  
  console.log(`🖊️ Started stroke at (${x.toFixed(1)}, ${y.toFixed(1)}) on page ${pageNo}`);
}, [isDraw, pageReady, canDraw, getPos, pageNo]);

// ✅ IMPROVED: Enhanced pointer move with smoother curves
const pointerMove = useCallback((e) => {
  if (!isDraw || !isDown || !pageReady || !canDraw()) return;
  
  // Palm rejection: only respond to the active pointer
  if (activePointerRef.current !== e.pointerId) {
    return;
  }
  
  const now = performance.now();
  if (now - lastMove.current < 16) return; // 60 fps throttle
  lastMove.current = now;

  e.preventDefault();
  const { x, y } = getPos(e);
  const ctx = ctxRef.current;
  
  // ✅ QUALITY FIX: Smoother line drawing
  ctx.lineTo(x, y);
  ctx.stroke();
  
  // ✅ NEW: Optional smoothing for very detailed work
  // Uncomment for smoother curves (may impact performance):
  /*
  if (lastPoint.current) {
    const midX = (lastPoint.current.x + x) / 2;
    const midY = (lastPoint.current.y + y) / 2;
    ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
    ctx.stroke();
  }
  lastPoint.current = { x, y };
  */
  
}, [isDraw, isDown, pageReady, canDraw, getPos]);

// ✅ IMPROVED: Enhanced pointer up with high-quality snapshot
const pointerUp = useCallback((e) => {
  if (!isDraw || !pageReady || !canDraw()) return;
  
  // Only respond to the active pointer
  if (e && activePointerRef.current !== null && activePointerRef.current !== e.pointerId) {
    return;
  }
  
  const ctx = ctxRef.current;
  ctx.closePath();
  setIsDown(false);
  
  // Reset the active pointer when the stroke ends
  activePointerRef.current = null;
  strokeStartedRef.current = false;

  // ✅ IMPROVED: High-quality snapshot with proper timing
  (window.requestIdleCallback || window.requestAnimationFrame)(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // ✅ QUALITY FIX: Use maximum quality for the snapshot
    const snap = canvas.toDataURL('image/png', 1.0); // Maximum quality
    
    // Update the overlay for this page
    overlaysRef.current[pageNo] = snap;

    // Get current history
    let currentHistory = historiesRef.current[pageNo] || [];
    
    // If we're not at the end of history (we've undone some strokes),
    // truncate the history at the current position before adding the new stroke
    if (histIdx < currentHistory.length - 1) {
      currentHistory = currentHistory.slice(0, histIdx + 1);
    }
    
    // Add the new snapshot to history
    const newHistory = [...currentHistory, snap];
    historiesRef.current[pageNo] = newHistory;
    
    // Set index to point to the current state (last item)
    const newIndex = newHistory.length - 1;
    setHistIdx(newIndex);
    setHistory(newHistory);
    setOverlay(snap);
    
    console.log(`📸 High-quality snapshot saved for page ${pageNo} (history: ${newHistory.length} items)`);
  });
}, [isDraw, pageReady, canDraw, pageNo, histIdx]);

    const pointerCancel = useCallback((e) => {
    if (activePointerRef.current === e.pointerId) {
      activePointerRef.current = null;
      strokeStartedRef.current = false;
      setIsDown(false);
      ctxRef.current.closePath();
    }
  }, []);

// ✅ IMPROVED: Enhanced undo with better quality restoration
const undo = useCallback(() => {
  if (!canDraw()) return;
  
  const currentHistory = historiesRef.current[pageNo] || [];
  if (currentHistory.length === 0) return;
  
  let newIdx = histIdx - 1;
  
  // Ensure we don't go below -1 (completely clear state)
  if (newIdx < -1) return;
  
  // Update the index
  setHistIdx(newIdx);
  
  // Clear the canvas
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;
  if (!canvas || !ctx) return;
  
  const devicePixelRatio = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);

  if (newIdx >= 0 && newIdx < currentHistory.length) {
    // Show the state at newIdx
    const targetState = currentHistory[newIdx];
    
    const img = new Image();
    img.onload = () => {
      // ✅ QUALITY FIX: Restore with proper scaling
      ctx.drawImage(img, 0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);
    };
    img.onerror = () => {
      console.error('🎨 Failed to restore overlay state for page:', pageNo);
    };
    img.src = targetState;
    
    overlaysRef.current[pageNo] = targetState;
    setOverlay(targetState);
  } else {
    // Clear everything (newIdx is -1)
    delete overlaysRef.current[pageNo];
    setOverlay(null);
  }
  
  console.log(`↶ Undo on page ${pageNo}: restored to state ${newIdx + 1}/${currentHistory.length}`);
}, [histIdx, pageNo, canDraw]);


  // FIXED: PAGE NAVIGATION - This is the main fix for your page navigation issue
  const gotoPage = useCallback((next) => {
    console.log('📄 Page navigation requested:', { current: pageNo, next, totalPages: pages });
    
    if (next < 1 || next > pages) {
      console.log('📄 Page navigation blocked - out of range:', { next, pages });
      return;
    }
    
    // Reset drawing state when changing pages
    activePointerRef.current = null;
    strokeStartedRef.current = false;
    setIsDown(false);
    
    console.log('📄 Changing from page', pageNo, 'to page', next);
    
    // Save current canvas state before switching pages
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (canvas && ctx) {
      // Only save if there's actual drawing content
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasContent = imageData.data.some(channel => channel !== 0);
      
      if (hasContent) {
        const currentSnapshot = canvas.toDataURL('image/png');
        overlaysRef.current[pageNo] = currentSnapshot;
        console.log('📄 Saved overlay for page', pageNo, 'before switching');
      }
    }
    
    // Load page history and set proper index for the new page
    const pageHistory = historiesRef.current[next] || [];
    const pageOverlay = overlaysRef.current[next] || null;
    
    console.log('📄 Loading page', next, 'with', pageHistory.length, 'history items and overlay:', !!pageOverlay);
    
    // Set the history index to the last item (most recent state)
    const newIndex = pageHistory.length > 0 ? pageHistory.length - 1 : -1;
    
    setHistIdx(newIndex);
    setHistory(pageHistory);
    setOverlay(pageOverlay);
    setPageNo(next);
    setPageReady(false); // This will trigger canvas reinitialization
    
    console.log('📄 Page change complete - new state:', { 
      page: next, 
      historyLength: pageHistory.length, 
      histIdx: newIndex,
      hasOverlay: !!pageOverlay 
    });
  }, [pages, pageNo]);

  // === PRINT FUNCTIONALITY ===
  const buildLetterPdf = useCallback(async (dataUrl) => {
    const [W, H] = [612, 792];
    const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const src = await PDFDocument.load(bytes);
    const out = await PDFDocument.create();
    const pages = await out.embedPages(src.getPages());
    pages.forEach(ep => {
      const s = Math.min(W / ep.width, H / ep.height);
      const x = (W - ep.width * s) / 2;
      const y = (H - ep.height * s) / 2;
      const pg = out.addPage([W, H]);
      pg.drawPage(ep, { x, y, xScale: s, yScale: s });
    });
    return out.save();
  }, []);

  const print = useCallback(async () => {
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
  }, [blobUri, buildLetterPdf]);

  // === WORK ORDER POLLING MANAGEMENT ===
  const checkWorkOrderStatus = useCallback(async () => {
    if (!doc?._id || !doc?.isBatch) {
      console.log('❌ Skipping work order check: not a batch or missing ID');
      return false;
    }
  
    try {
      console.log('🔍 Checking work order status for batch:', doc._id);
      setWorkOrderLoading(true);
      
      const timestamp = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`/api/batches?id=${doc._id}&action=workorder-status&t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('📊 Work order status API response:', result);
  
      if (result.success && result.data) {
        const statusData = result.data;
        
        setWorkOrderStatus(statusData);
        setWorkOrderError(null);
        pollCountRef.current = 0;
        
        // FIXED: Account for the async NetSuite lookup you mentioned
        // The status might be 'created' but workOrderNumber might still be pending lookup
        const isComplete = statusData.status === 'created' && statusData.workOrderNumber && !statusData.workOrderNumber.startsWith('PENDING-');
        const isFailed = statusData.status === 'failed';
        const shouldContinue = statusData.status === 'creating' || 
                              statusData.status === 'pending' ||
                              (statusData.status === 'created' && (!statusData.workOrderNumber || statusData.workOrderNumber.startsWith('PENDING-')));
        
        console.log('🔍 Status analysis (with async NetSuite lookup):', { 
          isComplete, 
          isFailed, 
          shouldContinue,
          workOrderNumber: statusData.workOrderNumber,
          isPendingLookup: statusData.workOrderNumber?.startsWith('PENDING-')
        });
        
        if (isComplete) {
          console.log('🎉 Work order created and NetSuite lookup complete:', statusData.workOrderNumber);
          setLastWorkOrderNumber(statusData.workOrderNumber);
          setIsCreatingWorkOrder(false);
          setUserInitiatedCreation(false);
          return false;
        } else if (isFailed) {
          console.log('❌ Work order creation failed:', statusData.error);
          setIsCreatingWorkOrder(false);
          setUserInitiatedCreation(false);
          return false;
        } else if (shouldContinue) {
          console.log('⏳ Work order still being created or NetSuite lookup in progress...');
          return true;
        } else {
          console.log('🛑 Unknown status, stopping polling:', statusData.status);
          return false;
        }
      } else {
        setWorkOrderError(result.error || 'Failed to get work order status');
        pollCountRef.current++;
        return pollCountRef.current < 10;
      }
    } catch (err) {
      setWorkOrderError(err.message);
      pollCountRef.current++;
      return pollCountRef.current < 10;
    } finally {
      setWorkOrderLoading(false);
    }
  }, [doc?._id, doc?.isBatch]);

  const startWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      return;
    }
  
    pollingActiveRef.current = true;
    pollCountRef.current = 0;
    
    const poll = async () => {
      if (!pollingActiveRef.current) {
        return;
      }
      
      try {
        const shouldContinue = await checkWorkOrderStatus();
        
        if (shouldContinue && pollingActiveRef.current && pollCountRef.current < 50) { // Increased from 30 to 50 for NetSuite lookup
          // FIXED: Adaptive polling with longer intervals for NetSuite lookup
          let delay = 2000;
          if (pollCountRef.current > 5) delay = 3000;
          if (pollCountRef.current > 15) delay = 5000;
          if (pollCountRef.current > 30) delay = 8000; // Longer delay for NetSuite lookup phase
          
          console.log(`🔄 Scheduling next poll in ${delay}ms (attempt ${pollCountRef.current + 1}/50)`);
          pollCountRef.current++;
          setTimeout(poll, delay);
        } else {
          console.log('🛑 Polling stopped - shouldContinue:', shouldContinue, 'active:', pollingActiveRef.current, 'count:', pollCountRef.current);
          pollingActiveRef.current = false;
          
          if (pollCountRef.current >= 50) {
            setIsCreatingWorkOrder(false);
            setUserInitiatedCreation(false);
            setWorkOrderError('Work order creation timed out after 8+ minutes (including NetSuite lookup)');
          }
        }
      } catch (error) {
        console.error('❌ Poll iteration failed:', error);
        pollingActiveRef.current = false;
      }
    };
    
    poll();
  }, [checkWorkOrderStatus]);
  
  const stopWorkOrderPolling = useCallback(() => {
    if (pollingActiveRef.current) {
      pollingActiveRef.current = false;
    }
    
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);


const save = useCallback(async (action = 'save', confirmationData = null) => {
  console.log('🔧 CORE.SAVE CALLED:', { action, confirmationData, docFileName: doc?.fileName, currentPage: pageNo });

  if (!doc) return;
  if (doc.isArchived || doc.status === 'Completed') {
    alert('Cannot save changes to completed or archived files.');
    return;
  }
  
  const sanitizeObject = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeObject);
    
    if (obj instanceof HTMLElement || obj.nodeType || obj.__reactFiber$) {
      return null;
    }
    
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      try {
        JSON.stringify(value);
        sanitized[key] = sanitizeObject(value);
      } catch (error) {
        console.warn(`Skipping non-serializable value for key: ${key}`);
      }
    }
    return sanitized;
  };
  
  const cleanConfirmationData = confirmationData ? sanitizeObject(confirmationData) : null;
  
  // ✅ FIXED: Save current page overlay to memory BEFORE building overlay data
  const canvas = canvasRef.current;
  if (canvas) {
    const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some(channel => channel !== 0);
    
    if (hasContent) {
      const currentSnapshot = canvas.toDataURL('image/png');
      overlaysRef.current[pageNo] = currentSnapshot;
      console.log('🔧 Saved current page', pageNo, 'overlay before save');
      
      let currentHistory = historiesRef.current[pageNo] || [];
      const newHistory = [...currentHistory, currentSnapshot];
      historiesRef.current[pageNo] = newHistory;
      setHistory(newHistory);
      setHistIdx(newHistory.length - 1);
      setOverlay(currentSnapshot);
    }
  }

  // ✅ FIXED: Get EXISTING overlays from document first, then merge with current overlays
  console.log('📄 Building overlay data for save...');
  
  // Start with existing overlays from the document (if any)
  let existingOverlays = {};
  if (doc.pageOverlays && typeof doc.pageOverlays === 'object') {
    existingOverlays = { ...doc.pageOverlays };
    console.log('📄 Found existing overlays in document:', Object.keys(existingOverlays));
  } else if (doc.overlays && typeof doc.overlays === 'object') {
    existingOverlays = { ...doc.overlays };
    console.log('📄 Found existing overlays (legacy format):', Object.keys(existingOverlays));
  }
  
  // Merge with current in-memory overlays (these are the fresh edits)
  const currentOverlays = Object.fromEntries(
    Object.entries(overlaysRef.current).filter(([, png]) => png)
  );
  
  // ✅ CRITICAL FIX: Merge existing + current, with current overlays taking precedence
  const mergedOverlays = {
    ...existingOverlays,  // Start with what's already saved
    ...currentOverlays    // Overlay with current edits (this page and any others)
  };
  
  console.log('🔧 Overlay merge details:', {
    existingOverlaysCount: Object.keys(existingOverlays).length,
    existingPages: Object.keys(existingOverlays),
    currentOverlaysCount: Object.keys(currentOverlays).length,
    currentPages: Object.keys(currentOverlays),
    mergedOverlaysCount: Object.keys(mergedOverlays).length,
    mergedPages: Object.keys(mergedOverlays),
    currentPageInMerged: !!mergedOverlays[pageNo]
  });

  // Handle rejection without overlays
  if (action === 'reject') {
    setIsSaving(true);
    try {
      const result = await filesApi.batches.reject(doc._id, cleanConfirmationData?.reason || 'No reason provided');
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (setCurrentDoc && result.data) {
        setCurrentDoc({
          ...doc,
          ...result.data,
          isBatch: true
        });
      }
      
      refreshFiles?.();
      return result;
    } catch (err) {
      alert('Error during rejection: ' + (err.message || 'Unknown error'));
      throw err;
    } finally {
      setIsSaving(false);
    }
  }

  // ✅ FIXED: Get canvas dimensions for better overlay quality
  const container = pageContainerRef.current;
  const containerRect = container?.getBoundingClientRect();
  
  // ✅ NEW: Get actual PDF canvas dimensions for accurate overlay scaling
  const pdfCanvas = container?.querySelector('.react-pdf__Page__canvas');
  const pdfCanvasRect = pdfCanvas?.getBoundingClientRect();
  
  const canvasDimensions = canvas ? {
    // Canvas actual dimensions
    width: canvas.width,
    height: canvas.height,
    
    // Display dimensions
    displayWidth: containerRect?.width || canvas.offsetWidth,
    displayHeight: containerRect?.height || canvas.offsetHeight,
    
    // ✅ NEW: PDF-specific dimensions for accurate overlay positioning
    pdfCanvasWidth: pdfCanvasRect?.width || canvas.width,
    pdfCanvasHeight: pdfCanvasRect?.height || canvas.height,
    pdfCanvasLeft: pdfCanvasRect ? pdfCanvasRect.left - containerRect.left : 0,
    pdfCanvasTop: pdfCanvasRect ? pdfCanvasRect.top - containerRect.top : 0,
    
    // Page information
    currentPage: pageNo,
    
    containerRect: containerRect ? {
      width: containerRect.width,
      height: containerRect.height,
      top: containerRect.top,
      left: containerRect.left,
      right: containerRect.right,
      bottom: containerRect.bottom,
      x: containerRect.x,
      y: containerRect.y
    } : null
  } : null;

  // ✅ FIXED: Create page-specific overlay data using MERGED overlays
  const pageOverlays = {};
  Object.keys(mergedOverlays).forEach(pageNum => {
    pageOverlays[`page_${pageNum}`] = mergedOverlays[pageNum];
  });

  console.log('📤 Final overlay data for API:', {
    pageOverlaysCount: Object.keys(pageOverlays).length,
    pageOverlaysPages: Object.keys(pageOverlays),
    mergedOverlaysCount: Object.keys(mergedOverlays).length,
    overlayPages: Object.keys(mergedOverlays).map(p => parseInt(p)).sort((a, b) => a - b),
    canvasDimensions: canvasDimensions ? {
      canvasSize: `${canvasDimensions.width}x${canvasDimensions.height}`,
      pdfCanvasSize: `${canvasDimensions.pdfCanvasWidth}x${canvasDimensions.pdfCanvasHeight}`,
      currentPage: canvasDimensions.currentPage
    } : 'no canvas dims'
  });

  setIsSaving(true);
  
  try {
    const isOriginal = !doc.isBatch && !doc.originalFileId;
    let result;
    
    if (isOriginal) {
      // Original file - create new batch
      const editorData = {
        // Legacy compatibility
        overlayPng: mergedOverlays[1] || mergedOverlays[Object.keys(mergedOverlays)[0]],
        
        // ✅ FIXED: Send merged overlays, not just current session
        pageOverlays: pageOverlays,
        annotations: mergedOverlays,  // Fallback format
        
        // Enhanced metadata
        overlayPages: Object.keys(mergedOverlays).map(p => parseInt(p)).sort((a, b) => a - b),
        canvasDimensions: canvasDimensions
      };

      if (action === 'create_work_order') {
        editorData.batchQuantity = cleanConfirmationData?.batchQuantity;
        editorData.batchUnit = cleanConfirmationData?.batchUnit;
        editorData.scaledComponents = cleanConfirmationData?.components || cleanConfirmationData?.scaledComponents;
        editorData.createWorkOrder = true;
      }

      console.log('📤 Sending editor data to API:', {
        hasOverlayPng: !!editorData.overlayPng,
        pageOverlaysCount: Object.keys(editorData.pageOverlays).length,
        annotationsCount: Object.keys(editorData.annotations).length,
        overlayPages: editorData.overlayPages
      });

      result = await filesApi.editor.saveFromEditor(
        doc._id,
        editorData,
        action,
        cleanConfirmationData
      );
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Handle result...
      if (setCurrentDoc && result.data) {
        const newBatchData = result.data;
        
        let newPdfData = null;
        
        if (newBatchData.signedPdf?.data) {
          console.log('🔧 Constructing PDF from signedPdf in save result');
          newPdfData = validateAndCleanBase64(
            newBatchData.signedPdf.data,
            newBatchData.signedPdf.contentType || 'application/pdf'
          );
          
          if (newPdfData) {
            console.log('✅ Successfully constructed PDF data from save result');
          } else {
            console.error('❌ Failed to construct PDF from save result');
            newPdfData = doc.pdf;
          }
        } else {
          console.log('⚠️ No signedPdf in save result, using original PDF');
          newPdfData = doc.pdf;
        }
        
        const updatedDoc = {
          ...newBatchData,
          pdf: newPdfData,
          isBatch: true,
          originalFileId: newBatchData.fileId || doc._id,
          status: action === 'create_work_order' ? 'In Progress' : (newBatchData.status || 'Draft'),
          workOrderCreated: action === 'create_work_order' ? true : (newBatchData.workOrderCreated || false),
          workOrderStatus: action === 'create_work_order' ? 'creating' : (newBatchData.workOrderStatus || 'not_created'),
          _skipDocumentReset: true,
          _preserveOverlays: overlaysRef.current,
          _preserveHistories: historiesRef.current,
          _preservePage: pageNo
        };
        
        setCurrentDoc(updatedDoc);
      }
      
      if (action === 'create_work_order') {
        setIsCreatingWorkOrder(true);
        setUserInitiatedCreation(true);
      }
      
    } else {
      // Existing batch - FIXED: Send merged overlay data
      const updateData = {
        // Legacy compatibility  
        overlayPng: mergedOverlays[1] || mergedOverlays[Object.keys(mergedOverlays)[0]],
        
        // ✅ FIXED: Send merged overlays that include existing + new
        pageOverlays: pageOverlays,
        annotations: mergedOverlays,
        
        // Enhanced metadata
        overlayPages: Object.keys(mergedOverlays).map(p => parseInt(p)).sort((a, b) => a - b),
        canvasDimensions: canvasDimensions
      };

      if (action === 'submit_review' && cleanConfirmationData) {
        updateData.status = 'Review';
        updateData.submittedForReviewAt = new Date();
        
        if (cleanConfirmationData.components?.length > 0) {
          updateData.chemicalsTransacted = true;
          updateData.transactionDate = new Date();
          updateData.confirmedComponents = cleanConfirmationData.components;
        }
        
        if (cleanConfirmationData.solutionLotNumber) {
          updateData.solutionCreated = true;
          updateData.solutionLotNumber = cleanConfirmationData.solutionLotNumber;
          updateData.solutionCreatedDate = new Date();
          
          if (cleanConfirmationData.solutionQuantity) {
            updateData.solutionQuantity = cleanConfirmationData.solutionQuantity;
          }
          if (cleanConfirmationData.solutionUnit) {
            updateData.solutionUnit = cleanConfirmationData.solutionUnit;
          }
        }
        
      } else if (action === 'complete') {
        updateData.status = 'Completed';
        updateData.completedAt = new Date();
      }

      console.log('📤 Sending batch update data to API:', {
        hasOverlayPng: !!updateData.overlayPng,
        pageOverlaysCount: Object.keys(updateData.pageOverlays).length,
        annotationsCount: Object.keys(updateData.annotations).length,
        overlayPages: updateData.overlayPages
      });

      backupState();

      result = await filesApi.batches.update(doc._id, updateData);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (setCurrentDoc && result.data) {
        postSaveRef.current = true;
        
        const updatedDoc = {
          ...doc,
          ...result.data,
          _skipDocumentReset: true,
          _preserveOverlays: overlaysRef.current,
          _preserveHistories: historiesRef.current,
          _preservePage: pageNo
        };
        setCurrentDoc(updatedDoc);
        
        setTimeout(() => {
          postSaveRef.current = false;
        }, 2000);
      }
    }
    
    console.log('✅ Save completed - staying on page', pageNo, 'with overlays preserved');
    return result;
    
  } catch (err) {
    console.error('💥 Save error details:', err);
    alert('Save error: ' + (err.message || 'Unknown error'));
    if (action === 'create_work_order') {
      setIsCreatingWorkOrder(false);
      setUserInitiatedCreation(false);
    }
    throw err;
  } finally {
    setIsSaving(false);
  }
}, [doc, refreshFiles, setCurrentDoc, canDraw, startWorkOrderPolling, pageNo]);

// === DOCUMENT RESET - FIXED to prevent unnecessary resets during page navigation ===
useEffect(() => {
  // FIXED: Skip reset if this is a save operation
  if (doc?._skipDocumentReset) {
    console.log('📄 Skipping document reset - save operation');
    
    // Clean up the skip flag
    if (setCurrentDoc) {
      setTimeout(() => {
        const { _skipDocumentReset, _preserveOverlays, _preserveHistories, _preservePage, ...cleanDoc } = doc;
        setCurrentDoc(cleanDoc);
      }, 1000);
    }
    return;
  }
  
  // FIXED: Only reset when the actual document changes, not on every render
  if (!doc) return;
  
  console.log('📄 Document changed, resetting PDF editor:', {
    fileName: doc?.fileName,
    isBatch: doc?.isBatch,
    hasSignedPdf: !!doc?.signedPdf,
    signedPdfType: typeof doc?.signedPdf?.data,
    hasOverlays: !!(doc?.overlays && Object.keys(doc.overlays).length > 0),
    isRecentSave: stateBackupRef.current && (Date.now() - stateBackupRef.current.timestamp < 3000)
  });
  
  // FIXED: If this is right after a save, preserve the working overlays
// FIXED: If this is right after a save, preserve the working overlays
const isPostSave = postSaveRef.current || 
                   (stateBackupRef.current && (Date.now() - stateBackupRef.current.timestamp < 3000)) ||
                   doc?._preserveOverlays;

if (isPostSave) {
  console.log('🔄 Post-save document update - preserving working overlays');
  
  // Use preserved overlays from document or backup
  const preservedOverlays = doc?._preserveOverlays || stateBackupRef.current?.overlays || overlaysRef.current;
  const preservedHistories = doc?._preserveHistories || stateBackupRef.current?.histories || historiesRef.current;
  const targetPage = doc?._preservePage || stateBackupRef.current?.currentPage || pageNo;
  
  overlaysRef.current = preservedOverlays;
  historiesRef.current = preservedHistories;
  
  const pageHistory = historiesRef.current[targetPage] || [];
  const pageOverlay = overlaysRef.current[targetPage] || null;
  
  setPageNo(targetPage);
  setHistory(pageHistory);
  setHistIdx(pageHistory.length > 0 ? pageHistory.length - 1 : -1);
  setOverlay(pageOverlay);
  
  console.log('✅ Restored overlays for continued editing on page', targetPage);
  console.log('✅ Overlays restored:', Object.keys(overlaysRef.current));
  
  // Clear the backup after use
  stateBackupRef.current = null;
  postSaveRef.current = false;
  setPageReady(false);
  
  // Update PDF but keep overlays
  const isBatchFile = doc?.sourceType === 'batch' || doc?.isBatch || doc?.status || doc?.runNumber || doc?.batchId;
  let validPdfData = null;
  
  if (isBatchFile && doc?.signedPdf?.data) {
    validPdfData = validateAndCleanBase64(doc.signedPdf.data, doc.signedPdf.contentType || 'application/pdf');
  } else if (doc?.pdf) {
    validPdfData = validateAndCleanBase64(doc.pdf);
  }
  
  if (validPdfData) {
    setBlobUri(validPdfData);
  }
  
  setTimeout(() => {
    if (canvasRef.current) {
      initCanvas();
    }
  }, 200);
  
  return;
}
  
  // FIXED: Use same detection logic as your openFile function
  const isBatchFile = doc?.sourceType === 'batch' || 
                     doc?.isBatch || 
                     doc?.status || 
                     doc?.runNumber ||
                     doc?.batchId;

  let validPdfData = null;
  
  if (isBatchFile) {
    // Handle batch files
    console.log('🔧 Handling batch file PDF data');
    
    if (doc?.signedPdf?.data) {
      // Batch has baked PDF with overlays
      console.log('✅ Using signedPdf.data from batch (has overlays baked in)');
      validPdfData = validateAndCleanBase64(
        doc.signedPdf.data,
        doc.signedPdf.contentType || 'application/pdf'
      );
    } else if (doc?.pdf) {
      // Batch doesn't have signedPdf data yet, use regular PDF
      console.log('✅ Using doc.pdf from batch (no overlays baked yet)');
      validPdfData = validateAndCleanBase64(doc.pdf);
    } else {
      // Fallback: try to get PDF from original file reference
      console.log('⚠️ Batch has no PDF data, might need to load from original file');
      validPdfData = null;
    }
  } else {
    // Handle original files - simple logic
    if (doc?.pdf) {
      console.log('✅ Processing original file PDF');
      validPdfData = validateAndCleanBase64(doc.pdf);
    }
  }

  debugPdfData('Document Reset', validPdfData);
  setBlobUri(validPdfData);
  setPageNo(1); // Reset to page 1 only when document actually changes
  
  // Reset drawing state
  activePointerRef.current = null;
  strokeStartedRef.current = false;
  setIsDown(false);
  
  // FIXED: Handle overlays properly - only restore if not baked into PDF
  if (doc?.overlays && Object.keys(doc.overlays).length > 0 && !doc?.signedPdf) {
    console.log('🎨 Restoring overlays from document');
    overlaysRef.current = doc.overlays;
    
    // Set overlay and history for page 1
    if (doc.overlays[1]) {
      setOverlay(doc.overlays[1]);
      historiesRef.current[1] = [doc.overlays[1]];
      setHistory([doc.overlays[1]]);
      setHistIdx(0);
    } else {
      setOverlay(null);
      setHistory([]);
      setHistIdx(-1);
    }
    
    // Initialize histories for all pages with overlays
    Object.keys(doc.overlays).forEach(pageNum => {
      const pageNumber = parseInt(pageNum);
      if (!isNaN(pageNumber)) {
        historiesRef.current[pageNumber] = [doc.overlays[pageNumber]];
      }
    });
    
  } else {
    console.log('🧹 Clearing overlays - new document or baked PDF');
    overlaysRef.current = {};
    historiesRef.current = {};
    setOverlay(null);
    setHistory([]);
    setHistIdx(-1);
  }
  
  setPageReady(false);
  
  // Force canvas re-initialization
  setTimeout(() => {
    if (canvasRef.current && validPdfData) {
      console.log('🎨 Reinitializing canvas after document change');
      initCanvas();
    }
  }, 200);
}, [
  // FIXED: Only depend on actual document identity/content changes, not functions
  doc?._id,           // Document ID change
  doc?.fileName,      // File name change  
  doc?.pdf,           // PDF data change
  doc?.signedPdf,     // Signed PDF change
  doc?.overlays,      // Overlays change
  doc?._skipDocumentReset, // Skip reset flag
  setCurrentDoc       // Needed for cleanup
  // REMOVED: initCanvas dependency which was causing unnecessary resets
]);


  // === POLLING MANAGEMENT ===
  useEffect(() => {
    const shouldStartPolling = doc?._id && 
                               doc?.isBatch && 
                               (isCreatingWorkOrder || 
                                userInitiatedCreation || 
                                (doc?.workOrderCreated && doc?.workOrderStatus === 'creating'));
  
    if (shouldStartPolling && !pollingActiveRef.current) {
      startWorkOrderPolling();
    } else if (!shouldStartPolling && pollingActiveRef.current) {
      stopWorkOrderPolling();
    }
  
    return () => {
      if (!doc?._id) {
        stopWorkOrderPolling();
      }
    };
  }, [
    doc?._id, 
    doc?.isBatch, 
    doc?.workOrderCreated, 
    doc?.workOrderStatus,
    isCreatingWorkOrder, 
    userInitiatedCreation,
    startWorkOrderPolling, 
    stopWorkOrderPolling
  ]);
  
  // === WORK ORDER INFO COMPUTATION ===
  const workOrderInfo = useMemo(() => {
    if (!doc?.isBatch) return null;
    
    if ((isCreatingWorkOrder || userInitiatedCreation) && !workOrderStatus?.workOrderNumber) {
      return {
        id: 'pending',
        workOrderNumber: null,
        internalId: null,
        status: 'creating',
        isNetSuite: false,
        isLocal: false,
        isPending: true,
        isFailed: false,
        isCreated: false,
        isUpdating: workOrderLoading || pollingActiveRef.current,
        error: workOrderError
      };
    }
    
    const currentStatus = workOrderStatus || {
      created: doc.workOrderCreated,
      status: doc.workOrderStatus,
      workOrderId: doc.workOrderId,
      workOrderNumber: doc.netsuiteWorkOrderData?.tranId || lastWorkOrderNumber
    };
    
    if (currentStatus.created || currentStatus.workOrderNumber || currentStatus.workOrderId) {
      const workOrderNumber = currentStatus.workOrderNumber || currentStatus.workOrderId || lastWorkOrderNumber;
      const isNetSuite = !!(workOrderNumber && !workOrderNumber.startsWith('LOCAL-') && !workOrderNumber.startsWith('PENDING-'));
      const isPending = currentStatus.status === 'creating' || 
                       currentStatus.status === 'pending' ||
                       workOrderNumber?.startsWith('PENDING-');
      const isLocal = workOrderNumber?.startsWith('LOCAL-WO-');
      const isFailed = currentStatus.status === 'failed';
      const isCreated = currentStatus.status === 'created' || (workOrderNumber && !isPending && !isFailed);
      
      return {
        id: workOrderNumber || 'Unknown',
        workOrderNumber: currentStatus.workOrderNumber || lastWorkOrderNumber,
        internalId: currentStatus.internalId,
        status: currentStatus.status || 'created',
        isNetSuite,
        isLocal,
        isPending,
        isFailed,
        isCreated,
        isUpdating: workOrderLoading || pollingActiveRef.current,
        error: currentStatus.error || workOrderError
      };
    }
    
    return null;
  }, [
    doc, 
    workOrderStatus, 
    lastWorkOrderNumber, 
    isCreatingWorkOrder, 
    userInitiatedCreation,
    workOrderLoading, 
    workOrderError
  ]);
  
  // === CLEANUP ===
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  useEffect(() => {
    return () => {
      pollingActiveRef.current = false;
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // === RESIZE OBSERVER ===
  useEffect(() => {
    if (!pageContainerRef.current) return;
    const ro = new ResizeObserver(initCanvas);
    ro.observe(pageContainerRef.current);
    return () => ro.disconnect();
  }, [initCanvas]);


  // FIXED: Backup state before saves and page changes
useEffect(() => {
  backupState();
}, [backupState, overlay, pageNo]);

// FIXED: Try to restore state on mount (after hot reload)
useEffect(() => {
  const timer = setTimeout(restoreState, 100);
  return () => clearTimeout(timer);
}, [restoreState]);

  // === RETURN INTERFACE ===
  return {
    // === REFS ===
    canvasRef,
    pageContainerRef,
    overlaysRef,
    historiesRef,
    

    // === STATE ===
    blobUri,
    pages,
    pageNo,
    isDraw,
    overlay,
    histIdx,
    isSaving,
    pageReady,

    // === WORK ORDER STATE ===
    workOrderStatus,
    workOrderLoading,
    workOrderError,
    isCreatingWorkOrder,
    userInitiatedCreation,
    lastWorkOrderNumber,

    // === COMPUTED ===
    canDraw,
    isOriginal,
    status,
    isDraft,
    isInProgress,
    isInReview,
    isCompleted,
    isArchived,
    workOrderInfo,

    // === ACTIONS ===
    setIsDraw,
    setPages,
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    undo,
    save,
    gotoPage,
    print,
    initCanvas,

    // === WORK ORDER ACTIONS ===
    checkWorkOrderStatus,
    startWorkOrderPolling,
    stopWorkOrderPolling,
    setIsCreatingWorkOrder,
    setUserInitiatedCreation,
    setLastWorkOrderNumber
  };
}