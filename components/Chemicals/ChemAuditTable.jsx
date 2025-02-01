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
} from "lucide-react";

const actionIcons = {
  USE: <MinusIcon className="h-4 w-4 text-yellow-500" />,
  DEPLETE: <TrashIcon className="h-4 w-4 text-red-500" />,
  ADJUST: <EditIcon className="h-4 w-4 text-blue-500" />,
  REMOVE: <TrashIcon className="h-4 w-4 text-red-500" />,
  ADD: <ArrowUpIcon className="h-4 w-4 text-green-500" />,
};

const actionColors = {
  USE: "text-yellow-600",
  DEPLETE: "text-red-600",
  ADJUST: "text-blue-600",
  REMOVE: "text-red-600",
  ADD: "text-green-600",
};

const ChemicalAuditTable = ({ auditHistory = [] }) => {
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
        {auditHistory.map((entry) => (
          <TableRow key={entry._id}>
            {/* Date */}
            <TableCell className="whitespace-nowrap">
              {formatDistanceToNow(new Date(entry.createdAt), {
                addSuffix: true,
              })}
            </TableCell>

            {/* Action */}
            <TableCell>
              <div className="flex items-center gap-2">
                {actionIcons[entry.action]}
                <span className={actionColors[entry.action]}>
                  {entry.action}
                </span>
              </div>
            </TableCell>

            {/* Lot Number */}
            <TableCell>{entry.lot.LotNumber}</TableCell>

            {/* Change (arrow if USE => down arrow, if ADD => up arrow, else no arrow) */}
            <TableCell>
              <div className="flex items-center gap-1">
                {entry.action === "USE" && (
                  <ArrowDownIcon className="h-4 w-4 text-red-500" />
                )}
                {entry.action === "ADD" && (
                  <ArrowUpIcon className="h-4 w-4 text-green-500" />
                )}
                {entry.lot.QuantityUsed || 0}
              </div>
            </TableCell>

            {/* QuantityRemaining */}
            <TableCell>{entry.lot.QuantityRemaining ?? "—"}</TableCell>

            {/* User */}
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{entry.user.name}</span>
                <span className="text-sm text-gray-500">
                  {entry.user.email}
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
        ))}
      </TableBody>
    </Table>
  );
};

export default ChemicalAuditTable;
