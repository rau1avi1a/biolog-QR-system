//app/[id]/LotDetailClient.jsx
'use client';

import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn/components/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn/components/tabs';
import { ScrollArea } from '@/components/ui/shadcn/components/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/shadcn/components/alert-dialog';
import {
  ArrowLeft,
  Package2,
  QrCode,
  Edit,
  History,
  Download,
  Printer,
  RefreshCw,
  MapPin,
  Calendar,
  User,
  Trash2,
  AlertTriangle,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock
} from 'lucide-react';
import QRCodeGenerator from '@/app/(pages)/home/QRCodeGenerator';
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
        // Fixed URL: add ?action=me parameter
        const response = await fetch('/api/auth?action=me');
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

export default function LotDetailClient({ lot, item, transactions }) {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Enhanced transaction state
  const [lotTransactionData, setLotTransactionData] = useState({
    transactions: transactions || [],
    loading: false,
    error: null
  });

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Load lot-specific transaction data
  const loadLotTransactions = async () => {
    try {
      setLotTransactionData(prev => ({ ...prev, loading: true }));
      
      const response = await api.getLotTransactions(item._id, lot.lotNumber);
      
      setLotTransactionData({
        transactions: response.transactions || [],
        loading: false,
        error: null
      });
    } catch (error) {
      setLotTransactionData(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Load transaction data when transactions tab is opened
  useEffect(() => {
    if (item._id && lot.lotNumber && activeTab === 'transactions') {
      loadLotTransactions();
    }
  }, [item._id, lot.lotNumber, activeTab]);

  // Calculate lot statistics
  const lotStats = useMemo(() => {
    if (!lotTransactionData.transactions.length) return null;

    const stats = {
      totalTransactions: 0,
      totalReceived: 0,
      totalIssued: 0,
      totalAdjustments: 0,
      totalValue: 0,
      firstTransaction: null,
      lastTransaction: null
    };

    lotTransactionData.transactions.forEach(txn => {
      const lines = txn.relevantLines || txn.lines || [];
      lines.forEach(line => {
        stats.totalTransactions++;
        stats.totalValue += line.totalValue || 0;

        if (line.qty > 0) {
          stats.totalReceived += line.qty;
        } else {
          stats.totalIssued += Math.abs(line.qty);
        }

        if (txn.txnType === 'adjustment') {
          stats.totalAdjustments += Math.abs(line.qty);
        }
      });

      if (!stats.firstTransaction || new Date(txn.postedAt) < new Date(stats.firstTransaction.postedAt)) {
        stats.firstTransaction = txn;
      }
      if (!stats.lastTransaction || new Date(txn.postedAt) > new Date(stats.lastTransaction.postedAt)) {
        stats.lastTransaction = txn;
      }
    });

    return stats;
  }, [lotTransactionData.transactions]);

  // Handle lot deletion
  const handleDeleteLot = async () => {
    if (!isAdmin) {
      alert('Unauthorized: Admin access required');
      return;
    }
  
    setIsDeleting(true);
    
    try {
      // Use the API function instead of direct fetch
      const data = await api.deleteLot(item._id, lot._id);
  
      if (data.success) {
        alert(`Lot "${lot.lotNumber}" has been deleted successfully.`);
        router.push(`/${item._id}`); // Redirect to item page
      } else {
        alert(data.error || 'Failed to delete lot');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete lot: ' + error.message);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  
  // Enhanced Lot Transaction History Component
  const LotTransactionHistory = () => {
    if (lotTransactionData.loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span>Loading lot history...</span>
          </div>
        </div>
      );
    }

    if (lotTransactionData.error) {
      return (
        <div className="text-center py-8">
          <p className="text-red-500 mb-4">Error loading lot history: {lotTransactionData.error}</p>
          <Button onClick={loadLotTransactions}>Retry</Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Lot Statistics */}
        {lotStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Transactions</span>
                </div>
                <p className="text-2xl font-bold">{lotStats.totalTransactions}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Total Received</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  +{lotStats.totalReceived} {item.uom}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm font-medium">Total Issued</span>
                </div>
                <p className="text-2xl font-bold text-red-600">
                  -{lotStats.totalIssued} {item.uom}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Total Value</span>
                </div>
                <p className="text-2xl font-bold text-amber-600">
                  {formatCurrency(lotStats.totalValue)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Activity Timeline */}
        {lotStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Lot Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">First Activity:</span>
                  <p className="font-medium">
                    {lotStats.firstTransaction ? 
                      formatDate(lotStats.firstTransaction.postedAt) : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Activity:</span>
                  <p className="font-medium">
                    {lotStats.lastTransaction ? 
                      formatDate(lotStats.lastTransaction.postedAt) : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Status:</span>
                  <Badge variant={lot.quantity > 0 ? "secondary" : "outline"}>
                    {lot.quantity > 0 ? "Active" : "Empty"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Balance:</span>
                  <p className="font-medium text-lg">
                    {lot.quantity} {item.uom}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Transaction Table for Lot */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Detailed Transaction History
              </CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadLotTransactions}>
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
              transactions={lotTransactionData.transactions}
              item={item}
              onRefresh={loadLotTransactions}
              showLotColumn={false} // Don't show lot column for lot-specific view
              isAdmin={isAdmin}
              mode="lot"
            />
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Lot {lot.lotNumber}</h1>
              <p className="text-muted-foreground">
                <Link href={`/${item._id}`} className="hover:underline">
                  {item.displayName}
                </Link>
                {' • '}SKU: {item.sku}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transactions">
                History
              </TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQRGenerator(true)}
              >
                <QrCode className="h-4 w-4 mr-2" />
                Print QR Label
              </Button>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit Lot
              </Button>
            </div>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Lot Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package2 className="h-5 w-5" />
                    Lot Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Lot Number</label>
                    <p className="text-lg font-semibold">{lot.lotNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Quantity</label>
                    <p className="text-xl font-bold text-primary">{lot.quantity} {item.uom}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge variant={lot.quantity > 0 ? "secondary" : "outline"}>
                        {lot.quantity > 0 ? "Active" : "Empty"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Item Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Item Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Item</label>
                    <Link href={`/${item._id}`} className="block hover:underline">
                      <p className="font-medium text-primary">{item.displayName}</p>
                    </Link>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SKU</label>
                    <p className="font-mono text-sm">{item.sku}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="capitalize">{item.itemType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p>{item.location || 'Not specified'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5" />
                    QR Code
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <div className="w-32 h-32 bg-muted rounded-lg mx-auto flex items-center justify-center mb-3">
                      <QrCode className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      QR code links to this lot page
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => setShowQRGenerator(true)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Label
                  </Button>
                </CardContent>
              </Card>

              {/* Description */}
              {item.description && (
                <Card className="md:col-span-2 lg:col-span-3">
                  <CardHeader>
                    <CardTitle>Item Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{item.description}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Enhanced Transaction History Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <LotTransactionHistory />
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Lot Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Adjust Quantity
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Lot Details
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <MapPin className="h-4 w-4 mr-2" />
                    Change Location
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reports & Labels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Export Lot Report
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <History className="h-4 w-4 mr-2" />
                    Full Transaction History
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setShowQRGenerator(true)}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Print QR Label
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Navigation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href={`/${item._id}`}>
                      <Package2 className="h-4 w-4 mr-2" />
                      View Item Details
                    </Link>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" asChild>
                    <Link href="/home">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Inventory
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Admin Actions - Only visible to admin users */}
              {isAdmin && (
                <Card className="border-red-200 dark:border-red-800 md:col-span-2 lg:col-span-3">
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
                      Delete Lot
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Deleting this lot will remove {lot.quantity} {item.uom} from inventory and update the item's total stock.
                    </p>
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
              type: 'lot',
              id: lot._id,
              lotNumber: lot.lotNumber,
              itemName: item.displayName,
              sku: item.sku,
              url: lot.qrCodeUrl
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
                Delete Lot
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>Lot "{lot.lotNumber}"</strong>?
                <br /><br />
                <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md my-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Impact</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    This will remove <strong>{lot.quantity} {item.uom}</strong> from the item's total stock and permanently delete this lot's transaction history.
                  </p>
                </div>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteLot}
                disabled={isDeleting}
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
                    Delete Lot
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