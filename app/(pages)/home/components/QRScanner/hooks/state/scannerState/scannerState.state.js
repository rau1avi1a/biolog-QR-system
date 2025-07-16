// app/(pages)/home/components/QRScanner/hooks/state/scannerState/scannerState.state.js

import { useState, useRef, useEffect } from 'react';

/**
 * Scanner state management for QRScanner
 * Handles scanning status, results, and error states
 */

const useScannerState = () => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [foundItem, setFoundItem] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
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
  
  const startScanning = () => {
    if (isMountedRef.current) {
      setScanning(true);
      setError(null);
      setShowDetails(false);
      setFoundItem(null);
    }
  };
  
  const stopScanning = () => {
    if (isMountedRef.current) {
      setScanning(false);
    }
  };
  
  const setErrorState = (errorMessage) => {
    if (isMountedRef.current) {
      setError(errorMessage);
      setScanning(false);
    }
  };
  
  const setScanResultState = (result) => {
    if (isMountedRef.current) {
      setScanResult(result);
      setScanning(false);
    }
  };
  
  const setFoundItemState = (item) => {
    if (isMountedRef.current) {
      setFoundItem(item);
      setShowDetails(true);
    }
  };
  
  const resetToScanning = () => {
    if (isMountedRef.current) {
      setShowDetails(false);
      setFoundItem(null);
      setError(null);
      setScanResult(null);
    }
  };
  
  const resetAll = () => {
    if (isMountedRef.current) {
      setScanning(false);
      setError(null);
      setScanResult(null);
      setFoundItem(null);
      setShowDetails(false);
    }
  };
  
  return {
    scanning,
    error,
    scanResult,
    foundItem,
    showDetails,
    startScanning: safeSetState(startScanning),
    stopScanning: safeSetState(stopScanning),
    setErrorState: safeSetState(setErrorState),
    setScanResultState: safeSetState(setScanResultState),
    setFoundItemState: safeSetState(setFoundItemState),
    resetToScanning: safeSetState(resetToScanning),
    resetAll: safeSetState(resetAll)
  };
};

export { useScannerState };