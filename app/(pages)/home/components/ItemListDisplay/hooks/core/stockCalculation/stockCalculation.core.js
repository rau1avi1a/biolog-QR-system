// app/(pages)/home/components/ItemListDisplay/hooks/core/stockCalculation/stockCalculation.core.js

/**
 * Core stock calculation logic
 * Handles stock status calculations and statistics
 */

const calculateStockStatus = (item) => {
  const minQty = item.minQty || 0;
  if (item.qtyOnHand <= minQty) return 'low';
  if (item.qtyOnHand <= minQty * 2) return 'medium';
  return 'good';
};

const calculateStats = (allItems) => {
  const stats = {
    total: allItems.length,
    chemical: allItems.filter(i => i.itemType === 'chemical').length,
    solution: allItems.filter(i => i.itemType === 'solution').length,
    product: allItems.filter(i => i.itemType === 'product').length,
    lowStock: allItems.filter(i => calculateStockStatus(i) === 'low').length
  };
  return stats;
};

const getLowStockItems = (allItems, limit = 8) => {
  return allItems
    .filter(i => calculateStockStatus(i) === 'low')
    .slice(0, limit);
};

const getStockBadgeVariant = (status) => {
  const variants = {
    low: 'destructive',
    medium: 'default',
    good: 'secondary'
  };
  return variants[status] || 'secondary';
};

export {
  calculateStockStatus,
  calculateStats,
  getLowStockItems,
  getStockBadgeVariant
};