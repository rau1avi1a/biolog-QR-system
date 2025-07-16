// app/(pages)/home/components/QRScanner/hooks/core/qrDetection/qrDetection.core.js

import jsQR from 'jsqr';

/**
 * Core QR detection logic for QR Scanner
 * Handles QR code scanning from video feed
 */

const captureVideoFrame = (videoElement, canvasElement) => {
  if (!videoElement || !canvasElement) {
    throw new Error('Video element or canvas element not available');
  }

  if (videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
    return null;
  }

  const canvas = canvasElement;
  const context = canvas.getContext('2d');
  
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  
  return context.getImageData(0, 0, canvas.width, canvas.height);
};

const detectQRCode = (imageData) => {
  if (!imageData) return null;
  
  try {
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    return code ? code.data : null;
  } catch (error) {
    console.error('QR detection error:', error);
    return null;
  }
};

const startQRDetection = (videoElement, canvasElement, onQRDetected, interval = 100) => {
  const detectInterval = setInterval(() => {
    try {
      const imageData = captureVideoFrame(videoElement, canvasElement);
      const qrData = detectQRCode(imageData);
      
      if (qrData) {
        clearInterval(detectInterval);
        onQRDetected(qrData);
      }
    } catch (error) {
      console.error('QR detection loop error:', error);
    }
  }, interval);
  
  return detectInterval;
};

const stopQRDetection = (detectionInterval) => {
  if (detectionInterval) {
    clearInterval(detectionInterval);
  }
};

export {
  captureVideoFrame,
  detectQRCode,
  startQRDetection,
  stopQRDetection
};