// services/netsuite/index.js - Updated with enhanced services

export {
    NetSuiteAuth,
    createNetSuiteAuth,
    createNetSuiteAuthById
  } from './auth.service.js';
  
  export {
    NetSuiteBOMService,
    createBOMService
  } from './bom.service.js';
  
  export {
    NetSuiteWorkOrderService,
    createWorkOrderService,
    createWorkOrderFromBatch
  } from './workorder.service.js';
  
  export {
    NetSuiteMappingService,
    createMappingService,
    mapNetSuiteComponents
  } from './mapping.service.js';
  