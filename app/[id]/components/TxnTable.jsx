// components/TxnTable.jsx
'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DollarSign
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

// Transaction type configurations
const getTxnTypeConfig = (txnType) => {
  const configs = {
    receipt: {
      label: 'Receipt',
      color: 'bg-green-100 text-green-800',
      icon: TrendingUp
    },
    issue: {
      label: 'Issue',
      color: 'bg-red-100 text-red-800',
      icon: TrendingDown
    },
    adjustment: {
      label: 'Adjustment',
      color: 'bg-blue-100 text-blue-800',
      icon: Minus
    },
    build: {
      label: 'Build',
      color: 'bg-purple-100 text-purple-800',
      icon: FileText
    },
    transfer: {
      label: 'Transfer',
      color: 'bg-orange-100 text-orange-800',
      icon: ExternalLink
    },
    waste: {
      label: 'Waste',
      color: 'bg-gray-100 text-gray-800',
      icon: AlertTriangle
    },
    sample: {
      label: 'Sample',
      color: 'bg-cyan-100 text-cyan-800',
      icon: Eye
    }
  };
  return configs[txnType] || configs.adjustment;
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
  const [filterLot, setFilterLot] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [reverseReason, setReverseReason] = useState('');

  // Process transactions into flat rows
  const processedTransactions = useMemo(() => {
    const rows = [];
    transactions.forEach(txn => {
      // grab whichever lines are relevant
      const lines = txn.relevantLines || txn.lines || [];
  
      lines.forEach(line => {
        rows.push({
          ...txn,
          line,
          qtyChange:     line.qty,
          // switch running balance depending on item vs lot mode
          runningBalance:
            mode === 'lot'
              ? line.lotQtyAfter
              : line.itemQtyAfter,
          // only set these when in lot mode
          lotQtyBefore: mode === 'lot' ? line.lotQtyBefore : undefined,
          lotQtyAfter:  mode === 'lot' ? line.lotQtyAfter  : undefined,
          // only set these when in item mode
          itemQtyBefore: mode === 'item' ? line.itemQtyBefore : undefined,
          itemQtyAfter:  mode === 'item' ? line.itemQtyAfter  : undefined,
          unitCost:      line.unitCost,
          lineValue:     line.totalValue,
          lotNumber:     line.lot,
          notes:         line.notes
        });
      });
    });
    return rows;
  }, [transactions, mode]);
  // Apply filters and sorting
  const filteredAndSortedTransactions = useMemo(() => {
    let filtered = [...processedTransactions];

    // Filter by transaction type
    if (filterType !== 'all') {
      filtered = filtered.filter(txn => txn.txnType === filterType);
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

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'postedAt' || sortField === 'effectiveDate') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  }, [processedTransactions, filterType, filterLot, dateRange, sortField, sortDirection, showLotColumn]);

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

  const confirmReverse = async () => {
    if (!selectedTransaction || !reverseReason.trim()) return;
    
    try {
      await api.reverseTransaction(selectedTransaction._id, reverseReason);
      setShowReverseDialog(false);
      setReverseReason('');
      onRefresh?.();
    } catch (error) {
      alert('Failed to reverse transaction: ' + error.message);
    }
  };

  // Get unique transaction types for filter
  const availableTypes = useMemo(() => {
    const types = new Set(processedTransactions.map(txn => txn.txnType));
    return Array.from(types);
  }, [processedTransactions]);

  // Get unique lot numbers for filter
  const availableLots = useMemo(() => {
    const lots = new Set(
      processedTransactions
        .map(txn => txn.lotNumber)
        .filter(Boolean)
    );
    return Array.from(lots);
  }, [processedTransactions]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
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

        {showLotColumn && availableLots.length > 0 && (
          <div className="flex-1 min-w-[150px]">
            <Label>Lot Number</Label>
            <Input
              placeholder="Filter by lot..."
              value={filterLot}
              onChange={(e) => setFilterLot(e.target.value)}
            />
          </div>
        )}

        <div className="flex gap-2">
          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => {
            setFilterType('all');
            setFilterLot('');
            setDateRange({ start: '', end: '' });
          }}
        >
          Clear Filters
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('postedAt')}
                    className="h-auto p-0 font-medium"
                  >
                    Date
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('txnType')}
                    className="h-auto p-0 font-medium"
                  >
                    Type
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSort('qtyChange')}
                    className="h-auto p-0 font-medium"
                  >
                    Qty Change
                    <ArrowUpDown className="ml-1 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  {mode === 'lot' ? 'Lot Balance' : 'Running Balance'}
                </TableHead>
                {showLotColumn && mode === 'item' && <TableHead>Lot</TableHead>}
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Line Value</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedTransactions.length === 0 ? (
                <TableRow>
                  <TableCell 
                    colSpan={showLotColumn && mode === 'item' ? 11 : 10} 
                    className="text-center py-8 text-muted-foreground"
                  >
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedTransactions.map((txn, index) => {
                  const config = getTxnTypeConfig(txn.txnType);
                  const Icon = config.icon;
                  
                  return (
                    <TableRow key={`${txn._id}-${index}`}>
                      <TableCell className="font-mono text-sm">
                        {formatDate(txn.postedAt)}
                        {txn.effectiveDate && txn.effectiveDate !== txn.postedAt && (
                          <div className="text-xs text-muted-foreground">
                            Effective: {formatDate(txn.effectiveDate)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={config.color}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        {txn.status === 'reversed' && (
                          <Badge variant="destructive" className="ml-1 text-xs">
                            Reversed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${
                        txn.qtyChange > 0 ? 'text-green-600' : 
                        txn.qtyChange < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {txn.qtyChange > 0 ? '+' : ''}{txn.qtyChange} {item.uom}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {mode === 'lot' ? (
                          <div>
                            {txn.lotQtyBefore} → {txn.lotQtyAfter} {item.uom}
                            <div className="text-xs text-muted-foreground">
                              Change: {txn.lotQtyAfter - txn.lotQtyBefore}
                            </div>
                          </div>
                        ) : (
                          <span>{txn.runningBalance} {item.uom}</span>
                        )}
                      </TableCell>
                      {showLotColumn && mode === 'item' && (
                        <TableCell className="font-mono text-sm">
                          {txn.lotNumber || 'N/A'}
                          {txn.lotNumber && txn.lotQtyBefore !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {txn.lotQtyBefore} → {txn.lotQtyAfter}
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {txn.unitCost ? formatCurrency(txn.unitCost) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {txn.lineValue ? formatCurrency(txn.lineValue) : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="text-sm">
                            {txn.createdBy?.name || txn.createdBy?.email || 'System'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {txn.batchId && (
                            <div className="flex items-center gap-1 text-xs">
                              <FileText className="h-3 w-3" />
                              <span>Batch</span>
                            </div>
                          )}
                          {txn.workOrderId && (
                            <div className="flex items-center gap-1 text-xs">
                              <ExternalLink className="h-3 w-3" />
                              <span>WO: {txn.workOrderId}</span>
                            </div>
                          )}
                          {txn.project && (
                            <div className="text-xs text-muted-foreground">
                              {txn.project}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="space-y-1">
                          {txn.memo && (
                            <p className="text-xs truncate" title={txn.memo}>
                              {txn.memo}
                            </p>
                          )}
                          {txn.notes && (
                            <p className="text-xs text-muted-foreground truncate" title={txn.notes}>
                              Line: {txn.notes}
                            </p>
                          )}
                          {txn.reason && (
                            <p className="text-xs text-amber-600 truncate" title={txn.reason}>
                              Reason: {txn.reason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(txn)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          {isAdmin && txn.status === 'posted' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReverse(txn)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
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

      {/* Transaction Details Dialog */}
      <AlertDialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Transaction Details
            </AlertDialogTitle>
          </AlertDialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                  <p className="font-mono text-sm">{selectedTransaction._id}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <p>{getTxnTypeConfig(selectedTransaction.txnType).label}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Posted Date</Label>
                  <p>{formatDate(selectedTransaction.postedAt)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Effective Date</Label>
                  <p>{formatDate(selectedTransaction.effectiveDate)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant={selectedTransaction.status === 'posted' ? 'secondary' : 'destructive'}>
                    {selectedTransaction.status}
                  </Badge>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <p>{selectedTransaction.createdBy?.name || selectedTransaction.createdBy?.email || 'System'}</p>
                </div>
              </div>
              
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
              
              <div className="border-t pt-4">
                <Label className="text-xs text-muted-foreground">Quantity Impact</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <span className="text-sm font-medium">Item Total:</span>
                    <span className="ml-2">
                      {selectedTransaction.line?.itemQtyBefore || 0} → {selectedTransaction.line?.itemQtyAfter || 0} {item.uom}
                    </span>
                  </div>
                  {selectedTransaction.lotNumber && (
                    <div>
                      <span className="text-sm font-medium">Lot {selectedTransaction.lotNumber}:</span>
                      <span className="ml-2">
                        {selectedTransaction.lotQtyBefore || 0} → {selectedTransaction.lotQtyAfter || 0} {item.uom}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {(selectedTransaction.batchId || selectedTransaction.workOrderId || selectedTransaction.project) && (
                <div className="border-t pt-4">
                  <Label className="text-xs text-muted-foreground">References</Label>
                  <div className="space-y-1 mt-2">
                    {selectedTransaction.batchId && (
                      <p className="text-sm">Batch ID: {selectedTransaction.batchId}</p>
                    )}
                    {selectedTransaction.workOrderId && (
                      <p className="text-sm">Work Order: {selectedTransaction.workOrderId}</p>
                    )}
                    {selectedTransaction.project && (
                      <p className="text-sm">Project: {selectedTransaction.project}</p>
                    )}
                    {selectedTransaction.department && (
                      <p className="text-sm">Department: {selectedTransaction.department}</p>
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
  );
}