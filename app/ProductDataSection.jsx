"use client";

import React from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

import EditParentDialog from "./EditParentDialog";
import AddParentDialog from "./AddParentDialog"; // Import AddParentDialog
import EditLotDialog from "./EditLotDialog";
import AddLotDialog from "./AddLotDialog";
import { useRouter } from "next/navigation";
import { formatDate } from "@/components/utils/formatDate"; // Import formatDate utility

export default function ProductDataSection({ data, setData }) {
  const [expandedRows, setExpandedRows] = React.useState({});
  const [searchTerm, setSearchTerm] = React.useState("");

  // For "Edit Parent" dialog
  const [editParentOpen, setEditParentOpen] = React.useState(false);
  const [parentToEdit, setParentToEdit] = React.useState(null);

  // For "Add Parent" dialog
  const [addParentOpen, setAddParentOpen] = React.useState(false);

  // For "Edit Lot" dialog
  const [editLotOpen, setEditLotOpen] = React.useState(false);
  const [productIdForLot, setProductIdForLot] = React.useState(null);
  const [lotToEdit, setLotToEdit] = React.useState(null);

  // For "Add Lot" dialog
  const [addLotOpen, setAddLotOpen] = React.useState(false);
  const [productIdForAddLot, setProductIdForAddLot] = React.useState(null);

  const router = useRouter(); // For navigation to the lot details page

  function toggleExpand(prodId) {
    setExpandedRows((old) => ({
      ...old,
      [prodId]: !old[prodId],
    }));
  }

  // Edit parent
  function handleEditParent(prod) {
    setParentToEdit(prod);
    setEditParentOpen(true);
  }
  function handleParentSaved(updated) {
    // Replace in local state
    setData((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  }

  // Add new parent
  function handleAddParentSaved(newParent) {
    setData((prev) => [...prev, newParent]);
  }

  // Add new lot
  function handleAddLot(prod) {
    setProductIdForAddLot(prod._id);
    setAddLotOpen(true);
  }
  function handleLotAdded(updated) {
    // updated is entire product with new lot
    setData((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  }

  // Edit an existing lot
  function handleEditLot(prodId, lot) {
    setProductIdForLot(prodId);
    setLotToEdit(lot);
    setEditLotOpen(true);
  }
  function handleLotSaved(updated) {
    // updated doc with updated lot
    setData((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
  }

  // View lot details
  function handleViewLotDetails(prodId, lotId) {
    router.push(`/products/${prodId}/lots/${lotId}`);
  }

  // Filter logic
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
    <div className="space-y-4">
      {/* Top bar with search and add parent */}
      <div className="flex justify-between items-center">
        {/* Search box */}
        <input
          className="border px-2 py-1"
          placeholder="Search product or lot..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {/* Add Parent Button */}
        <Button onClick={() => setAddParentOpen(true)}>Add Product</Button>
      </div>

      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th className="p-2 text-left">Expand</th>
            <th className="p-2 text-left">CatalogNumber</th>
            <th className="p-2 text-left">ProductName</th>
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
                  <td className="p-2">{prod.ProductName}</td>
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
                          Edit Parent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddLot(prod)}>
                          Add New Lot
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="p-2 bg-gray-50">
                      {prod.Lots && prod.Lots.length > 0 ? (
                        <table className="w-full border">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="p-2 text-left">LotNumber</th>
                              <th className="p-2 text-left">Quantity</th>
                              <th className="p-2 text-left">ExpirationDate</th>
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

      {/* Add Parent Dialog */}
{/* Add Parent Dialog */}
      <AddParentDialog
        open={addParentOpen}
        onClose={() => setAddParentOpen(false)}
        section="product" // Explicitly pass "product" for adding a product
        onAdded={handleAddParentSaved}
      />

      {/* Parent edit dialog */}
      <EditParentDialog
        open={editParentOpen}
        onClose={() => setEditParentOpen(false)}
        product={parentToEdit}
        onSaved={handleParentSaved}
        onDeleted={(deletedId) => {
          setData((prev) => prev.filter((product) => product._id !== deletedId));
        }}
      />

      {/* Add new lot dialog */}
      <AddLotDialog
        open={addLotOpen}
        onClose={() => setAddLotOpen(false)}
        productId={productIdForAddLot}
        onLotAdded={handleLotAdded}
      />

      {/* Lot edit dialog */}
      <EditLotDialog
        open={editLotOpen}
        onClose={() => setEditLotOpen(false)}
        productId={productIdForLot}
        lot={lotToEdit}
        onSaved={handleLotSaved}
      />
    </div>
  );
}
