// app/(pages)/home/components/QRScanner/hooks/core/cameraManagement/cameraManagement.core.js

/**
 * Core camera management logic for QR Scanner
 * Handles camera initialization, device enumeration, and stream management
 */

const enumerateCameraDevices = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  } catch (error) {
    console.error('Failed to enumerate camera devices:', error);
    throw new Error('Failed to enumerate camera devices');
  }
};

const createCameraConstraints = (selectedDevice) => {
  return {
    video: {
      deviceId: selectedDevice || undefined,
      facingMode: selectedDevice ? undefined : 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
};

const initializeCamera = async (selectedDevice) => {
  try {
    const constraints = createCameraConstraints(selectedDevice);
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error('Failed to initialize camera:', error);
    throw new Error('Failed to access camera. Please ensure camera permissions are granted.');
  }
};

const stopCameraStream = (stream) => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

const setupVideoElement = (videoElement, stream) => {
  if (videoElement && stream) {
    videoElement.srcObject = stream;
    return videoElement.play();
  }
  return Promise.reject('Video element or stream not available');
};

const switchToNextCamera = (devices, currentDeviceId) => {
  if (devices.length <= 1) return currentDeviceId;
  
  const currentIndex = devices.findIndex(device => device.deviceId === currentDeviceId);
  const nextIndex = (currentIndex + 1) % devices.length;
  return devices[nextIndex].deviceId;
};

export {
  enumerateCameraDevices,
  createCameraConstraints,
  initializeCamera,
  stopCameraStream,
  setupVideoElement,
  switchToNextCamera
};