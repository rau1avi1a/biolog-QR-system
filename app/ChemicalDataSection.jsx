"use client"

import React from "react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal } from "lucide-react"

import ChemEditParentDialog from "./ChemEditParentDialog"
import ChemEditLotDialog from "./ChemEditLotDialog"
import ChemAddLotDialog from "./ChemAddLotDialog"

export default function ChemicalDataSection({ data, setData }) {
  const [expandedRows, setExpandedRows] = React.useState({})
  const [searchTerm, setSearchTerm] = React.useState("")

  // For editing parent
  const [editParentOpen, setEditParentOpen] = React.useState(false)
  const [parentToEdit, setParentToEdit] = React.useState(null)

  // For add lot
  const [addLotOpen, setAddLotOpen] = React.useState(false)
  const [chemIdForAddLot, setChemIdForAddLot] = React.useState(null)

  // For edit lot
  const [editLotOpen, setEditLotOpen] = React.useState(false)
  const [chemIdForLot, setChemIdForLot] = React.useState(null)
  const [lotToEdit, setLotToEdit] = React.useState(null)

  function toggleExpand(chemId) {
    setExpandedRows((old) => ({
      ...old,
      [chemId]: !old[chemId],
    }))
  }

  function handleEditParent(chem) {
    setParentToEdit(chem)
    setEditParentOpen(true)
  }
  function handleParentSaved(updated) {
    setData((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
  }

  function handleAddLot(chem) {
    setChemIdForAddLot(chem._id)
    setAddLotOpen(true)
  }
  function handleLotAdded(updated) {
    setData((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
  }

  function handleEditLot(chemId, lot) {
    setChemIdForLot(chemId)
    setLotToEdit(lot)
    setEditLotOpen(true)
  }
  function handleLotSaved(updated) {
    setData((prev) => prev.map((c) => (c._id === updated._id ? updated : c)))
  }

  // Filter logic
  const lower = searchTerm.toLowerCase()
  const filtered = data.filter((chem) => {
    const matchParent =
      chem.ChemicalName.toLowerCase().includes(lower) ||
      chem.BiologNumber.toLowerCase().includes(lower)

    const matchLot = chem.Lots.some((lot) =>
      lot.LotNumber.toLowerCase().includes(lower)
    )
    return matchParent || matchLot
  })

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-2">
        <input
          className="border px-2 py-1"
          placeholder="Search chemical or lot..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <table className="w-full border">
        <thead className="bg-gray-200">
          <tr>
            <th>Expand</th>
            <th>Biolog Number</th>
            <th>Chemical Name</th>
            <th>CAS Number</th>
            <th>Location</th>
            <th>Total Qty</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((chem) => {
            const isExpanded = expandedRows[chem._id] || false
            return (
              <React.Fragment key={chem._id}>
                <tr className="border-b">
                  <td className="p-2">
                    <button onClick={() => toggleExpand(chem._id)}>
                      {isExpanded ? "▼" : "►"}
                    </button>
                  </td>
                  <td className="p-2">{chem.BiologNumber}</td>
                  <td className="p-2">{chem.ChemicalName}</td>
                  <td className="p-2">{chem.CASNumber}</td>
                  <td className="p-2">{chem.Location}</td>
                  <td className="p-2">{chem.totalQuantity ?? 0}</td>
                  <td className="p-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditParent(chem)}>
                          Edit Parent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleAddLot(chem)}>
                          Add New Lot
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>

                {isExpanded && (
                  <tr>
                    <td colSpan={5} className="p-2 bg-gray-50">
                      {chem.Lots && chem.Lots.length > 0 ? (
                        <table className="w-full border">
                          <thead className="bg-gray-100">
                            <tr>
                              <th>LotNumber</th>
                              <th>Quantity</th>
                              {/* If you have an ExpirationDate, uncomment */}
                              {/* <th>ExpirationDate</th> */}
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {chem.Lots.map((lot) => (
                              <tr key={lot._id} className="border-b">
                                <td className="p-2">{lot.LotNumber}</td>
                                <td className="p-2">{lot.Quantity}</td>
                                {/* <td className="p-2">{lot.ExpirationDate}</td> */}
                                <td className="p-2">
                                  <button
                                    onClick={() => handleEditLot(chem._id, lot)}
                                    className="px-2 py-1 bg-green-500 text-white rounded"
                                  >
                                    Edit Lot
                                  </button>
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
            )
          })}
        </tbody>
      </table>

      {/* Edit parent */}
      <ChemEditParentDialog
        open={editParentOpen}
        onClose={() => setEditParentOpen(false)}
        chemical={parentToEdit}
        onSaved={handleParentSaved}
      />

      {/* Add new lot */}
      <ChemAddLotDialog
        open={addLotOpen}
        onClose={() => setAddLotOpen(false)}
        chemicalId={chemIdForAddLot}
        onLotAdded={handleLotAdded}
      />

      {/* Edit existing lot */}
      <ChemEditLotDialog
        open={editLotOpen}
        onClose={() => setEditLotOpen(false)}
        chemicalId={chemIdForLot}
        lot={lotToEdit}
        onSaved={handleLotSaved}
      />
    </div>
  )
}
