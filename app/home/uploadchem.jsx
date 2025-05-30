'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';

export default function UploadCSV({ type = 'chemical', variant = 'outline', size = 'sm', className = '' }) {
  const [busy, setBusy] = useState(false);
  const pickRef = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      
      // Add type parameter to the API call
      const res = await fetch(`/api/upload?type=${type}`, { 
        method: 'POST', 
        body: fd 
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message || 'Upload finished successfully');
        window.location.reload(); // refresh list
      } else {
        alert(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + error.message);
    } finally {
      setBusy(false);
    }
  };

  const getButtonText = () => {
    if (busy) return '';
    return `Upload ${type.charAt(0).toUpperCase() + type.slice(1)} CSV`;
  };

  return (
    <>
      <input
        ref={pickRef}
        type="file"
        accept=".csv"
        hidden
        onChange={handleChange}
      />
      <Button
        variant={variant}
        size={size}
        disabled={busy}
        onClick={() => pickRef.current?.click()}
        className={className}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin mr-2" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {getButtonText()}
        {busy && 'Uploading...'}
      </Button>
    </>
  );
}