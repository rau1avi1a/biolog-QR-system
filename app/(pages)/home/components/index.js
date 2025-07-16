// app/(pages)/home/components/index.js

/**
 * Main components index for home page
 * Exports all components for easy importing
 * 
 * Note: CreateItemDrawer and UploadCSV will be replaced with NetSuite integration
 */

import ItemListDisplay from './ItemListDisplay';
import QRScannerModal from './QRScanner';

export {
  ItemListDisplay,
  QRScannerModal
};

export default {
  ItemListDisplay,
  QRScannerModal
};