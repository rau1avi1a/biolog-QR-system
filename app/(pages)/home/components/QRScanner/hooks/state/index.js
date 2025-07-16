// app/(pages)/home/components/QRScanner/hooks/state/index.js

/**
 * State management orchestrator for QRScanner
 * Imports all state hooks and manages their interactions
 */

import { useScannerState } from './scannerState/scannerState.state.js';
import { useDeviceState } from './deviceState/deviceState.state.js';

/**
 * Main state hook that combines all state management
 * This is the primary interface for the component to use
 */
const useQRScannerState = () => {
  // Get all individual state hooks
  const scannerState = useScannerState();
  const deviceState = useDeviceState();
  
  // Combined cleanup function
  const cleanup = () => {
    deviceState.cleanup();
    scannerState.resetAll();
  };
  
  // Combined initialization
  const initialize = (deviceList) => {
    deviceState.setDevicesState(deviceList);
    scannerState.resetAll();
  };
  
  // Combined scanning start
  const startScanning = () => {
    scannerState.startScanning();
  };
  
  // Combined scanning stop
  const stopScanning = () => {
    scannerState.stopScanning();
    deviceState.cleanup();
  };
  
  // Combined error handling
  const handleError = (error) => {
    scannerState.setErrorState(error);
    deviceState.cleanup();
  };
  
  // Combined state and handlers
  return {
    // Scanner state
    scanning: scannerState.scanning,
    error: scannerState.error,
    scanResult: scannerState.scanResult,
    foundItem: scannerState.foundItem,
    showDetails: scannerState.showDetails,
    setScanResultState: scannerState.setScanResultState,
    setFoundItemState: scannerState.setFoundItemState,
    resetToScanning: scannerState.resetToScanning,
    resetAll: scannerState.resetAll,
    
    // Device state
    devices: deviceState.devices,
    selectedDevice: deviceState.selectedDevice,
    stream: deviceState.stream,
    detectionInterval: deviceState.detectionInterval,
    streamRef: deviceState.streamRef,
    scanIntervalRef: deviceState.scanIntervalRef,
    setDevicesState: deviceState.setDevicesState,
    setSelectedDeviceState: deviceState.setSelectedDeviceState,
    setStreamState: deviceState.setStreamState,
    setDetectionIntervalState: deviceState.setDetectionIntervalState,
    switchDevice: deviceState.switchDevice,
    
    // Combined actions
    initialize,
    startScanning,
    stopScanning,
    handleError,
    cleanup
  };
};

// Export individual hooks as well for flexibility
export {
  useScannerState,
  useDeviceState,
  useQRScannerState
};