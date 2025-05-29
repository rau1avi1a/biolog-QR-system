'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function UploadCSV() {
  const [busy, setBusy] = useState(false);
  const pickRef          = useRef(null);

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setBusy(false);
    alert(data.message || data.error || 'Upload finished');
    if (res.ok) window.location.reload();      // refresh list
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
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => pickRef.current?.click()}
        className="mb-4"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : 'Upload CSV'}
      </Button>
    </>
  );
}
