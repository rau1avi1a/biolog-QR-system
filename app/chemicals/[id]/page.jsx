// app/inventory/chemical/[id]/page.jsx

import React from "react"
import connectMongoDB from "@lib/mongo"
import Chemical from "@/models/Chemical"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import ChemicalDetailClient from "./ChemicalDetailClient"

export const dynamic = "force-dynamic"

export default async function ChemicalDetailPage({ params }) {
  const { id } = params
  await connectMongoDB()

  const chem = await Chemical.findById(id).lean()
  if (!chem) {
    return <div className="p-4">Chemical not found</div>
  }

  // Convert ObjectId to string
  chem._id = chem._id.toString()

  // Convert date fields to string if any
  // if (chem.ExpirationDate instanceof Date) {
  //   chem.ExpirationDate = chem.ExpirationDate.toISOString()
  // }

  return (
    <div className="p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Chemical Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <ChemicalDetailClient initialData={chem} />
        </CardContent>
      </Card>
    </div>
  )
}
