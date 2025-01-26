// app/inventory/InventoryPage.jsx
"use client"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import { MoreHorizontal } from "lucide-react"

import Link from "next/link"

import React from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DataTable } from "../app/DataTable"
import { productColumns, chemicalColumns } from "../app/columns"

// Make sure the named exports from your seed files don't clash with local state
import { productData as seedProductData } from "@/scripts/seed"
import { chemicalData as seedChemicalData } from "@/seed-chem"

import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const getProducts = async() => {
  try {
    await fetch('http://localhost:3000/api/products', {
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(res.statusText)
    }

    return res.json();

  } catch (error) {
    console.log(error)
  }
}

const getChemicals = async() => {
  try {
    await fetch('http://localhost:3000/api/chemicals', {
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(res.statusText)
    }

    return res.json();

  } catch (error) {
    console.log(error)
  }
}

export default async function InventoryPage() {

  const {products} = await getProducts();

  const {chemicals} = await getChemicals();


  const [activeSection, setActiveSection] = React.useState("product")

  // Initialize local state with the "seed" arrays
  const [productData, setProductData] = React.useState(() => seedProductData)
  const [chemicalData, setChemicalData] = React.useState(() => seedChemicalData)

  // Which data set is active
  const data = activeSection === "product" ? productData : chemicalData
  const columns = activeSection === "product" ? productColumns : chemicalColumns

  // Track add/edit dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [isEditMode, setIsEditMode] = React.useState(false)

  // For editing an existing item
  const [editItem, setEditItem] = React.useState(null)

  // Form fields for "Add" or "Edit"
  const [formValues, setFormValues] = React.useState({})

  // Edit flow
  const handleEdit = (item) => {
    setIsEditMode(true)
    setEditItem(item)
    setFormValues(item)  // pre-fill form fields
    setDialogOpen(true)
  }

  // Add flow
  const handleAdd = () => {
    setIsEditMode(false)
    setEditItem(null)
    setFormValues({})
    setDialogOpen(true)
  }

  // Controlled inputs
  const handleChange = (e) => {
    setFormValues({ ...formValues, [e.target.name]: e.target.value })
  }

  // Save (either add or update)
  const handleSave = () => {
    if (activeSection === "product") {
      if (isEditMode && editItem) {
        // update existing product
        const updated = productData.map((p) =>
          p.id === editItem.id ? { ...p, ...formValues } : p
        )
        setProductData(updated)
      } else {
        // add new product
        const newId = `p-${Math.floor(Math.random() * 10000)}`
        const newProduct = {
          ...formValues,
          id: newId,
          Quantity: parseInt(formValues.Quantity || 0, 10),
        }
        setProductData([...productData, newProduct])
      }
    } else {
      // chemical
      if (isEditMode && editItem) {
        // update existing chemical
        const updated = chemicalData.map((c) =>
          c.id === editItem.id ? { ...c, ...formValues } : c
        )
        setChemicalData(updated)
      } else {
        // add new chemical
        const newId = `c-${Math.floor(Math.random() * 10000)}`
        const newChemical = {
          ...formValues,
          id: newId,
          Quantity: parseInt(formValues.Quantity || 0, 10),
        }
        setChemicalData([...chemicalData, newChemical])
      }
    }

    // Reset form & close dialog
    setFormValues({})
    setEditItem(null)
    setIsEditMode(false)
    setDialogOpen(false)
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto max-w-5xl">
        <CardHeader>
          <CardTitle className="text-2xl">Inventory</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Toggle product vs. chemical */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveSection("product")}
              className={`px-4 py-2 font-semibold rounded 
                ${activeSection === "product" 
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"}`}
            >
              Product Inventory
            </button>
            <button
              onClick={() => setActiveSection("chemical")}
              className={`px-4 py-2 font-semibold rounded
                ${activeSection === "chemical" 
                  ? "bg-blue-500 text-white" 
                  : "bg-gray-200 text-black"}`}
            >
              Chemical Inventory
            </button>

            {/* Add item button */}
            <button
              className="px-4 py-2 font-semibold rounded bg-green-500 text-white ml-auto"
              onClick={handleAdd}
            >
              Add Item
            </button>
          </div>

          {/* Pass handleEdit in your columns or override it dynamically */}
          <DataTable
            columns={columns.map((col) => {
              if (col.id === "actions") {
                return {
                  ...col,
                  cell: ({ row }) => {
                    const item = row.original
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/${activeSection}-inventory/${item.CatalogNumber ?? item.BiologNumber}-${item.LotNumber}`}>
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  },
                }
              }
              return col
            })}
            data={data}
          />
        </CardContent>
      </Card>

      {/* The dialog for Add / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit" : "Add"}{" "}
              {activeSection === "product" ? "Product" : "Chemical"}
            </DialogTitle>
          </DialogHeader>

          {/* Render form fields based on activeSection */}
          {activeSection === "product" ? (
            <div className="space-y-4">
              <div>
                <Label>Catalog Number</Label>
                <Input
                  name="CatalogNumber"
                  value={formValues.CatalogNumber || ""}
                  onChange={handleChange}
                  placeholder="e.g. 1300"
                />
              </div>
              <div>
                <Label>Product Name</Label>
                <Input
                  name="ProductName"
                  value={formValues.ProductName || ""}
                  onChange={handleChange}
                  placeholder="e.g. Gen III"
                />
              </div>
              <div>
                <Label>Lot Number</Label>
                <Input
                  name="LotNumber"
                  value={formValues.LotNumber || ""}
                  onChange={handleChange}
                  placeholder="e.g. 3910293"
                />
              </div>
              <div>
                <Label>Expiration Date</Label>
                <Input
                  name="ExpirationDate"
                  value={formValues.ExpirationDate || ""}
                  onChange={handleChange}
                  placeholder="e.g. 12 Dec 2024"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  name="Quantity"
                  value={formValues.Quantity || ""}
                  onChange={handleChange}
                  placeholder="e.g. 1200"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Biolog Number</Label>
                <Input
                  name="BiologNumber"
                  value={formValues.BiologNumber || ""}
                  onChange={handleChange}
                  placeholder="e.g. 24-000001"
                />
              </div>
              <div>
                <Label>Chemical Name</Label>
                <Input
                  name="ChemicalName"
                  value={formValues.ChemicalName || ""}
                  onChange={handleChange}
                  placeholder="e.g. Acetic Acid"
                />
              </div>
              <div>
                <Label>Lot Number</Label>
                <Input
                  name="LotNumber"
                  value={formValues.LotNumber || ""}
                  onChange={handleChange}
                  placeholder="e.g. AC-2023"
                />
              </div>
              <div>
                <Label>CAS Number</Label>
                <Input
                  name="CASNumber"
                  value={formValues.CASNumber || ""}
                  onChange={handleChange}
                  placeholder="e.g. 63-1-32"
                />
              </div>
              <div>
                <Label>Location</Label>
                <Input
                  name="Location"
                  value={formValues.Location || ""}
                  onChange={handleChange}
                  placeholder="e.g. Room Temperature"
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  name="Quantity"
                  value={formValues.Quantity || ""}
                  onChange={handleChange}
                  placeholder="e.g. 50"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
