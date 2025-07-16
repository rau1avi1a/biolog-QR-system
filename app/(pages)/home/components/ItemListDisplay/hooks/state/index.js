// app/(pages)/home/components/ItemListDisplay/hooks/state/index.js

/**
 * State management orchestrator for ItemListDisplay
 * Imports all state hooks and manages their interactions
 */

import { useSearchState } from './searchState/searchState.state.js';
import { useTabState } from './tabState/tabState.state.js';
import { useDrawerState } from './drawerState/drawerState.state.js';

/**
 * Main state hook that combines all state management
 * This is the primary interface for the component to use
 */
const useItemListDisplayState = () => {
  // Get all individual state hooks
  const searchState = useSearchState();
  const tabState = useTabState();
  const drawerState = useDrawerState();
  
  // Enhanced tab change that also clears search
  const handleTabChangeWithClear = (newTab) => {
    tabState.handleTabChange(newTab);
    searchState.clearSearch();
  };
  
  // Combined state and handlers
  return {
    // Search state
    searchQuery: searchState.searchQuery,
    searchFilters: searchState.searchFilters,
    showLowStockOnly: searchState.showLowStockOnly,
    isSearching: searchState.isSearching,
    handleSearchChange: searchState.handleSearchChange,
    handleFiltersChange: searchState.handleFiltersChange,
    handleLowStockToggle: searchState.handleLowStockToggle,
    clearSearch: searchState.clearSearch,
    
    // Tab state
    activeTab: tabState.activeTab,
    isTabLoading: tabState.isTabLoading,
    isOverviewTab: tabState.isOverviewTab,
    isAllTab: tabState.isAllTab,
    isSpecificTypeTab: tabState.isSpecificTypeTab,
    handleTabChange: handleTabChangeWithClear,
    
    // Drawer state (QR Scanner only)
    qrScannerOpen: drawerState.qrScannerOpen,
    openQRScanner: drawerState.openQRScanner,
    closeQRScanner: drawerState.closeQRScanner
  };
};

// Export individual hooks as well for flexibility
export {
  useSearchState,
  useTabState,
  useDrawerState,
  useItemListDisplayState
};