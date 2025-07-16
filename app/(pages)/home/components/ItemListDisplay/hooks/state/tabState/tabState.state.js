// app/(pages)/home/components/ItemListDisplay/hooks/state/tabState/tabState.state.js

import { useState, useEffect, useRef } from 'react';

/**
 * Tab state management for ItemListDisplay
 * Handles active tab, loading states, and tab switching logic
 */

const useTabState = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isTabLoading, setIsTabLoading] = useState(false);
  const isMountedRef = useRef(true);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Safe state setter wrapper
  const safeSetState = (setter) => {
    return (...args) => {
      if (isMountedRef.current) {
        setter(...args);
      }
    };
  };
  
  const handleTabChange = (newTab) => {
    if (!isMountedRef.current) return;
    
    setIsTabLoading(true);
    setActiveTab(newTab);
    
    // Small delay to show loading state
    const timer = setTimeout(() => {
      if (isMountedRef.current) {
        setIsTabLoading(false);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  };
  
  const isOverviewTab = activeTab === 'overview';
  const isAllTab = activeTab === 'all';
  const isSpecificTypeTab = !isOverviewTab && !isAllTab;
  
  return {
    activeTab,
    isTabLoading,
    isOverviewTab,
    isAllTab,
    isSpecificTypeTab,
    handleTabChange: safeSetState(handleTabChange)
  };
};

export { useTabState };