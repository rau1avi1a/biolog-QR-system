// app/(pages)/home/components/ItemListDisplay/hooks/state/drawerState/drawerState.state.js

import { useState, useRef, useEffect } from 'react';

/**
 * Drawer state management for ItemListDisplay
 * Handles QR scanner modal state (Create drawer removed - will be NetSuite integration)
 */

const useDrawerState = () => {
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Safe state setter wrapper
  const safeSetState = (setter) => {
    return (...args) => {
      if (isMountedRef.current) {
        setter(...args);
      }
    };
  };
  
  const openQRScanner = () => {
    if (isMountedRef.current) {
      setQrScannerOpen(true);
    }
  };
  
  const closeQRScanner = () => {
    if (isMountedRef.current) {
      setQrScannerOpen(false);
    }
  };
  
  return {
    qrScannerOpen,
    openQRScanner: safeSetState(openQRScanner),
    closeQRScanner: safeSetState(closeQRScanner)
  };
};

export { useDrawerState };