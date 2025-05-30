//app/[id]/ItemDetailClient.jsx
'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  TestTube,
  Beaker,
  Package,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  Users,
  History,
  QrCode,
  Edit,
  Plus,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Settings,
  Zap,
  Loader2,
  TrendingUp,
  TrendingDown,
  ExternalLink
} from 'lucide-react';
import QRCodeGenerator from '@/components/ui/QRCodeGenerator';
import TxnTable from './components/TxnTable';
// FIXED: Import from client-api instead of api
import { api } from './lib/client-api';

// Custom hook to get user data from your auth system
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData.user);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return { user, loading };
};

// Icon mapping for different item types
const getItemIcon = (itemType) => {
  switch (itemType) {
    case 'chemical': return TestTube;
    case 'solution': return Beaker;
    case 'product': return Package;
    default: return Package;
  }
};

// Type-specific labels
const getItemTypeConfig = (itemType) => {
  const configs = {
    chemical: {
      label: 'Chemical',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      fields: ['hazardClass', 'storageRequirements']
    },
    solution: {
      label: 'Solution',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      fields: ['concentration', 'ph', 'baseChemical']
    },
    product: {
      label: 'Product',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      fields: ['manufacturer', 'model', 'serialNumber', 'warranty']
    }
  };
  return configs[itemType] || configs.product;
};

const getStockStatus = (item) => {
  const threshold = 10;
  if (item.qtyOnHand <= threshold) return { status: 'low', color: 'destructive' };
  if (item.qtyOnHand <= threshold * 2) return { status: 'medium', color: 'default' };
  return { status: 'good', color: 'secondary' };
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount || 0);
};

