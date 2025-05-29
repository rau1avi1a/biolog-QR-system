'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tabs, TabsList, TabsTrigger, TabsContent
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { 
  Plus, 
  Search, 
  Package, 
  TestTube, 
  Beaker, 
  AlertTriangle,
  Filter,
  TrendingUp
} from 'lucide-react';

import UploadCSV from './uploadchem';
import CreateItemDrawer from './create';
import SearchBar from '@/components/ui/SearchBar';
import QRScannerModal from '@/components/ui/QRScannerModal';

const getItemIcon = (type) => {
  switch (type) {
    case 'chemical': return <TestTube className="h-4 w-4" />;
    case 'solution': return <Beaker className="h-4 w-4" />;
    case 'product': return <Package className="h-4 w-4" />;
    default: return <Package className="h-4 w-4" />;
  }
};

const getStockStatus = (item) => {
  const minQty = item.minQty || 0;
  if (item.qtyOnHand <= minQty) return 'low';
  if (item.qtyOnHand <= minQty * 2) return 'medium';
  return 'good';
};

const StockBadge = ({ status, qty, uom }) => {
  const variants = {
    low: 'destructive',
    medium: 'default',
    good: 'secondary'
  };

  return (
    <Badge variant={variants[status]} className="text-xs">
      {qty} {uom}
    </Badge>
  );
};

const ItemCard = ({ item }) => {
  const stockStatus = getStockStatus(item);

  return (
    <Link href={`/${item._id}`} className="block">
      <Card className="group hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors">
              {getItemIcon(item.itemType)}
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

export default function ClientHome({ groups, allItems, stats }) {
  // Add ref to track if component is mounted
  const isMountedRef = useRef(true);
  
  const [drawer, setDrawer] = useState({ open: false, type: 'chemical' });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [searchFilters, setSearchFilters] = useState({});

  // Cleanup on unmount to prevent state updates
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

  // Memoized search and filter functionality
  const filteredItems = useMemo(() => {
    let items = allItems;

    // Apply text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.searchText.includes(query)
      );
    }

    // Apply advanced filters
    Object.entries(searchFilters).forEach(([category, values]) => {
      if (values && values.length > 0) {
        items = items.filter(item => {
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

    return items;
  }, [allItems, searchQuery, searchFilters]);

  // Filter by tab and stock status
  const getTabItems = (type) => {
    let items = type === 'all' ? filteredItems : filteredItems.filter(i => i.itemType === type);
    
    if (showLowStockOnly) {
      items = items.filter(i => getStockStatus(i) === 'low');
    }
    
    return items;
  };

  const openDrawer = type => {
    if (isMountedRef.current) {
      setDrawer({ open: true, type });
    }
  };

  // QR Scanner functions with safe state updates
  const handleQRScan = async (qrData) => {
    try {
      // Try to find item by QR data (assuming QR contains SKU or item ID)
      const foundItem = allItems.find(item => 
        item.sku === qrData || 
        item._id === qrData ||
        item.qrCode === qrData
      );
      return foundItem;
    } catch (error) {
      return null;
    }
  };

  const handleItemFound = (item) => {
    if (isMountedRef.current) {
      // Set search to the found item's name and switch to appropriate tab
      setSearchQuery(item.displayName);
      setActiveTab(item.itemType);
    }
  };

  const ItemGrid = ({ items, emptyMessage }) => (
    items.length === 0 ? (
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
    )
  );

  return (
    <>
      <CreateItemDrawer
        open={drawer.open}
        onOpenChange={safeSetState((o) => setDrawer({ ...drawer, open: o }))}
        type={drawer.type}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Laboratory Inventory</h1>
            <p className="text-muted-foreground">
              Manage your chemicals, solutions, and products efficiently
            </p>
          </div>

          {/* Search Bar */}
          <SearchBar
            searchQuery={searchQuery}
            onSearchChange={safeSetState(setSearchQuery)}
            suggestions={filteredItems}
            filters={searchFilters}
            onFiltersChange={safeSetState(setSearchFilters)}
            onQRScan={() => safeSetState(setQrScannerOpen)(true)}
            showQRButton={true}
          />

          <Tabs value={activeTab} onValueChange={safeSetState(setActiveTab)} className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <TabsList className="grid w-full max-w-md grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="chemical">
                  <TestTube className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Chemicals</span>
                </TabsTrigger>
                <TabsTrigger value="solution">
                  <Beaker className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Solutions</span>
                </TabsTrigger>
                <TabsTrigger value="product">
                  <Package className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Products</span>
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button
                  variant={showLowStockOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => safeSetState(setShowLowStockOnly)(!showLowStockOnly)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Low Stock
                </Button>
              </div>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="Total Items"
                  value={stats.total}
                  icon={Package}
                />
                <StatsCard
                  title="Chemicals"
                  value={stats.chemical}
                  icon={TestTube}
                  className="border-blue-200 dark:border-blue-800"
                />
                <StatsCard
                  title="Solutions"
                  value={stats.solution}
                  icon={Beaker}
                  className="border-green-200 dark:border-green-800"
                />
                <StatsCard
                  title="Low Stock Items"
                  value={stats.lowStock}
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
                    <Button onClick={() => openDrawer('chemical')} className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Chemical
                    </Button>
                    <Button onClick={() => openDrawer('solution')} variant="outline" className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Solution
                    </Button>
                    <Button onClick={() => openDrawer('product')} variant="outline" className="flex-1 sm:flex-none">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                    <UploadCSV />
                  </div>
                </CardContent>
              </Card>

              {/* Recent Items or Low Stock Alert */}
              {stats.lowStock > 0 && (
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
                        items={allItems.filter(i => getStockStatus(i) === 'low').slice(0, 8)}
                        emptyMessage="No low stock items"
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
                      {getTabItems(type).length} items
                      {showLowStockOnly && " (low stock only)"}
                    </p>
                  </div>
                  
                  {type !== 'all' && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => openDrawer(type)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add {type}
                      </Button>
                      {type === 'chemical' && <UploadCSV />}
                    </div>
                  )}
                </div>

                <ScrollArea className="h-[calc(100vh-300px)]">
                  <ItemGrid 
                    items={getTabItems(type)}
                    emptyMessage={
                      searchQuery 
                        ? `No ${type === 'all' ? 'items' : type + 's'} found matching "${searchQuery}"`
                        : `No ${type === 'all' ? 'items' : type + 's'} in this category`
                    }
                  />
                </ScrollArea>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QRScannerModal
        open={qrScannerOpen}
        onOpenChange={safeSetState(setQrScannerOpen)}
        onScan={handleQRScan}
        onItemFound={handleItemFound}
      />
    </>
  );
}