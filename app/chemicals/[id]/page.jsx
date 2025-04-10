"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ChevronLeft, MoreHorizontal, Trash, Edit } from "lucide-react";
import { formatDistance } from 'date-fns';
import ChemicalAuditTable from "@/components/Chemicals/ChemAuditTable";

export default function ChemicalDetail() {
  const router = useRouter();
  const params = useParams();
  const [chemical, setChemical] = React.useState(null);
  const [auditHistory, setAuditHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [deletingLot, setDeletingLot] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  React.useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      
      try {
        // Fetch chemical details
        const chemResponse = await fetch(`/api/chemicals/${params.id}`);
        if (!chemResponse.ok) throw new Error("Failed to fetch chemical");
        const chemData = await chemResponse.json();
        setChemical(chemData);

        // Fetch audit history
        const auditResponse = await fetch(`/api/chemicals/${params.id}/audit`);
        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          setAuditHistory(auditData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params?.id]);

  const handleDeleteLot = async () => {
    if (!deletingLot) return;
    
    setDeleteLoading(true);
    try {
      // Clean the lot ID by removing any "lot" prefix to ensure it works in production
      const cleanLotId = deletingLot._id.replace(/^lot/, '');
      
      const response = await fetch(`/api/chemicals/${chemical._id}/lots/${cleanLotId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete lot");
      }
      
      // Update the chemical data after deletion
      const updatedChemical = await response.json();
      setChemical(updatedChemical);
      
      // Close the dialog
      setDeleteDialogOpen(false);
      setDeletingLot(null);
    } catch (error) {
      console.error("Error deleting lot:", error);
      alert("Failed to delete lot. Please try again.");
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          Loading...
        </div>
      </div>
    );
  }

  if (!chemical) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          Chemical not found
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Button
        variant="outline"
        className="mb-4"
        onClick={() => router.push(`/home`)}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Chemical Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">Biolog Number</dt>
                <dd>{chemical.BiologNumber}</dd>
              </div>
              <div>
                <dt className="font-semibold">Chemical Name</dt>
                <dd>{chemical.ChemicalName}</dd>
              </div>
              <div>
                <dt className="font-semibold">CAS Number</dt>
                <dd>{chemical.CASNumber || "N/A"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Location</dt>
                <dd>{chemical.Location || "N/A"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Total Quantity</dt>
                <dd>{chemical.totalQuantity}</dd>
              </div>
              <div>
                <dt className="font-semibold">Status</dt>
                <dd className={chemical.totalQuantity > 0 ? "text-green-600" : "text-red-600"}>
                  {chemical.totalQuantity > 0 ? "Available" : "Out of Stock"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Updated Lots table section with dropdown menu */}
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
                  <TableRow key={lot._id || lot.LotNumber}>
                    <TableCell>{lot.LotNumber}</TableCell>
                    <TableCell>{lot.Quantity}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Clean the lot ID by removing any "lot" prefix to ensure it works in production
                            const cleanLotId = lot._id.replace(/^lot/, '');
                            router.push(`/chemicals/${chemical._id}/lots/${cleanLotId}`);
                          }}
                        >
                          View Lot Details
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-red-600 cursor-pointer flex items-center"
                              onClick={() => {
                                setDeletingLot(lot);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete Lot
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ChemicalAuditTable auditHistory={auditHistory}></ChemicalAuditTable>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the lot &quot;{deletingLot?.LotNumber}&quot;.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteLot();
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteLoading}
            >
              {deleteLoading ? "Deleting..." : "Delete Lot"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}