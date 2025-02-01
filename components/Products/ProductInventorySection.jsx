"use client";

import React, { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, Check } from "lucide-react"; // Import Trash2 and Check icons

import EditParentDialog from "./ProductEditParentDialog";
import AddParentDialog from "./ProductAddParentDialog";
import EditLotDialog from "./ProductEditLotDialog";
import AddLotDialog from "./ProductAddLotDialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
} from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { formatDate } from "@/components/utils/formatDate";
import { cn } from "@/lib/utils";

export default function ProductDataSection({ data, setData }) {
  const [expandedRows, setExpandedRows] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  // Dialog states
  const [editParentOpen, setEditParentOpen] = useState(false);
  const [parentToEdit, setParentToEdit] = useState(null);
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [editLotOpen, setEditLotOpen] = useState(false);
  const [productIdForLot, setProductIdForLot] = useState(null);
  const [lotToEdit, setLotToEdit] = useState(null);
  const [addLotOpen, setAddLotOpen] = useState(false);
  const [productIdForAddLot, setProductIdForAddLot] = useState(null);

  // For deletion
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'product' | 'lot', productId, lotId }
  const [alertOpen, setAlertOpen] = useState(false);

  // For toast notifications
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastTitle, setToastTitle] = useState("");

  const router = useRouter();

  const toggleExpand = (prodId) => {
    setExpandedRows((prev) => ({ ...prev, [prodId]: !prev[prodId] }));
  };

  // Handlers for dialogs
  const handleEditParent = (prod) => {
    setParentToEdit(prod);
    setEditParentOpen(true);
  };
  const handleParentSaved = (updated) => {
    setData((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    setToastTitle("Saved");
    setToastMessage("Product details have been saved.");
    setToastOpen(true);
  };
  const handleAddParentSaved = (newParent) => {
    setData((prev) => [...prev, newParent]);
    setToastTitle("Added");
    setToastMessage("New product has been added.");
    setToastOpen(true);
  };
  const handleAddLot = (prod) => {
    setProductIdForAddLot(prod._id);
    setAddLotOpen(true);
  };
  const handleLotAdded = (updated) => {
    setData((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    setToastTitle("Added");
    setToastMessage("New lot has been added.");
    setToastOpen(true);
  };
  const handleEditLot = (prodId, lot) => {
    setProductIdForLot(prodId);
    setLotToEdit(lot);
    setEditLotOpen(true);
  };
  const handleLotSaved = (updated) => {
    setData((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
    setToastTitle("Saved");
    setToastMessage("Lot details have been saved.");
    setToastOpen(true);
  };
  const handleViewLotDetails = (prodId, lotId) => {
    router.push(`/products/${prodId}/lots/${lotId}`);
  };

  // Handle Deletion
  const handleDelete = async () => {
    if (!deleteTarget) return;

    const { type, productId, lotId } = deleteTarget;

    try {
      if (type === "product") {
        const res = await fetch(`/api/products/${productId}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to delete product");

        setData((prev) => prev.filter((p) => p._id !== productId));
        setToastTitle("Deleted");
        setToastMessage("Product has been deleted successfully.");
      } else if (type === "lot") {
        const res = await fetch(`/api/products/${productId}/lots/${lotId}`, {
          method: "DELETE",
        });

        if (!res.ok) throw new Error("Failed to delete lot");

        setData((prev) =>
          prev.map((p) =>
            p._id === productId
              ? { ...p, Lots: p.Lots.filter((l) => l._id !== lotId) }
              : p
          )
        );
        setToastTitle("Deleted");
        setToastMessage("Lot has been deleted successfully.");
      }

      setToastOpen(true);
    } catch (err) {
      console.error("Deletion error:", err);
      setToastTitle("Error");
      setToastMessage(`Failed to delete the ${type}.`);
      setToastOpen(true);
    } finally {
      setDeleteTarget(null);
      setAlertOpen(false);
    }
  };

  // Filter products based on search
  const filtered = data.filter((prod) => {
    const lower = searchTerm.toLowerCase();
    const matchParent =
      prod.ProductName.toLowerCase().includes(lower) ||
      prod.CatalogNumber.toLowerCase().includes(lower);
    const matchLot = prod.Lots.some((lot) =>
      lot.LotNumber.toLowerCase().includes(lower)
    );
    return matchParent || matchLot;
  });

  return (
    <ToastProvider>
      <div className="space-y-4 p-4">
        {/* Top bar with search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Search box */}
          <input
            className="w-full md:w-1/3 border px-3 py-2 rounded-md"
            placeholder="Search product or lot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse">
            <thead className="bg-gray-200">
              <tr>
                <th className="p-2 text-left">Expand</th>
                <th className="p-2 text-left">Catalog Number</th>
                <th className="p-2 text-left">Product Name</th>
                <th className="p-2 text-left">Total Qty</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prod) => {
                const isExpanded = expandedRows[prod._id] || false;
                return (
                  <React.Fragment key={prod._id}>
                    <tr className="border-b">
                      <td className="p-2">
                        <button onClick={() => toggleExpand(prod._id)}>
                          {isExpanded ? "▼" : "►"}
                        </button>
                      </td>
                      <td className="p-2">{prod.CatalogNumber}</td>
                      <td className="p-2">
                        {/* Truncate after first word on mobile */}
                        <span className="block md:hidden">
                          {prod.ProductName.split(" ")[0]}
                        </span>
                        <span className="hidden md:block">
                          {prod.ProductName}
                        </span>
                      </td>
                      <td className="p-2">{prod.totalQuantity || 0}</td>
                      <td className="p-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditParent(prod)}>
                              Edit Product
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAddLot(prod)}>
                              Add Lot
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setDeleteTarget({ type: "product", productId: prod._id });
                                setAlertOpen(true);
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Product
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="p-2 bg-gray-50">
                          {prod.Lots && prod.Lots.length > 0 ? (
                            <table className="min-w-full border-collapse">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="p-2 text-left">Lot Number</th>
                                  <th className="p-2 text-left">Quantity</th>
                                  <th className="p-2 text-left">Expiration Date</th>
                                  <th className="p-2 text-left">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {prod.Lots.map((lot) => (
                                  <tr key={lot._id} className="border-b">
                                    <td
                                      className={`p-2 ${
                                        !lot.isAvailable
                                          ? "opacity-50 text-[#750000]"
                                          : ""
                                      }`}
                                    >
                                      {lot.LotNumber}
                                    </td>
                                    <td
                                      className={`p-2 ${
                                        !lot.isAvailable
                                          ? "opacity-50 text-[#750000]"
                                          : ""
                                      }`}
                                    >
                                      {lot.Quantity}
                                    </td>
                                    <td
                                      className={`p-2 ${
                                        !lot.isAvailable
                                          ? "opacity-50 text-[#750000]"
                                          : ""
                                      }`}
                                    >
                                      {lot.ExpirationDate && lot.ExpirationDate !== "N/A"
                                        ? formatDate(lot.ExpirationDate)
                                        : "N/A"}
                                    </td>
                                    <td className="p-2">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            className="h-8 w-8 p-0"
                                          >
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleEditLot(prod._id, lot)
                                            }
                                          >
                                            Edit Lot
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleViewLotDetails(
                                                prod._id,
                                                lot._id
                                              )
                                            }
                                          >
                                            View Details
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setDeleteTarget({
                                                type: "lot",
                                                productId: prod._id,
                                                lotId: lot._id,
                                              });
                                              setAlertOpen(true);
                                            }}
                                            className="text-red-600"
                                          >
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Delete Lot
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-sm text-gray-600">No lots found.</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Bar with Add Product */}
        <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-4">
          {/* Add Product Button */}
          <Button onClick={() => setAddParentOpen(true)}>Add Product</Button>
        </div>

        {/* AlertDialog for Deletion Confirmation */}
        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogTrigger asChild>
            {/* Hidden trigger */}
            <span></span>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.type === "product" ? "Delete Product" : "Delete Lot"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this{" "}
                {deleteTarget?.type === "product" ? "product" : "lot"}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setAlertOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleDelete();
                }}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialogs */}
        <AddParentDialog
          open={addParentOpen}
          onClose={() => setAddParentOpen(false)}
          section="product"
          onAdded={handleAddParentSaved}
        />

        <EditParentDialog
          open={editParentOpen}
          onClose={() => setEditParentOpen(false)}
          product={parentToEdit}
          onSaved={handleParentSaved}
          onDeleted={(deletedId) => {
            setData((prev) => prev.filter((product) => product._id !== deletedId));
            setToastTitle("Deleted");
            setToastMessage("Product has been deleted successfully.");
            setToastOpen(true);
          }}
        />

        <AddLotDialog
          open={addLotOpen}
          onClose={() => setAddLotOpen(false)}
          productId={productIdForAddLot}
          onLotAdded={handleLotAdded}
        />

        <EditLotDialog
          open={editLotOpen}
          onClose={() => setEditLotOpen(false)}
          productId={productIdForLot}
          lot={lotToEdit}
          onSaved={handleLotSaved}
        />

        {/* Toast Notification */}
        <Toast open={toastOpen} onOpenChange={setToastOpen}>
          <div className="flex items-center space-x-2">
            {toastTitle === "Saved" || toastTitle === "Added" || toastTitle === "Deleted" ? (
              <Check className="h-6 w-6 text-green-500" />
            ) : null}
            <div>
              <ToastTitle>{toastTitle}</ToastTitle>
              <ToastDescription>{toastMessage}</ToastDescription>
            </div>
          </div>
        </Toast>
        <ToastViewport />
      </div>
    </ToastProvider>
  );
}
