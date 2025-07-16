// app/(pages)/home/components/ItemListDisplay/hooks/core/itemFiltering/itemFiltering.core.js

/**
 * Core filtering logic for items
 * Handles text search, advanced filters, and stock status filtering
 */

const filterByText = (items, searchQuery) => {
  if (!searchQuery.trim()) return items;
  
  const query = searchQuery.toLowerCase();
  return items.filter(item => 
    item.displayName.toLowerCase().includes(query) ||
    item.sku.toLowerCase().includes(query) ||
    item.description.toLowerCase().includes(query) ||
    item.vendor.toLowerCase().includes(query) ||
    item.location.toLowerCase().includes(query)
  );
};

const filterByAdvancedFilters = (items, searchFilters) => {
  let filteredItems = items;
  
  Object.entries(searchFilters).forEach(([category, values]) => {
    if (values && values.length > 0) {
      filteredItems = filteredItems.filter(item => {
        switch (category) {
          case 'itemType':
            return values.includes(item.itemType);
          case 'stockStatus':
            return values.includes(getStockStatus(item));
          case 'location':
            return values.includes(item.location);
          case 'vendor':
            return values.includes(item.vendor);
          default:
            return true;
        }
      });
    }
  });
  
  return filteredItems;
};

const filterByStockStatus = (items, showLowStockOnly) => {
  if (!showLowStockOnly) return items;
  return items.filter(item => getStockStatus(item) === 'low');
};

const getStockStatus = (item) => {
  const minQty = item.minQty || 0;
  if (item.qtyOnHand <= minQty) return 'low';
  if (item.qtyOnHand <= minQty * 2) return 'medium';
  return 'good';
};

const applyAllFilters = (items, searchQuery, searchFilters, showLowStockOnly) => {
  let filteredItems = items;
  
  // Apply filters in order
  filteredItems = filterByText(filteredItems, searchQuery);
  filteredItems = filterByAdvancedFilters(filteredItems, searchFilters);
  filteredItems = filterByStockStatus(filteredItems, showLowStockOnly);
  
  return filteredItems;
};

export {
  filterByText,
  filterByAdvancedFilters,
  filterByStockStatus,
  getStockStatus,
  applyAllFilters
};