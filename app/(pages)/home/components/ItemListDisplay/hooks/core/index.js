// app/(pages)/home/components/ItemListDisplay/hooks/core/index.js

/**
 * Core functionality orchestrator for ItemListDisplay
 * Imports all core functions and manages their interactions
 */

import {
  filterByText,
  filterByAdvancedFilters,
  filterByStockStatus,
  getStockStatus,
  applyAllFilters
} from './itemFiltering/itemFiltering.core.js';

import {
  groupItemsByType,
  getItemsForTab,
  getSuggestionsForTab,
  getTabItemCount
} from './itemGrouping/itemGrouping.core.js';

import {
  calculateStockStatus,
  calculateStats,
  getLowStockItems,
  getStockBadgeVariant
} from './stockCalculation/stockCalculation.core.js';

/**
 * Main core function that combines filtering, grouping, and calculations
 * This is the primary interface for the component to use
 */
const processItemsForDisplay = (allItems, activeTab, searchQuery, searchFilters, showLowStockOnly) => {
  // Group items by type first
  const groupedItems = groupItemsByType(allItems);
  
  // Get items for current tab
  const tabItems = getItemsForTab(groupedItems, activeTab);
  
  // Apply all filters
  const filteredItems = applyAllFilters(tabItems, searchQuery, searchFilters, showLowStockOnly);
  
  return {
    items: filteredItems,
    count: filteredItems.length,
    suggestions: getSuggestionsForTab(groupedItems, activeTab)
  };
};

/**
 * Get complete overview data for the overview tab
 */
const getOverviewData = (allItems) => {
  const stats = calculateStats(allItems);
  const lowStockItems = getLowStockItems(allItems);
  
  return {
    stats,
    lowStockItems
  };
};

/**
 * Utility function to get item icon based on type
 */
const getItemIcon = (type) => {
  const iconMap = {
    chemical: 'TestTube',
    solution: 'Beaker', 
    product: 'Package'
  };
  return iconMap[type] || 'Package';
};

// Export all core functionality
export {
  // Individual functions
  filterByText,
  filterByAdvancedFilters,
  filterByStockStatus,
  getStockStatus,
  applyAllFilters,
  groupItemsByType,
  getItemsForTab,
  getSuggestionsForTab,
  getTabItemCount,
  calculateStockStatus,
  calculateStats,
  getLowStockItems,
  getStockBadgeVariant,
  
  // Orchestrated functions
  processItemsForDisplay,
  getOverviewData,
  getItemIcon
};