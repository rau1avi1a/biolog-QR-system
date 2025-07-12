// app/files/components/PDFEditor/hooks/core/pdf/pdf.core.js
'use client';

import { useState, useCallback, useEffect } from 'react';

/**
 * PDF Core Hook
 * Handles PDF validation, processing, and blob URI management
 */
export function usePdf(doc) {
  const [blobUri, setBlobUri] = useState(doc?.pdf);
  const [pages, setPages] = useState(1);

  // EXTRACTED: PDF validation function from your core.js
  const validateAndCleanBase64 = useCallback((data, contentType = 'application/pdf') => {
    if (!data) return null;
    
    try {
      let cleanedData = data;
      
      // Handle object format from backend (most common now)
      if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
        console.log('📄 Processing PDF object format:', {
          hasData: !!data.data,
          dataType: typeof data.data,
          hasContentType: !!data.contentType,
          contentType: data.contentType
        });
        
        if (data.data) {
          const objContentType = data.contentType || contentType;
          return validateAndCleanBase64(data.data, objContentType);
        } else {
          console.error('📄 PDF object has no data property');
          return null;
        }
      }
      
      // If it's already a data URL, extract just the base64 part for validation
      if (typeof data === 'string' && data.startsWith('data:')) {
        const base64Match = data.match(/^data:([^;]+);base64,(.+)$/);
        if (base64Match) {
          const base64Part = base64Match[2];
          atob(base64Part); // Test if valid
          return data;
        }
      }
      
      // If it's a Buffer, convert to base64 string
      if (Buffer.isBuffer(data)) {
        const base64String = data.toString('base64');
        atob(base64String); // Test if valid
        return `data:${contentType};base64,${base64String}`;
      }
      
      // Handle serialized Buffer from MongoDB/API
      if (typeof data === 'object' && data.type === 'Buffer' && Array.isArray(data.data)) {
        console.log('📄 Processing serialized Buffer from API');
        const buffer = Buffer.from(data.data);
        const base64String = buffer.toString('base64');
        atob(base64String); // Test if valid
        return `data:${contentType};base64,${base64String}`;
      }
      
      // If it's a plain string, assume it's base64 and test it
      if (typeof data === 'string') {
        const cleanBase64 = data.replace(/\s/g, '');
        atob(cleanBase64); // Test if valid
        return `data:${contentType};base64,${cleanBase64}`;
      }
      
      console.error('📄 Unknown data format:', typeof data, data?.constructor?.name);
      return null;
      
    } catch (error) {
      console.error('📄 Base64 validation failed:', error.message);
      console.error('📄 Data info:', {
        type: typeof data,
        constructor: data?.constructor?.name,
        isBuffer: Buffer.isBuffer(data),
        hasData: data?.data ? 'yes' : 'no',
        preview: typeof data === 'string' ? data.substring(0, 100) : 'Not a string'
      });
      return null;
    }
  }, []);

  // EXTRACTED: PDF debugging function from your core.js
  const debugPdfData = useCallback((label, data) => {
    console.log(`🔍 PDF DEBUG [${label}]:`, {
      hasData: !!data,
      type: typeof data,
      isString: typeof data === 'string',
      isObject: typeof data === 'object' && data !== null,
      isBuffer: Buffer.isBuffer(data),
      hasDataProperty: data?.data ? 'yes' : 'no',
      length: data?.length,
      startsWithData: data?.startsWith?.('data:'),
      startsWithJVBER: data?.startsWith?.('JVBER'),
      first100: data?.substring?.(0, 100),
      containsComma: data?.includes?.(','),
      objectKeys: typeof data === 'object' && data !== null ? Object.keys(data) : null,
      dataPropertyType: data?.data ? typeof data.data : null,
      contentType: data?.contentType || null
    });
  }, []);

  // EXTRACTED: PDF source determination logic from your core.js
  const determinePdfSource = useCallback((doc) => {
    const isBatchFile = doc?.sourceType === 'batch' || 
                       doc?.isBatch || 
                       doc?.status || 
                       doc?.runNumber ||
                       doc?.batchId;

    let validPdfData = null;
    
    if (isBatchFile) {
      console.log('🔧 Handling batch file PDF data');
      
      if (doc?.signedPdf?.data) {
        console.log('✅ Using signedPdf.data from batch (has overlays baked in)');
        validPdfData = validateAndCleanBase64(
          doc.signedPdf.data,
          doc.signedPdf.contentType || 'application/pdf'
        );
      } else if (doc?.pdf) {
        console.log('✅ Using doc.pdf from batch (no overlays baked yet)');
        validPdfData = validateAndCleanBase64(doc.pdf);
      } else {
        console.log('⚠️ Batch has no PDF data, might need to load from original file');
        validPdfData = null;
      }
    } else {
      if (doc?.pdf) {
        console.log('✅ Processing original file PDF');
        validPdfData = validateAndCleanBase64(doc.pdf);
      }
    }

    return validPdfData;
  }, [validateAndCleanBase64]);

  // EXTRACTED: isValidBase64DataUrl function from your core.js
  const isValidBase64DataUrl = useCallback((dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') {
      console.log('🔍 isValidBase64DataUrl: Invalid input type');
      return false;
    }
    
    if (!dataUrl.startsWith('data:')) {
      console.log('🔍 isValidBase64DataUrl: Not a data URL');
      return false;
    }
    
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      console.log('🔍 isValidBase64DataUrl: Invalid data URL format - wrong comma count');
      return false;
    }
    
    const base64Part = parts[1];
    if (!base64Part) {
      console.log('🔍 isValidBase64DataUrl: Empty base64 part');
      return false;
    }
    
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Part)) {
      console.log('🔍 isValidBase64DataUrl: Contains invalid base64 characters');
      return false;
    }
    
    if (base64Part.length % 4 !== 0) {
      console.log('🔍 isValidBase64DataUrl: Invalid base64 length (not multiple of 4)');
      return false;
    }
    
    try {
      atob(base64Part);
      console.log('🔍 isValidBase64DataUrl: Valid base64 data');
      return true;
    } catch (error) {
      console.log('🔍 isValidBase64DataUrl: Base64 decode failed:', error.message);
      return false;
    }
  }, []);

  // Process PDF when document changes
  useEffect(() => {
    if (doc) {
      const validPdfData = determinePdfSource(doc);
      debugPdfData('PDF Core Processing', validPdfData);
      setBlobUri(validPdfData);
    }
  }, [doc, determinePdfSource, debugPdfData]);

  return {
    // State
    blobUri,
    setBlobUri,
    pages,
    setPages,
    
    // Functions
    validateAndCleanBase64,
    debugPdfData,
    determinePdfSource,
    isValidBase64DataUrl
  };
}