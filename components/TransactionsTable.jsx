'use client';

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  PackageCheck,
  PackageMinus,
  Wrench,
  ArrowUpAZ,
  ArrowDownAZ
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const typeIcon = {
  receipt:    <PackageCheck className="h-4 w-4 text-green-600" />,
  issue:      <PackageMinus className="h-4 w-4 text-red-600" />,
  adjustment: <Wrench className="h-4 w-4 text-blue-600" />,
  build:      <ArrowUpAZ className="h-4 w-4 text-purple-600" />
};

/** qty green if +, red if − */
function QtyCell({ qty }) {
  const up   = qty > 0;
  const icon = up ? <ArrowUpAZ className="h-4 w-4 text-green-600" />
                  : <ArrowDownAZ className="h-4 w-4 text-red-600" />;

  return (
    <div className="flex items-center gap-1">
      {icon}
      <span className={up ? 'text-green-600' : 'text-red-600'}>
        {qty}
      </span>
    </div>
  );
}

/**
 * @param {{ data?: any[], loading:boolean }} props
 */
export default function TransactionsTable({ data = [], loading }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-6" />
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Qty&nbsp;Δ</TableHead>
          <TableHead>Lot #</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Note</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell colSpan={6} className="py-6 text-center text-sm">
              Loading…
            </TableCell>
          </TableRow>
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="py-6 text-center text-sm">
              No transactions found
            </TableCell>
          </TableRow>
        ) : (
          data.flatMap((txn) =>
            txn.lines.map((ln, i) => (
              <TableRow key={txn.id + i}>
                <TableCell>{typeIcon[txn.txnType]}</TableCell>

                <TableCell className="whitespace-nowrap">
                  {formatDistanceToNow(new Date(txn.postedAt), {
                    addSuffix: true
                  })}
                </TableCell>

                <TableCell className="text-right">
                  <QtyCell qty={ln.qty} />
                </TableCell>

                <TableCell>{ln.lot || '—'}</TableCell>

                <TableCell>{txn.createdBy?.name || '—'}</TableCell>

                <TableCell className="max-w-[200px] truncate" title={txn.memo}>
                  {txn.memo || '—'}
                </TableCell>
              </TableRow>
            ))
          )
        )}
      </TableBody>
    </Table>
  );
}
