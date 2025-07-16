// app/(pages)/home/components/ItemListDisplay/hooks/core/itemGrouping/itemGrouping.core.js

/**
 * Core grouping logic for items
 * Pre-computes grouped items by type for faster tab switching
 */

const sortItemsBySKU = (items) => {
  return items.sort((a, b) => {
    // Extract numeric part from SKU (e.g., "24-001000" -> 1000)
    const getNumericPart = (sku) => {
      const match = sku.match(/24-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const numA = getNumericPart(a.sku || '');
    const numB = getNumericPart(b.sku || '');
    
    return numA - numB;
  });
};

const groupItemsByType = (allItems) => {
  const groups = {
    chemical: sortItemsBySKU(allItems.filter(i => i.itemType === 'chemical')),
    solution: sortItemsBySKU(allItems.filter(i => i.itemType === 'solution')),
    product: sortItemsBySKU(allItems.filter(i => i.itemType === 'product')),
    all: sortItemsBySKU(allItems)
  };
  return groups;
};

const getItemsForTab = (groupedItems, tabType) => {
  return groupedItems[tabType] || [];
};

const getSuggestionsForTab = (groupedItems, activeTab) => {
  if (activeTab === 'overview') return [];
  return groupedItems[activeTab] || [];
};

const getTabItemCount = (groupedItems, tabType) => {
  const items = groupedItems[tabType] || [];
  return items.length;
};

export {
  groupItemsByType,
  getItemsForTab,
  getSuggestionsForTab,
  getTabItemCount,
  sortItemsBySKU
};