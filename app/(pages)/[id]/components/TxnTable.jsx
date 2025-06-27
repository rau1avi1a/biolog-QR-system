// components/TxnTable.jsx - Mobile/Tablet Responsive Transaction Table
'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/shadcn/components/table';
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import { Input } from '@/components/ui/shadcn/components/input';
import { Label } from '@/components/ui/shadcn/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/components/select';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/components/tooltip';
import {
  ArrowUpDown,
  Filter,
  Eye,
  RotateCcw,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  User,
  Calendar,
  DollarSign,
  Package,
  Info,
  Clock,
  MapPin
} from 'lucide-react';
// FIXED: Import from client-api instead of api
import { api } from '../lib/client-api';

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
  if (!amount) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

// Enhanced transaction type configurations
const getTxnTypeConfig = (txnType) => {
  const configs = {
    receipt: {
      label: 'Receipt',
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      icon: TrendingUp,
      description: 'Inventory received'
    },
    issue: {
      label: 'Issue',
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      icon: TrendingDown,
      description: 'Inventory consumed/issued'
    },
    adjustment: {
      label: 'Adjustment',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      icon: Minus,
      description: 'Quantity adjusted'
    },
    build: {
      label: 'Build',
      color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      icon: Package,
      description: 'Product/solution built'
    },
    transfer: {
      label: 'Transfer',
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
      icon: ExternalLink,
      description: 'Location transfer'
    },
    waste: {
      label: 'Waste',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100',
      icon: AlertTriangle,
      description: 'Waste disposal'
    },
    sample: {
      label: 'Sample',
      color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
      icon: Eye,
      description: 'Sample taken'
    }
  };
  return configs[txnType] || configs.adjustment;
};

// Enhanced status configurations
const getStatusConfig = (status) => {
  const configs = {
    posted: {
      label: 'Posted',
      color: 'bg-green-100 text-green-800',
      description: 'Transaction completed'
    },
    draft: {
      label: 'Draft',
      color: 'bg-yellow-100 text-yellow-800',
      description: 'Transaction in draft'
    },
    reversed: {
      label: 'Reversed',
      color: 'bg-red-100 text-red-800',
      description: 'Transaction reversed'
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-gray-100 text-gray-800',
      description: 'Transaction cancelled'
    }
  };
  return configs[status] || configs.posted;
};

