"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  MinusIcon,
  TrashIcon,
  EditIcon,
  PlusIcon,
} from "lucide-react";

// Function to determine the actual action based on notes and stored action
const determineRealAction = (entry) => {
  const storedAction = entry.action;
  const notes = entry.notes || "";
  
  // If notes indicate an addition but action is not ADD, override it
  if (notes.toLowerCase().includes('add') && storedAction !== 'ADD') {
    return 'ADD';
  }
  
  return storedAction;
};

// Updated action icons
const actionIcons = {
  USE: <MinusIcon className="h-4 w-4 text-yellow-500" />,
  DEPLETE: <TrashIcon className="h-4 w-4 text-red-500" />,
  ADJUST: <EditIcon className="h-4 w-4 text-blue-500" />,
  REMOVE: <TrashIcon className="h-4 w-4 text-red-500" />,
  ADD: <PlusIcon className="h-4 w-4 text-green-500" />,
};

const actionColors = {
  USE: "text-yellow-600",
  DEPLETE: "text-red-600",
  ADJUST: "text-blue-600",
  REMOVE: "text-red-600",
  ADD: "text-green-600",
};

const ChemicalAuditTable = ({ auditHistory = [] }) => {
  // Helper function to determine the arrow direction based on action and notes
  const getQuantityChangeIcon = (entry) => {
    const action = determineRealAction(entry);
    const notes = entry.notes || "";
    
    // Check notes for indications of addition
    if (action === 'ADD' || notes.toLowerCase().includes('add')) {
      return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
    }
    
    if (action === "USE" || action === "DEPLETE" || action === "REMOVE") {
      return <ArrowDownIcon className="h-4 w-4 text-red-500" />;
    } else if (action === "ADJUST") {
      // For ADJUST, look at notes to determine direction
      if (notes.toLowerCase().includes('increase')) {
        return <ArrowUpIcon className="h-4 w-4 text-green-500" />;
      } else if (notes.toLowerCase().includes('decrease')) {
        return <ArrowDownIcon className="h-4 w-4 text-red-500" />;
      }
      return null;
    }
    return null;
  };

  if (!auditHistory?.length) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Lot Number</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>QuantityRemaining</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Project</TableHead>
            <TableHead>Notes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={8} className="text-center py-4 text-gray-500">
              No transactions found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  console.log("First few audit entries:", auditHistory.slice(0, 3).map(entry => ({
    action: entry.action,
    notes: entry.notes,
    quantityUsed: entry.lot?.QuantityUsed
  })));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Lot Number</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>QuantityRemaining</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {auditHistory.map((entry) => {
          // Determine the actual action based on notes and stored action
          const displayAction = determineRealAction(entry);
          
          return (
            <TableRow key={entry._id}>
              {/* Date */}
              <TableCell className="whitespace-nowrap">
                {formatDistanceToNow(new Date(entry.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>

              {/* Action - use the determined action */}
              <TableCell>
                <div className="flex items-center gap-2">
                  {actionIcons[displayAction] || actionIcons.ADJUST}
                  <span className={actionColors[displayAction] || actionColors.ADJUST}>
                    {displayAction}
                  </span>
                </div>
              </TableCell>

              {/* Lot Number */}
              <TableCell>{entry.lot?.LotNumber || "—"}</TableCell>

              {/* Change - using the entry-specific logic */}
              <TableCell>
                <div className="flex items-center gap-1">
                  {getQuantityChangeIcon(entry)}
                  {entry.lot?.QuantityUsed || 0}
                </div>
              </TableCell>

              {/* QuantityRemaining */}
              <TableCell>{entry.lot?.QuantityRemaining ?? "—"}</TableCell>

              {/* User */}
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{entry.user?.name || "—"}</span>
                  <span className="text-sm text-gray-500">
                    {entry.user?.email || "—"}
                  </span>
                </div>
              </TableCell>

              {/* Project */}
              <TableCell>{entry.project || "—"}</TableCell>

              {/* Notes */}
              <TableCell className="max-w-[200px] truncate" title={entry.notes}>
                {entry.notes || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ChemicalAuditTable;