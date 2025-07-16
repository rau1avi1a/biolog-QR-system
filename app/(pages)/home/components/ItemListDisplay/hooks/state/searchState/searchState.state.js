// app/(pages)/home/components/ItemListDisplay/hooks/state/searchState/searchState.state.js

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Search state management for ItemListDisplay
 * Handles search query, filters, and loading states
 */

const useSearchState = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilters, setSearchFilters] = useState({});
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Debounced search to avoid too many updates
  const searchTimeoutRef = useRef(null);
  
  // Use useCallback to prevent recreating the function on every render
  const handleSearchChange = useCallback((query) => {
    setIsSearching(true);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout with longer delay to reduce lag
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(query);
      setIsSearching(false);
    }, 500); // Increased from 300ms to 500ms
  }, []);
  
  const handleFiltersChange = useCallback((filters) => {
    setSearchFilters(filters);
  }, []);
  
  const handleLowStockToggle = useCallback(() => {
    setShowLowStockOnly(prev => !prev);
  }, []);
  
  const clearSearch = useCallback(() => {
    // Clear timeout if active
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    setSearchQuery('');
    setSearchFilters({});
    setShowLowStockOnly(false);
    setIsSearching(false);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    searchQuery,
    searchFilters,
    showLowStockOnly,
    isSearching,
    handleSearchChange,
    handleFiltersChange,
    handleLowStockToggle,
    clearSearch
  };
};

export { useSearchState };