// db/services/app/index.js - Consolidated export of all services (clean version)
import { CoreService } from './core.service.js';
import batchService from './batch.service.js';
import fileService from './file.service.js';
import { itemService, txnService } from './inventory.service.js';
import { archiveService, poService, vendorService, cycleCountService } from './workflow.service.js';
import AsyncWorkOrderService from './async-workorder.service.js';
import * as netsuiteService from '../netsuite/index.js';

// =============================================================================
// CLEAN SERVICE EXPORTS - Only service instances
// =============================================================================

// Core services
export { CoreService };

// Main workflow services - export the service instances directly
export {
  batchService,
  fileService,
  itemService,
  txnService,
  archiveService,
  poService,
  vendorService,
  cycleCountService,
  AsyncWorkOrderService,
  netsuiteService
};

// =============================================================================
// COMPREHENSIVE SERVICES OBJECT
// =============================================================================

export const services = {
  // Core
  core: CoreService,
  
  // Main operations - use the service instances directly
  batch: batchService,
  file: fileService,
  item: itemService,
  transaction: txnService,
  
  // Workflow
  archive: archiveService,
  purchaseOrder: poService,
  vendor: vendorService,
  cycleCount: cycleCountService,
  asyncWorkOrder: AsyncWorkOrderService,
  
  // Integrations
  netsuite: netsuiteService
};

// Export default as the comprehensive services object
export default services;