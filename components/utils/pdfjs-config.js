import { pdfjs } from 'react-pdf';

// Ensure the worker is loaded from node_modules
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}