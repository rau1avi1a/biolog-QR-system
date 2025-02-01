// components/AuditTrail.jsx
"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileIcon,
  ClockIcon,
  CheckSquare,
  CheckCircle,
  Beaker,
  User,
} from "lucide-react";

export default function AuditTrail({ documentId }) {
  const [auditEntries, setAuditEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditTrail();
  }, [documentId]);

  async function fetchAuditTrail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/docs/annotations?docId=${documentId}`);
      if (!res.ok) throw new Error("Failed to fetch audit trail");
      const data = await res.json();
      setAuditEntries(data);
    } catch (error) {
      console.error("Error fetching audit trail:", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "new":
        return <FileIcon className="w-4 h-4" />;
      case "inProgress":
        return <ClockIcon className="w-4 h-4" />;
      case "review":
        return <CheckSquare className="w-4 h-4" />;
      case "completed":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "new":
        return "text-gray-500";
      case "inProgress":
        return "text-blue-500";
      case "review":
        return "text-orange-500";
      case "completed":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-lg font-semibold">Document Audit Trail</h3>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Date & Time</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead>Changes</TableHead>
            <TableHead>Chemical Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditEntries.map((entry, index) => (
            <TableRow key={entry._id || index}>
              <TableCell className="whitespace-nowrap">
                {new Date(entry.timestamp).toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(entry.status)}>
                    {getStatusIcon(entry.status)}
                  </span>
                  <span className="capitalize">{entry.status}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {entry.annotations?.length > 0 ? (
                    <span className="text-sm text-gray-600">
                      {entry.annotations.length} annotation(s) added
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">No annotations</span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-2">
                  {entry.metadata?.chemicals?.length > 0 && (
                    <div className="space-y-1">
                      {entry.metadata.chemicals.map((chemical, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Beaker className="w-4 h-4" />
                          <span>{chemical.name}</span>
                          <span className="text-gray-500">
                            ({chemical.amount} {chemical.unit})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.metadata?.pH && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">pH:</span>
                      <span>{entry.metadata.pH}</span>
                    </div>
                  )}
                  {!entry.metadata?.chemicals?.length && !entry.metadata?.pH && (
                    <span className="text-sm text-gray-400">No chemical data</span>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {auditEntries.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                No audit entries found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}