export default function ItemDetailClient({ item, transactions, lots }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);
  
  // Enhanced transaction state
  const [transactionData, setTransactionData] = useState({
    transactions: transactions || [],
    stats: null,
    loading: false,
    error: null
  });
  
  const ItemIcon = getItemIcon(item.itemType);
  const typeConfig = getItemTypeConfig(item.itemType);
  const stockInfo = getStockStatus(item);
  const totalValue = (item.cost || 0) * item.qtyOnHand;
  const activeLots = lots.filter(lot => lot.quantity > 0);
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Load enhanced transaction data
  const loadTransactionData = async () => {
    try {
      setTransactionData(prev => ({ ...prev, loading: true }));
      
      const [txnResponse, statsResponse] = await Promise.all([
        api.getItemTransactions(item._id, { limit: 100 }),
        api.getItemTransactionStats(item._id)
      ]);
      
      setTransactionData({
        transactions: txnResponse.transactions || [],
        stats: statsResponse.stats || [],
        loading: false,
        error: null
      });
    } catch (error) {
      setTransactionData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Load transaction data on component mount
  useEffect(() => {
    if (item._id && activeTab === 'transactions') {
      loadTransactionData();
    }
  }, [item._id, activeTab]);
  
  // Handle item deletion
  const handleDeleteItem = async () => {
    if (!isAdmin) {
      alert('Unauthorized: Admin access required');
      return;
    }

    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/items/${item._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          force: forceDelete
        })
      });

      const data = await response.json();

      if (response.ok) {
        const message = forceDelete && item.qtyOnHand > 0 
          ? `Item "${item.displayName}" and all its stock (${item.qtyOnHand} ${item.uom}) has been deleted successfully.`
          : `Item "${item.displayName}" has been deleted successfully.`;
        alert(message);
        router.push('/home');
      } else {
        alert(data.error || 'Failed to delete item');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete item: ' + error.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setForceDelete(false);
    }
  };

  // Type-specific information components
  const renderTypeSpecificInfo = () => {
    switch (item.itemType) {
      case 'chemical':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5 text-blue-500" />
                Chemical Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">CAS Number</label>
                <p>{item.casNumber || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Location</label>
                <p>{item.location || 'Not specified'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lot Tracked</label>
                <Badge variant={item.lotTracked ? "secondary" : "outline"}>
                  {item.lotTracked ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      case 'solution':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-green-500" />
                Solution Properties
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Components (BOM)</label>
                {item.bom && item.bom.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    {item.bom.map((component, index) => (
                      <p key={index} className="text-sm">
                        {component.qty} {component.uom} - ID: {component.itemId}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>No components defined</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lot Tracked</label>
                <Badge variant={item.lotTracked ? "secondary" : "outline"}>
                  {item.lotTracked ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      case 'product':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-500" />
                Product Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Components (BOM)</label>
                {item.bom && item.bom.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    {item.bom.map((component, index) => (
                      <p key={index} className="text-sm">
                        {component.qty} {component.uom} - ID: {component.itemId}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p>No components defined</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Lot Tracked</label>
                <Badge variant={item.lotTracked ? "secondary" : "outline"}>
                  {item.lotTracked ? "Yes" : "No"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  // Enhanced Transaction History Tab Component
  const TransactionHistoryTab = () => {
    if (transactionData.loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span>Loading transaction history...</span>
          </div>
        </div>
      );
    }

    if (transactionData.error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Error loading transactions: {transactionData.error}</p>
          <Button onClick={loadTransactionData}>Retry</Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Transaction Statistics */}
        {transactionData.stats && transactionData.stats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {transactionData.stats.map((stat) => {
              const getIcon = (type) => {
                switch (type) {
                  case 'receipt': return TrendingUp;
                  case 'issue': return TrendingDown;
                  case 'adjustment': return RefreshCw;
                  case 'build': return Package;
                  case 'transfer': return ExternalLink;
                  default: return History;
                }
              };
              
              const Icon = getIcon(stat._id);
              
              return (
                <Card key={stat._id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium capitalize">{stat._id}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Transactions:</span>
                        <span className="font-medium">{stat.transactionCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Qty:</span>
                        <span className={`font-medium ${
                          stat.totalQty > 0 ? 'text-green-600' : 
                          stat.totalQty < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {stat.totalQty > 0 ? '+' : ''}{stat.totalQty} {item.uom}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Value:</span>
                        <span className={`font-medium ${
                          stat.totalValue > 0 ? 'text-green-600' : 
                          stat.totalValue < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {formatCurrency(stat.totalValue)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Enhanced Transaction Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Transaction History
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadTransactionData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <TxnTable
              transactions={transactionData.transactions}
              item={item}
              onRefresh={loadTransactionData}
              showLotColumn={item.lotTracked}
              isAdmin={isAdmin}
              mode="item"
            />
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" className="justify-start">
                <TrendingUp className="h-4 w-4 mr-2" />
                Add Stock
              </Button>
              <Button variant="outline" className="justify-start">
                <TrendingDown className="h-4 w-4 mr-2" />
                Issue Stock
              </Button>
              <Button variant="outline" className="justify-start">
                <RefreshCw className="h-4 w-4 mr-2" />
                Adjust Quantity
              </Button>
              <Button variant="outline" className="justify-start">
                <ExternalLink className="h-4 w-4 mr-2" />
                Transfer
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${typeConfig.color}`}>
              <ItemIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{item.displayName}</h1>
                <Badge variant="outline" className={typeConfig.color}>
                  {typeConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">SKU: {item.sku}</p>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {stockInfo.status === 'low' && (
          <Alert className="mb-6 border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Low Stock Alert:</strong> Current quantity ({item.qtyOnHand} {item.uom}) 
              is running low.
              </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="lots">Lots ({activeLots.length})</TabsTrigger>
              <TabsTrigger value="transactions">History</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowQRGenerator(true)}>
                <QrCode className="h-4 w-4 mr-2" />
                Generate QR
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit {typeConfig.label}
              </Button>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <div className="flex items-center gap-2 mt-1">
                      <ItemIcon className="h-4 w-4" />
                      <span className="capitalize">{item.itemType}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Category</label>
                    <p>{item.description ? 'Has description' : 'No description'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-sm">{item.description || 'No description provided'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Stock Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Stock Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Stock</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xl font-bold">{item.qtyOnHand}</span>
                      <span className="text-muted-foreground">{item.uom}</span>
                      <Badge variant={stockInfo.color} className="ml-2">
                        {stockInfo.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Minimum Quantity</label>
                    <p>Not configured</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Active Lots</label>
                    <p>{activeLots.length}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Total Value</label>
                    <p className="text-lg font-semibold text-green-600">
                      {formatCurrency(totalValue)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Location & Vendor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location & Vendor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p>{item.location || 'Not specified'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Unit Cost</label>
                    <p>{formatCurrency(item.cost)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Lot Tracked</label>
                    <Badge variant={item.lotTracked ? "secondary" : "outline"}>
                      {item.lotTracked ? "Yes" : "No"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Type-specific Information */}
              {renderTypeSpecificInfo()}

              {/* Notes */}
              {item.notes && (
                <Card className="md:col-span-2 lg:col-span-3">
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{item.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Lots Tab */}
          <TabsContent value="lots" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Lot Management</h3>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add New Lot
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Number</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Expiration</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lots.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No lots found for this {item.itemType}
                        </TableCell>
                      </TableRow>
                    ) : (
                      lots.map((lot) => (
                        <TableRow key={lot._id}>
                          <TableCell className="font-medium">
                            <Link href={`/${lot._id}`} className="text-primary hover:underline">
                              {lot.lotNumber}
                            </Link>
                          </TableCell>
                          <TableCell>{lot.quantity} {item.uom}</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>N/A</TableCell>
                          <TableCell>{item.location || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">Active</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/${lot._id}`}>
                                  <Eye className="h-3 w-3" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setShowQRGenerator(true)}>
                                <QrCode className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Edit className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Enhanced Transaction History Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <TransactionHistoryTab />
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Inventory Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Stock
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Adjust Quantity
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="h-4 w-4 mr-2" />
                    Transfer Location
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reports & Export</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export Details
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    Full History Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <QrCode className="h-4 w-4 mr-2" />
                    Print Labels
                  </Button>
                </CardContent>
              </Card>

              {/* Admin Actions - Only visible to admin users */}
              {isAdmin && (
                <Card className="border-red-200 dark:border-red-800">
                  <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400">
                      Admin Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="destructive" 
                      className="w-full justify-start"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {typeConfig.label}
                    </Button>
                    {item.qtyOnHand > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Item has active stock ({item.qtyOnHand} {item.uom}). 
                        Force delete will remove all stock and lots.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* QR Code Generator Modal */}
        {showQRGenerator && (
          <QRCodeGenerator
            data={{
              type: item.itemType,
              id: item._id,
              sku: item.sku,
              name: item.displayName
            }}
            onClose={() => setShowQRGenerator(false)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete {typeConfig.label}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p>
                    Are you sure you want to delete <strong>"{item.displayName}"</strong> (SKU: {item.sku})?
                  </p>
                  
                  {item.qtyOnHand > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="font-medium">Warning: Active Stock Detected</span>
                        </div>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          This item has <strong>{item.qtyOnHand} {item.uom}</strong> in stock across {activeLots.length} lot(s).
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={forceDelete}
                          onChange={(e) => setForceDelete(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">
                          Force delete including all stock and lots
                        </span>
                      </label>
                    </div>
                  )}
                  
                  <p className="mt-4 text-sm text-muted-foreground">
                    This action cannot be undone. The item and all its associated data will be permanently removed.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteItem}
                disabled={isDeleting || (item.qtyOnHand > 0 && !forceDelete)}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {forceDelete && item.qtyOnHand > 0 ? 'Force Delete' : 'Delete'}
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}