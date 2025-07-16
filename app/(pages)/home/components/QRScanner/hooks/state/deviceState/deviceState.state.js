// app/(pages)/home/components/QRScanner/hooks/state/deviceState/deviceState.state.js

import { useState, useRef, useEffect } from 'react';

/**
 * Device state management for QRScanner
 * Handles camera devices and selection
 */

const useDeviceState = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [stream, setStream] = useState(null);
  const [detectionInterval, setDetectionInterval] = useState(null);
  
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      cleanup();
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
  
  const setDevicesState = (deviceList) => {
    if (isMountedRef.current) {
      setDevices(deviceList);
      if (deviceList.length > 0 && !selectedDevice) {
        setSelectedDevice(deviceList[0].deviceId);
      }
    }
  };
  
  const setSelectedDeviceState = (deviceId) => {
    if (isMountedRef.current) {
      setSelectedDevice(deviceId);
    }
  };
  
  const setStreamState = (newStream) => {
    if (isMountedRef.current) {
      setStream(newStream);
      streamRef.current = newStream;
    }
  };
  
  const setDetectionIntervalState = (interval) => {
    if (isMountedRef.current) {
      setDetectionInterval(interval);
      scanIntervalRef.current = interval;
    }
  };
  
  const switchDevice = () => {
    if (devices.length <= 1) return;
    
    const currentIndex = devices.findIndex(device => device.deviceId === selectedDevice);
    const nextIndex = (currentIndex + 1) % devices.length;
    setSelectedDeviceState(devices[nextIndex].deviceId);
  };
  
  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (isMountedRef.current) {
      setStream(null);
      setDetectionInterval(null);
    }
  };
  
  return {
    devices,
    selectedDevice,
    stream,
    detectionInterval,
    streamRef,
    scanIntervalRef,
    setDevicesState: safeSetState(setDevicesState),
    setSelectedDeviceState: safeSetState(setSelectedDeviceState),
    setStreamState: safeSetState(setStreamState),
    setDetectionIntervalState: safeSetState(setDetectionIntervalState),
    switchDevice: safeSetState(switchDevice),
    cleanup
  };
};

export { useDeviceState };