// models/index.js - Consolidated export of all models
import Batch from './Batch.js';
import CycleCount from './CycleCount.js';
import File from './File.js';
import Folder from './Folder.js';
import { InventoryTxn } from './InventoryTxn.js';
import { Item, Chemical, Solution, Product } from './Item.js';
import { PurchaseOrder } from './PurchaseOrder.js';
import Role from './Role.js';
import User from './User.js';
import { Vendor } from './Vendor.js';
import { VendorItem } from './VendorItem.js';

// Export all models as named exports
export {
  Batch,
  CycleCount,
  File,
  Folder,
  InventoryTxn,
  Item,
  Chemical,
  Solution,
  Product,
  PurchaseOrder,
  Role,
  User,
  Vendor,
  VendorItem
};

// Also export as a grouped object for convenience
export const models = {
  Batch,
  CycleCount,
  File,
  Folder,
  InventoryTxn,
  Item,
  Chemical,
  Solution,
  Product,
  PurchaseOrder,
  Role,
  User,
  Vendor,
  VendorItem
};

// Export default as the models object
export default models;