export default function TxnTable({ 
  transactions = [], 
  item,
  onRefresh,
  showLotColumn = true,
  isAdmin = false,
  mode = 'item' // 'item' or 'lot'
}) {
  const [sortField, setSortField] = useState('postedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLot, setFilterLot] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Enhanced transaction processing with better error handling
  const processedTransactions = useMemo(() => {
    const rows = [];
    
    transactions.forEach(txn => {
      try {
        // Handle both relevantLines (for lot-specific queries) and lines (for item queries)
        const lines = txn.relevantLines || txn.lines || [];
        
        // Filter lines for this specific item if in item mode
        const filteredLines = mode === 'item' 
          ? lines.filter(line => {
              const lineItemId = line.item?._id ? line.item._id.toString() : line.item?.toString();
              return lineItemId === item._id;
            })
          : lines;

        filteredLines.forEach((line, index) => {
          // Robust data extraction with fallbacks
          const qtyChange = Number(line.qty) || 0;
          const unitCost = Number(line.unitCost) || 0;
          const totalValue = Number(line.totalValue) || (qtyChange * unitCost);
          
          // Calculate running balances based on mode
          let runningBalance, balanceChange;
          if (mode === 'lot') {
            runningBalance = Number(line.lotQtyAfter) || 0;
            balanceChange = (Number(line.lotQtyAfter) || 0) - (Number(line.lotQtyBefore) || 0);
          } else {
            runningBalance = Number(line.itemQtyAfter) || 0;
            balanceChange = (Number(line.itemQtyAfter) || 0) - (Number(line.itemQtyBefore) || 0);
          }

          // Enhanced row data
          rows.push({
            // Transaction metadata
            _id: `${txn._id}-${index}`,
            txnId: txn._id,
            txnType: txn.txnType,
            status: txn.status || 'posted',
            postedAt: txn.postedAt,
            effectiveDate: txn.effectiveDate,
            
            // Line-specific data
            line,
            qtyChange,
            balanceChange,
            runningBalance,
            unitCost,
            totalValue,
            lotNumber: line.lot || '',
            
            // Before/after quantities for detailed view
            lotQtyBefore: Number(line.lotQtyBefore) || 0,
            lotQtyAfter: Number(line.lotQtyAfter) || 0,
            itemQtyBefore: Number(line.itemQtyBefore) || 0,
            itemQtyAfter: Number(line.itemQtyAfter) || 0,
            
            // Metadata
            memo: txn.memo || '',
            reason: txn.reason || '',
            notes: line.notes || '',
            project: txn.project || '',
            department: txn.department || '',
            
            // References
            batchId: txn.batchId,
            workOrderId: txn.workOrderId,
            refDoc: txn.refDoc,
            refDocType: txn.refDocType,
            
            // Batch snapshot data (if populated by backend)
            batchSnapshot: txn.batchSnapshot || null,
            
            // User info
            createdBy: txn.createdBy || {},
            validatedBy: txn.validatedBy,
            
            // Additional line data
            expiryDate: line.expiryDate,
            vendorLotNumber: line.vendorLotNumber,
            location: line.location,
            
            // Validation
            validated: txn.validated || false,
            reversedBy: txn.reversedBy
          });
        });
      } catch (error) {
        console.error('Error processing transaction:', txn._id, error);
        // Continue processing other transactions
      }
    });
    
    return rows;
  }, [transactions, mode, item._id]);

  // Enhanced filtering and sorting
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...processedTransactions];

    // Filter by transaction type
    if (filterType !== 'all') {
      filtered = filtered.filter(txn => txn.txnType === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(txn => txn.status === filterStatus);
    }

    // Filter by lot
    if (filterLot && showLotColumn) {
      filtered = filtered.filter(txn => 
        txn.lotNumber && txn.lotNumber.toLowerCase().includes(filterLot.toLowerCase())
      );
    }

    // Filter by date range
    if (dateRange.start) {
      filtered = filtered.filter(txn => 
        new Date(txn.postedAt) >= new Date(dateRange.start)
      );
    }
    if (dateRange.end) {
      filtered = filtered.filter(txn => 
        new Date(txn.postedAt) <= new Date(dateRange.end)
      );
    }

    // Enhanced sorting
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'postedAt' || sortField === 'effectiveDate') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [processedTransactions, filterType, filterStatus, filterLot, dateRange, sortField, sortDirection, showLotColumn]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleViewDetails = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsDialog(true);
  };

  const handleReverse = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReverseDialog(true);
    setReverseReason('');
  };

  const handleViewBatchFile = async (batchId) => {
    try {
      // Ensure batchId is a string (handle both ObjectId strings and populated objects)
      const id = typeof batchId === 'object' ? batchId._id : batchId;
      // Navigate to the files page for this batch
      window.open(`/files/${id}`, '_blank');
    } catch (error) {
      console.error('Error opening batch file:', error);
      alert('Failed to open batch file');
    }
  };

  const confirmReverse = async () => {
    if (!selectedTransaction || !reverseReason.trim()) return;
    
    try {
      await api.reverseTransaction(selectedTransaction.txnId, reverseReason.trim());
      setShowReverseDialog(false);
      setReverseReason('');
      onRefresh();
    } catch (error) {
      console.error('Error reversing transaction:', error);
      alert('Failed to reverse transaction');
    }
  };

  // Get unique values for filters
  const availableTypes = useMemo(() => {
    const types = new Set(processedTransactions.map(txn => txn.txnType));
    return Array.from(types);
  }, [processedTransactions]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set(processedTransactions.map(txn => txn.status));
    return Array.from(statuses);
  }, [processedTransactions]);

  const availableLots = useMemo(() => {
    const lots = new Set(
      processedTransactions
        .map(txn => txn.lotNumber)
        .filter(Boolean)
    );
    return Array.from(lots);
  }, [processedTransactions]);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Enhanced Filters */}
        <div className="space-y-4 px-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Transaction History</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <Clock className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div>
                <Label>Transaction Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {availableTypes.map(type => {
                      const config = getTxnTypeConfig(type);
                      return (
                        <SelectItem key={type} value={type}>
                          {config.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {availableStatuses.map(status => {
                      const config = getStatusConfig(status);
                      return (
                        <SelectItem key={status} value={status}>
                          {config.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {showLotColumn && availableLots.length > 0 && (
                <div>
                  <Label>Lot Number</Label>
                  <Input
                    placeholder="Filter by lot..."
                    value={filterLot}
                    onChange={(e) => setFilterLot(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="space-y-1">
                  <Input
                    type="date"
                    placeholder="Start date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  />
                  <Input
                    type="date"
                    placeholder="End date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterType('all');
                    setFilterStatus('all');
                    setFilterLot('');
                    setDateRange({ start: '', end: '' });
                  }}
                  className="w-full"
                >
                  Clear All
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Table with Mobile/Tablet Responsive Design */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]"> {/* Minimum width for tablet */}
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[140px] px-3 sm:px-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('postedAt')}
                          className="h-auto p-0 font-medium text-xs sm:text-sm"
                        >
                          Date
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="w-[90px] px-3 sm:px-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('txnType')}
                          className="h-auto p-0 font-medium text-xs sm:text-sm"
                        >
                          Type
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right w-[100px] px-3 sm:px-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSort('qtyChange')}
                          className="h-auto p-0 font-medium text-xs sm:text-sm"
                        >
                          Qty
                          <ArrowUpDown className="ml-1 h-3 w-3" />
                        </Button>
                      </TableHead>
                      <TableHead className="text-right w-[110px] px-3 sm:px-6 text-xs sm:text-sm">
                        Balance
                      </TableHead>
                      {showLotColumn && mode === 'item' && (
                        <TableHead className="w-[100px] px-3 sm:px-6 text-xs sm:text-sm">Lot</TableHead>
                      )}
                      <TableHead className="text-right w-[90px] px-3 sm:px-6 text-xs sm:text-sm">Cost</TableHead>
                      <TableHead className="text-right w-[90px] px-3 sm:px-6 text-xs sm:text-sm">Value</TableHead>
                      <TableHead className="w-[100px] px-3 sm:px-6 text-xs sm:text-sm">User</TableHead>
                      <TableHead className="w-[120px] px-3 sm:px-6 text-xs sm:text-sm">Batch</TableHead>
                      <TableHead className="w-[80px] px-3 sm:px-6 text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={showLotColumn && mode === 'item' ? 10 : 9} 
                          className="text-center py-8 text-muted-foreground"
                        >
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAndSortedTransactions.map((txn) => {
                        const typeConfig = getTxnTypeConfig(txn.txnType);
                        const TypeIcon = typeConfig.icon;
                        
                        return (
                          <TableRow key={txn._id} className={txn.status === 'reversed' ? 'opacity-60' : ''}>
                            <TableCell className="font-mono text-xs sm:text-sm px-3 sm:px-6">
                              <div className="truncate">
                                {formatDate(txn.postedAt)}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 sm:px-6">
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge variant="outline" className={`${typeConfig.color} text-xs`}>
                                    <TypeIcon className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">{typeConfig.label}</span>
                                    <span className="sm:hidden">{typeConfig.label.slice(0, 3)}</span>
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{typeConfig.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            <TableCell className={`text-right font-medium px-3 sm:px-6 text-xs sm:text-sm ${
                              txn.qtyChange > 0 ? 'text-green-600' : 
                              txn.qtyChange < 0 ? 'text-red-600' : 'text-gray-600'
                            }`}>
                              {txn.qtyChange > 0 ? '+' : ''}{txn.qtyChange}
                              <span className="hidden sm:inline"> {item.uom}</span>
                            </TableCell>
                            <TableCell className="text-right px-3 sm:px-6 text-xs sm:text-sm">
                              <div className="font-medium">
                                {txn.runningBalance}
                                <span className="hidden sm:inline"> {item.uom}</span>
                              </div>
                            </TableCell>
                            {showLotColumn && mode === 'item' && (
                              <TableCell className="font-mono text-xs px-3 sm:px-6">
                                <div className="truncate">
                                  {txn.lotNumber || '-'}
                                </div>
                              </TableCell>
                            )}
                            <TableCell className="text-right px-3 sm:px-6 text-xs sm:text-sm">
                              {txn.unitCost ? (
                                <>
                                  <span className="hidden sm:inline">{formatCurrency(txn.unitCost)}</span>
                                  <span className="sm:hidden">${txn.unitCost?.toFixed(0) || '-'}</span>
                                </>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-medium px-3 sm:px-6 text-xs sm:text-sm">
                              {txn.totalValue ? (
                                <>
                                  <span className="hidden sm:inline">{formatCurrency(txn.totalValue)}</span>
                                  <span className="sm:hidden">${txn.totalValue?.toFixed(0) || '-'}</span>
                                </>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="px-3 sm:px-6">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3 flex-shrink-0" />
                                <span className="text-xs truncate max-w-[80px]">
                                  {txn.createdBy?.name || txn.createdBy?.email || 'System'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-3 sm:px-6">
                              {txn.batchId ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewBatchFile(txn.batchId)}
                                  className="p-1 h-auto text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-xs"
                                >
                                  <FileText className="h-3 w-3 mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                  <span className="sm:hidden">File</span>
                                </Button>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  {txn.workOrderId ? 'WO' : 'Manual'}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="px-3 sm:px-6">
                              <div className="flex gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewDetails(txn)}
                                      className="h-7 w-7 p-0"
                                    >
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>View details</p>
                                  </TooltipContent>
                                </Tooltip>
                                {isAdmin && txn.status === 'posted' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleReverse(txn)}
                                        className="text-red-600 hover:text-red-700 h-7 w-7 p-0"
                                      >
                                        <RotateCcw className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Reverse transaction</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* Enhanced Transaction Details Dialog */}
        <AlertDialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
          <AlertDialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Transaction Details
              </AlertDialogTitle>
            </AlertDialogHeader>
            {selectedTransaction && (
              <div className="space-y-6">
                {/* Transaction Overview */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                    <p className="font-mono text-sm">{selectedTransaction.txnId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <div className="flex items-center gap-2">
                      <Badge className={getTxnTypeConfig(selectedTransaction.txnType).color}>
                        {getTxnTypeConfig(selectedTransaction.txnType).label}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Badge className={getStatusConfig(selectedTransaction.status).color}>
                      {getStatusConfig(selectedTransaction.status).label}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Transaction Date</Label>
                    <p>{formatDate(selectedTransaction.postedAt)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">User</Label>
                    <p>{selectedTransaction.createdBy?.name || selectedTransaction.createdBy?.email || 'System'}</p>
                  </div>
                </div>
                
                {/* Quantity Impact */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Quantity Impact</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Quantity Change</Label>
                      <p className={`text-lg font-bold ${
                        selectedTransaction.qtyChange > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedTransaction.qtyChange > 0 ? '+' : ''}{selectedTransaction.qtyChange} {item.uom}
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-medium">
                        {selectedTransaction.itemQtyAfter} {item.uom}
                      </p>
                    </div>
                    {selectedTransaction.lotNumber && (
                      <>
                        <div>
                          <Label className="text-xs text-muted-foreground">Lot Before</Label>
                          <p>{selectedTransaction.lotQtyBefore} {item.uom}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Lot After</Label>
                          <p>{selectedTransaction.lotQtyAfter} {item.uom}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Financial Information */}
                {(selectedTransaction.unitCost || selectedTransaction.totalValue) && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Financial Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                        <p className="text-lg">{formatCurrency(selectedTransaction.unitCost)}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Total Value</Label>
                        <p className="text-lg font-medium">{formatCurrency(selectedTransaction.totalValue)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Batch Information */}
                {selectedTransaction.batchSnapshot && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Batch Information</h4>
                    <div className="space-y-3">
                      {selectedTransaction.batchSnapshot.solutionRef && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Solution</Label>
                          <p className="text-sm font-medium">
                            {selectedTransaction.batchSnapshot.solutionRef.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {selectedTransaction.batchSnapshot.solutionRef.sku}
                          </p>
                        </div>
                      )}
                      {selectedTransaction.batchSnapshot.productRef && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Product</Label>
                          <p className="text-sm font-medium">
                            {selectedTransaction.batchSnapshot.productRef.displayName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {selectedTransaction.batchSnapshot.productRef.sku}
                          </p>
                        </div>
                      )}
                      {selectedTransaction.batchId && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBatchFile(selectedTransaction.batchId)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Batch File
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                {(selectedTransaction.memo || selectedTransaction.notes || selectedTransaction.reason) && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Additional Information</h4>
                    <div className="space-y-3">
                      {selectedTransaction.memo && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Memo</Label>
                          <p className="text-sm">{selectedTransaction.memo}</p>
                        </div>
                      )}
                      {selectedTransaction.notes && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Line Notes</Label>
                          <p className="text-sm">{selectedTransaction.notes}</p>
                        </div>
                      )}
                      {selectedTransaction.reason && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Reason</Label>
                          <p className="text-sm">{selectedTransaction.reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setShowDetailsDialog(false)}>
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reverse Transaction Dialog */}
        <AlertDialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <RotateCcw className="h-5 w-5" />
                Reverse Transaction
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will create a reversal transaction that undoes the inventory changes.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reverseReason">Reason for Reversal *</Label>
                <Input
                  id="reverseReason"
                  value={reverseReason}
                  onChange={(e) => setReverseReason(e.target.value)}
                  placeholder="Enter reason for reversing this transaction..."
                />
              </div>
              {selectedTransaction && (
                <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm font-medium">Transaction to reverse:</p>
                  <p className="text-sm">
                    {getTxnTypeConfig(selectedTransaction.txnType).label} - 
                    {selectedTransaction.qtyChange > 0 ? '+' : ''}{selectedTransaction.qtyChange} {item.uom}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(selectedTransaction.postedAt)}
                  </p>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowReverseDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmReverse}
                disabled={!reverseReason.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                Reverse Transaction
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}