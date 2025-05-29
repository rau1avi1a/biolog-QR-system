"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Eye, ChevronLeft, MoreHorizontal, Trash } from "lucide-react";
import TransactionsTable from "@/components/TransactionsTable";
import { useItemTransactions } from "@/hooks/useItemTransactions";

export default function ChemicalDetail() {
  const router = useRouter();
  const { id, lotId } = useParams();
  const qc = useQueryClient();


  // 1️⃣ Fetch the ITEM instead of the CHEMICAL
  const { data: raw, isLoading } = useQuery({
    queryKey: ["item", id],
    queryFn: () =>
      fetch(`/api/items/${id}`)
        .then((r) => r.json())
        .then((d) => d.item),
  });

  // 2️⃣ Map it into your old Chemical shape
  const chemical = raw
    ? {
        _id: id,
        BiologNumber: raw.sku,
        ChemicalName: raw.displayName,
        CASNumber: raw.casNumber || "",
        Location: raw.location || "",
        Lots: (raw.Lots || []).map((l) => ({
          _id: l.LotNumber,        // if you need an _id
          LotNumber: l.LotNumber,
          Quantity: l.Quantity,
        })),
        totalQuantity: raw.qtyOnHand,
      }
    : null;



  // 3️⃣ Load transactions as before
  const { data: txns, isLoading: txLoading } = useItemTransactions(id);

  // delete‐lot dialog state…
  const [deletingLot, setDeletingLot] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function handleDeleteLot() {
    const lotId = deletingLot.LotNumber;
    try {
      setDeleteLoading(true);
      const res = await fetch(
        `/api/items/${id}/lots/${encodeURIComponent(lotId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      const { item: updated } = await res.json();
      qc.setQueryData(["item", id], updated);
      setDeletingLot(null);
      setDeleteOpen(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleteLoading(false);
    }
  }

  if (isLoading) return <div>Loading…</div>;
  if (!chemical) return <div>Chemical not found</div>;

  const lot = chemical.Lots.find(l => l.LotNumber === lotId);

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Button variant="outline" onClick={() => router.back()}>
        <ChevronLeft className="mr-2" />
        Back
      </Button>

      {/* Info card */}
      <Card>
        <CardHeader>
          <CardTitle>Chemical Information</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2">
            <InfoRow label="SKU">{chemical.BiologNumber}</InfoRow>
            <InfoRow label="Name">{chemical.ChemicalName}</InfoRow>
            <InfoRow label="CAS">{chemical.CASNumber || "N/A"}</InfoRow>
            <InfoRow label="Location">{chemical.Location || "N/A"}</InfoRow>
            <InfoRow label="Total Qty">{chemical.totalQuantity}</InfoRow>
            <InfoRow label="Status">
              <span
                className={
                  chemical.totalQuantity > 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {chemical.totalQuantity > 0
                  ? "Available"
                  : "Out of Stock"}
              </span>
            </InfoRow>
          </dl>
        </CardContent>
      </Card>

      {/* Lots table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Lots</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot Number</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chemical.Lots.map((lot) => (
                <TableRow key={lot.LotNumber}>
                  <TableCell>{lot.LotNumber}</TableCell>
                  <TableCell>{lot.Quantity}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
  {/* ← New “View Details” link */}
  <DropdownMenuItem asChild>
    <Link
      href={`/chemicals/${id}/lots/${lot.LotNumber}`}
      className="flex items-center gap-2"
    >
      <Eye className="h-4 w-4" />
      View Details
    </Link>
  </DropdownMenuItem>

  {/* ← Existing Delete */}
  <DropdownMenuItem
    className="text-red-600 flex items-center gap-2"
    onClick={() => {
      setDeletingLot(lot);
      setDeleteOpen(true);
    }}
  >
    <Trash className="h-4 w-4" />
    Delete Lot
  </DropdownMenuItem>
</DropdownMenuContent>                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionsTable data={txns} loading={txLoading} />
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lot?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete lot “{deletingLot?.LotNumber}”?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLot}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, children }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
