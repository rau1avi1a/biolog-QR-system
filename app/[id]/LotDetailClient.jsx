//app/[id]/LotDetailClient.jsx
'use client';

import React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Package2,
  QrCode,
  Edit,
  History,
  Download,
  Printer,
  RefreshCw,
  MapPin,
  Calendar,
  User
} from 'lucide-react';
import QRCodeGenerator from '@/components/ui/QRCodeGenerator';

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

export default function LotDetailClient({ lot, item, transactions }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [showQRGenerator, setShowQRGenerator] = useState(false);

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
                History ({transactions.length})
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

          {/* Transaction History Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Lot Transaction History</h3>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Transaction Type</TableHead>
                        <TableHead>Quantity Change</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Memo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No transaction history available for this lot
                          </TableCell>
                        </TableRow>
                      ) : (
                        transactions.map((transaction) => 
                          transaction.relevantLines.map((line, lineIndex) => (
                            <TableRow key={`${transaction._id}-${lineIndex}`}>
                              <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">
                                  {transaction.txnType}
                                </Badge>
                              </TableCell>
                              <TableCell className={
                                line.qty < 0 ? 'text-red-600' : 'text-green-600'
                              }>
                                {line.qty > 0 ? '+' : ''}{line.qty} {item.uom}
                              </TableCell>
                              <TableCell>{transaction.createdBy || 'System'}</TableCell>
                              <TableCell>{transaction.project || 'N/A'}</TableCell>
                              <TableCell>{transaction.memo || transaction.txnType}</TableCell>
                            </TableRow>
                          ))
                        )
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
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
              // Use the permanent QR URL
              url: lot.qrCodeUrl
            }}
            onClose={() => setShowQRGenerator(false)}
          />
        )}
      </div>
    </div>
  );
}