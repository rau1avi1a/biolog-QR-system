// app/(pages)/home/components/QRScanner/hooks/core/index.js

/**
 * Core functionality orchestrator for QRScanner
 * Imports all core functions and manages their interactions
 */

import {
  enumerateCameraDevices,
  createCameraConstraints,
  initializeCamera,
  stopCameraStream,
  setupVideoElement,
  switchToNextCamera
} from './cameraManagement/cameraManagement.core.js';

import {
  captureVideoFrame,
  detectQRCode,
  startQRDetection,
  stopQRDetection
} from './qrDetection/qrDetection.core.js';

import {
  extractIdFromQRData,
  findItemByMultipleCriteria,
  findMatchedLot,
  determineMatchType,
  processItemLookup
} from './itemLookup/itemLookup.core.js';

/**
 * Main orchestrated function for complete QR scanning workflow
 */
const initializeQRScanner = async (selectedDevice) => {
  try {
    // Get available devices
    const devices = await enumerateCameraDevices();
    
    // Initialize camera
    const stream = await initializeCamera(selectedDevice);
    
    return {
      devices,
      stream,
      success: true
    };
  } catch (error) {
    return {
      devices: [],
      stream: null,
      success: false,
      error: error.message
    };
  }
};

/**
 * Complete QR scanning process
 */
const performQRScan = async (qrData, allItems, onScanComplete) => {
  try {
    const result = await processItemLookup(qrData, allItems);
    onScanComplete(result);
    return result;
  } catch (error) {
    console.error('QR scan process error:', error);
    onScanComplete(null);
    return null;
  }
};

/**
 * Cleanup function for QR scanner
 */
const cleanupQRScanner = (stream, detectionInterval) => {
  stopCameraStream(stream);
  stopQRDetection(detectionInterval);
};

// Export all core functionality
export {
  // Camera management
  enumerateCameraDevices,
  createCameraConstraints,
  initializeCamera,
  stopCameraStream,
  setupVideoElement,
  switchToNextCamera,
  
  // QR detection
  captureVideoFrame,
  detectQRCode,
  startQRDetection,
  stopQRDetection,
  
  // Item lookup
  extractIdFromQRData,
  findItemByMultipleCriteria,
  findMatchedLot,
  determineMatchType,
  processItemLookup,
  
  // Orchestrated functions
  initializeQRScanner,
  performQRScan,
  cleanupQRScanner
};