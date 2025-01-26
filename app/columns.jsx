"use client"

import Link from "next/link"
import React from "react"
import { MoreHorizontal } from "lucide-react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// 1. Columns for PRODUCT inventory
export const productColumns = [
  {
    accessorKey: "CatalogNumber",
    header: "Catalog Number",
  },
  {
    accessorKey: "ProductName",
    header: "Product Name",
  },
  {
    accessorKey: "LotNumber",
    header: "Lot Number",
  },
  {
    accessorKey: "ExpirationDate",
    header: "Expiration Date",
  },
  {
    accessorKey: "Quantity",
    header: "Quantity",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const product = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(product.id)}>
              Copy Product ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
            <Link
              href={`/product-inventory/${product.CatalogNumber}-${product.LotNumber}`}>
                View Product Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
            onClick={() => {handleEdit(product)}}>
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

// 2. Columns for CHEMICAL inventory
export const chemicalColumns = [
  {
    accessorKey: "BiologNumber",
    header: "Biolog Number",
  },
  {
    accessorKey: "ChemicalName",
    header: "Chemical Name",
  },
  {
    accessorKey: "LotNumber",
    header: "Lot Number",
  },
  {
    accessorKey: "CASNumber",
    header: "CAS Number",
  },
  {
    accessorKey: "Location",
    header: "Location",
  },
  {
    accessorKey: "Quantity",
    header: "Quantity",
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const chemical = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(chemical.id)}>
              Copy Chemical ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Link
              href={`/chemical-inventory/${chemical.BiologNumber}-${chemical.LotNumber}`}>
                View Chemical Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
            onClick={() => {handleEdit(chemical)}}>
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
