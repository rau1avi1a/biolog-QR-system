// services/index.js - Consolidated export of all services
import BaseService from './base.service.js';
import * as archiveService from './archive.service.js';
import * as batchService from './batch.service.js';
import * as fileService from './file.service.js';
import * as itemService from './item.service.js';
import * as purchaseOrderService from './purchaseOrder.service.js';
import { txnService } from './txn.service.js';
import { vendorService } from './vendor.service.js';
import * as netsuiteService from './netsuite/index.js';

// Export base service for creating new dynamic services
export { BaseService };

// Export all services as named exports
export {
  archiveService,
  batchService,
  fileService,
  itemService,
  netsuiteService,
  purchaseOrderService,
  txnService,
  vendorService
};

// Also export as a grouped object for convenience
export const services = {
  BaseService,
  archive: archiveService,
  batch: batchService,
  file: fileService,
  item: itemService,
  netsuite: netsuiteService,
  purchaseOrder: purchaseOrderService,
  txn: txnService,
  vendor: vendorService
};

// Export default as the services object
export default services;