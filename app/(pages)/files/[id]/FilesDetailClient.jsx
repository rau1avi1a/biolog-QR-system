// app/files/[id]/FilesDetailClient.jsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/shadcn/components/button';
import { Badge } from '@/components/ui/shadcn/components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/shadcn/components/card';
import {
  ArrowLeft,
  FileText,
  Download,
  Calendar,
  User,
  Package,
  Beaker,
  Hash,
  FileCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  PlayCircle
} from 'lucide-react';

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

const getStatusConfig = (status) => {
  const configs = {
    'Draft': {
      color: 'bg-gray-100 text-gray-800',
      icon: FileText
    },
    'In Progress': {
      color: 'bg-blue-100 text-blue-800',
      icon: PlayCircle
    },
    'Review': {
      color: 'bg-yellow-100 text-yellow-800',
      icon: AlertCircle
    },
    'Completed': {
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle
    }
  };
  return configs[status] || configs['Draft'];
};

export default function FilesDetailClient({ batch }) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);

  const statusConfig = getStatusConfig(batch.status);
  const StatusIcon = statusConfig.icon;

  const handleBack = () => {
    // Check if there's a previous page in history
    if (window.history.length > 1) {
      router.back();
    } else {
      // If no history (opened in new tab), close the tab or go to home
      if (window.opener) {
        // If opened by another window, close this tab
        window.close();
      } else {
        // Otherwise, navigate to home page
        router.push('/home');
      }
    }
  };

  const handleDownload = async () => {
    if (!batch.signedPdf?.data) {
      alert('No signed PDF available for download');
      return;
    }

    setIsDownloading(true);
    try {
      // Create a download for the signed PDF
      const response = await fetch(`/api/files/${batch._id}/download`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Build filename: original-filename-lot-number.pdf
        const originalFileName = batch.fileId?.fileName || 'file';
        const baseName = originalFileName.replace(/\.pdf$/i, ''); // Remove .pdf extension if present
        const lotNumber = batch.solutionLotNumber || `run-${batch.runNumber}`;
        a.download = `${baseName}-${lotNumber}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        alert('Failed to download file');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Error downloading file');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Batch File #{batch.runNumber}</h1>
                <Badge variant="outline" className={statusConfig.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {batch.status}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {batch.fileId?.fileName || 'No file name'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* File Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                File Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">File Name</label>
                <p className="font-medium">{batch.fileId?.fileName || 'No file name'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Run Number</label>
                <p className="text-lg font-bold text-primary">#{batch.runNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <Badge variant="outline" className={statusConfig.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {batch.status}
                </Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Uploaded</label>
                <p>{formatDate(batch.fileId?.uploadedAt || batch.fileId?.createdAt || batch.createdAt)}</p>
              </div>
              {batch.fileId?.fileSize && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">File Size</label>
                  <p>{(batch.fileId.fileSize / 1024).toFixed(2)} KB</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batch Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-gray-500" />
                Batch Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Batch ID</label>
                <p className="font-mono text-sm">{batch._id}</p>
              </div>
              {batch.workOrderId && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Work Order</label>
                  <p>{batch.workOrderId}</p>
                </div>
              )}
              {batch.solutionLotNumber && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Solution Lot</label>
                  <p>{batch.solutionLotNumber}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created</label>
                <p>{formatDate(batch.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                <p>{formatDate(batch.updatedAt)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Solution & Product Information */}
          {(batch.snapshot?.solutionRef || batch.snapshot?.productRef) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-500" />
                  Solution & Product
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {batch.snapshot?.solutionRef && (
                  <div>
                    <label className="text-sm font-medium text-green-700">Solution</label>
                    <p className="font-medium">{batch.snapshot.solutionRef.displayName}</p>
                    <p className="text-xs text-muted-foreground">SKU: {batch.snapshot.solutionRef.sku}</p>
                  </div>
                )}
                {batch.snapshot?.productRef && (
                  <div>
                    <label className="text-sm font-medium text-blue-700">Product</label>
                    <p className="font-medium">{batch.snapshot.productRef.displayName}</p>
                    <p className="text-xs text-muted-foreground">SKU: {batch.snapshot.productRef.sku}</p>
                  </div>
                )}
                {batch.snapshot?.recipeQty && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Recipe Quantity</label>
                    <p>{batch.snapshot.recipeQty} {batch.snapshot.recipeUnit}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Process Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Process Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Work Order Created:</span>
                  <Badge variant={batch.workOrderCreated ? "secondary" : "outline"} className="ml-2">
                    {batch.workOrderCreated ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Chemicals Transacted:</span>
                  <Badge variant={batch.chemicalsTransacted ? "secondary" : "outline"} className="ml-2">
                    {batch.chemicalsTransacted ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Solution Created:</span>
                  <Badge variant={batch.solutionCreated ? "secondary" : "outline"} className="ml-2">
                    {batch.solutionCreated ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Archived:</span>
                  <Badge variant={batch.isArchived ? "secondary" : "outline"} className="ml-2">
                    {batch.isArchived ? "Yes" : "No"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-500" />
                Important Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {batch.submittedForReviewAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Submitted for Review</label>
                  <p>{formatDate(batch.submittedForReviewAt)}</p>
                </div>
              )}
              {batch.completedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Completed</label>
                  <p>{formatDate(batch.completedAt)}</p>
                </div>
              )}
              {batch.signedAt && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Signed</label>
                  <p>{formatDate(batch.signedAt)}</p>
                </div>
              )}
              {batch.signedBy && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Signed By</label>
                  <p>{batch.signedBy}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-green-500" />
                Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                onClick={handleDownload}
                disabled={isDownloading || !batch.signedPdf?.data}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {isDownloading ? 'Downloading...' : 'Download Signed PDF'}
              </Button>
              {!batch.signedPdf?.data && (
                <p className="text-xs text-muted-foreground">
                  No signed PDF available for download
                </p>
              )}
              <Button variant="outline" className="w-full" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Previous Page
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Components Section */}
        {batch.snapshot?.components && batch.snapshot.components.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Beaker className="h-5 w-5 text-green-500" />
                Recipe Components
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {batch.snapshot.components.map((component, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div>
                      <p className="font-medium">
                        {component.itemId?.displayName || `Component ${index + 1}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {component.itemId?.sku ? `SKU: ${component.itemId.sku}` : `ID: ${component.itemId}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{component.amount} {component.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejection Information */}
        {batch.wasRejected && (
          <Card className="mt-6 border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                Rejection Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Reason</label>
                <p>{batch.rejectionReason || 'No reason provided'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Rejected By</label>
                <p>{batch.rejectedBy || 'Unknown'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Rejected At</label>
                <p>{formatDate(batch.rejectedAt)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}