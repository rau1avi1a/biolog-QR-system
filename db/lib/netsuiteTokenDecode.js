// utils/secretDecoder.js
export function decodeIfBase64(str) {
    if (!str || typeof str !== 'string') return str;
    try {
      // is it valid base64 (round-trip test)?
      const buf = Buffer.from(str, 'base64');
      if (buf.toString('base64') === str.trim()) {
        return buf.toString('utf8');
      }
    } catch {
      // not base64
    }
    return str;
  }
  