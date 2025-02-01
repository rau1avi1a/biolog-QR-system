// app/inventory/product/[id]/page.jsx
import React from "react"
import connectMongoDB from "@lib/index"
import Product from "@/models/Product"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

// Force dynamic route to avoid param errors
export const dynamic = "force-dynamic"

export default async function ProductDetailPage({ params }) {
  const { id } = params

  await connectMongoDB()

  // Fetch the product from Mongo
  const product = await Product.findById(id).lean()
  if (!product) {
    return <div className="p-4">Product not found</div>
  }

  // Convert ObjectId -> string
  product._id = product._id.toString()

  // If you have a real Date field, convert it to string:
  if (product.ExpirationDate instanceof Date) {
    product.ExpirationDate = product.ExpirationDate.toISOString().split("T")[0]
  }

  // Render a minimal server layout
  return (
    <div className="p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Product Detail</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Pass product to client, letting the client show all dynamic fields */}
        </CardContent>
      </Card>
    </div>
  )
}
