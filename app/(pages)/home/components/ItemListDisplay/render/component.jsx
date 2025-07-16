// app/(pages)/home/components/ItemListDisplay/render/ItemListDisplay.jsx

'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import {
  Tabs, TabsList, TabsTrigger, TabsContent
} from '@/components/ui/shadcn/components/tabs';
import { ScrollArea } from '@/components/ui/shadcn/components/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/shadcn/components/card';
import { 
  Plus, 
  Package, 
  TestTube, 
  Beaker, 
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

import SearchBar from '@/components/ui/shadcn/components/SearchBar';
import QRScannerModal from '../../QRScanner';

// Import hooks
import { useItemListDisplayState } from '../hooks/state';
import { 
  processItemsForDisplay, 
  getOverviewData, 
  getItemIcon,
  getStockBadgeVariant,
  calculateStockStatus
} from '../hooks/core';

// Sub-components
const getItemIconComponent = (type) => {
  switch (type) {
    case 'chemical': return <TestTube className="h-4 w-4" />;
    case 'solution': return <Beaker className="h-4 w-4" />;
    case 'product': return <Package className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
};

const StockBadge = ({ status, qty, uom }) => {
  const variant = getStockBadgeVariant(status);
  
  return (
    <Badge variant={variant} className="text-xs">
      {qty} {uom}
    </Badge>
  );
};

const ItemCard = ({ item }) => {
  const stockStatus = calculateStockStatus(item);

  return (
    <Link href={`/${item._id}`} className="block">
      <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
              {getItemIconComponent(item.itemType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                  {item.displayName}
                </h3>
                {stockStatus === 'low' && (
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                )}
              </div>
              
              <p className="text-xs text-muted-foreground mb-2 font-mono">
                {item.sku}
              </p>

              <div className="flex items-center justify-between gap-2">
                <StockBadge 
                  status={stockStatus} 
                  qty={item.qtyOnHand} 
                  uom={item.uom} 
                />
                {item.location && (
                  <span className="text-xs text-muted-foreground truncate">
                    📍 {item.location}
                  </span>
                )}
              </div>

              {item.vendor && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {item.vendor}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const StatsCard = ({ title, value, icon: Icon, trend, className = "" }) => (
  <Card className={`${className}`}>
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">{value}</p>
            {trend && <TrendingUp className="h-4 w-4 text-green-500" />}
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

const ItemGrid = ({ items, emptyMessage, isLoading }) => {
  // Show loading spinner when tab is switching
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return items.length === 0 ? (
    <div className="text-center py-12">
      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <p className="text-muted-foreground">{emptyMessage}</p>
    </div>
  ) : (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map(item => (
        <ItemCard key={item._id} item={item} />
      ))}
    </div>
  );
};

const ItemListDisplay = ({ allItems, onQRScan, onItemFound }) => {
  const state = useItemListDisplayState();
  
  // Debug logging
  console.log('Current tab:', state.activeTab);
  console.log('Handle tab change function:', typeof state.handleTabChange);
  
  // Test handler with more debugging
  const testTabChange = (newTab) => {
    console.log('Tab change clicked:', newTab);
    console.log('State object:', state);
    console.log('Calling state.handleTabChange...');
    try {
      state.handleTabChange(newTab);
      console.log('Called successfully');
    } catch (error) {
      console.error('Error calling handleTabChange:', error);
    }
  };

  // Simple debounced search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef(null);
  
  // Simple tab state (since the complex one wasn't working)
  const [testTab, setTestTab] = useState('overview');
  const simpleTabChange = (newTab) => {
    console.log('Simple tab change:', newTab);
    setTestTab(newTab);
  };
  
  // Debounce the search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);
  
  const handleSearchChange = (query) => {
    console.log('Search input changed:', query);
    setSearchQuery(query);
  };
  
  // Process items for display using core logic
  const displayData = useMemo(() => {
    console.log('Processing display data for tab:', testTab, 'search:', debouncedSearchQuery);
    
    if (testTab === 'overview') {
      return getOverviewData(allItems);
    }
    
    return processItemsForDisplay(
      allItems,
      testTab,
      debouncedSearchQuery, // Use debounced query
      state.searchFilters,
      state.showLowStockOnly
    );
  }, [allItems, testTab, debouncedSearchQuery, state.searchFilters, state.showLowStockOnly]);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Laboratory Inventory</h1>
            <p className="text-muted-foreground">
              Manage your chemicals, solutions, and products efficiently
            </p>
          </div>

          <Tabs value={testTab} onValueChange={simpleTabChange} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="grid w-full max-w-md grid-cols-5">
                <TabsTrigger value="overview" className="cursor-pointer">Overview</TabsTrigger>
                <TabsTrigger value="chemical" className="cursor-pointer">
                  <TestTube className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Chemicals</span>
                </TabsTrigger>
                <TabsTrigger value="solution" className="cursor-pointer">
                  <Beaker className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Solutions</span>
                </TabsTrigger>
                <TabsTrigger value="product" className="cursor-pointer">
                  <Package className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Products</span>
                </TabsTrigger>
                <TabsTrigger value="all" className="cursor-pointer">All</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button
                  variant={state.showLowStockOnly ? "default" : "outline"}
                  size="sm"
                  onClick={state.handleLowStockToggle}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Low Stock
                </Button>
              </div>
            </div>

            {/* Search Bar - Only show for non-overview tabs */}
            {testTab !== 'overview' && (
              <SearchBar
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                suggestions={displayData.suggestions || []}
                filters={state.searchFilters}
                onFiltersChange={state.handleFiltersChange}
                onQRScan={state.openQRScanner}
                showQRButton={false}
                showFilters={false}
              />
            )}

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Total Items"
                  value={displayData.stats?.total || 0}
                  icon={Package}
                />
                <StatsCard
                  title="Chemicals"
                  value={displayData.stats?.chemical || 0}
                  icon={TestTube}
                  className="border-blue-200 dark:border-blue-800"
                />
                <StatsCard
                  title="Solutions"
                  value={displayData.stats?.solution || 0}
                  icon={Beaker}
                  className="border-green-200 dark:border-green-800"
                />
                <StatsCard
                  title="Low Stock Items"
                  value={displayData.stats?.lowStock || 0}
                  icon={AlertTriangle}
                  className="border-amber-200 dark:border-amber-800"
                />
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <h3 className="text-lg font-semibold">Quick Actions</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" disabled className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Chemical (NetSuite)
                    </Button>
                    <Button variant="outline" disabled className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Solution (NetSuite)
                    </Button>
                    <Button variant="outline" disabled className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product (NetSuite)
                    </Button>
                    
                    <Button variant="outline" disabled className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Upload CSV (NetSuite)
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Items or Low Stock Alert */}
              {displayData.stats?.lowStock > 0 && (
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500" />
                      <h3 className="text-lg font-semibold">Low Stock Alert</h3>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-64">
                      <ItemGrid 
                        items={displayData.lowStockItems || []}
                        emptyMessage="No low stock items"
                        isLoading={testTab === 'overview' ? false : state.isTabLoading}
                      />
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Individual Category Tabs */}
            {['chemical', 'solution', 'product', 'all'].map(type => (
              <TabsContent key={type} value={type} className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold capitalize">
                      {type === 'all' ? 'All Items' : `${type}s`}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {displayData.count || 0} items
                      {state.showLowStockOnly && " (low stock only)"}
                      {state.searchQuery && ` matching "${state.searchQuery}"`}
                    </p>
                  </div>
                  
                  {type !== 'all' && (
                    <div className="flex gap-2">
                      <Button size="sm" disabled variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add {type} (NetSuite)
                      </Button>
                      <Button size="sm" disabled variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Upload (NetSuite)
                      </Button>
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[calc(100vh-300px)]">
                  <ItemGrid 
                    items={displayData.items || []}
                    emptyMessage={
                      debouncedSearchQuery 
                        ? `No ${type === 'all' ? 'items' : type + 's'} found matching "${debouncedSearchQuery}"`
                        : `No ${type === 'all' ? 'items' : type + 's'} in this category`
                    }
                    isLoading={false}
                  />
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QRScannerModal
        open={state.qrScannerOpen}
        onOpenChange={state.closeQRScanner}
        onScan={onQRScan}
        onItemFound={onItemFound}
        allItems={allItems}
      />
    </>
  );
};

export default ItemListDisplay;