// app/api/products/[id]/route.js

import connectMongoDB from "@lib/mongo/index.js";
import Product from "@/models/Product";
import { NextResponse } from "next/server";
import { revalidatePath } from 'next/cache'; // Import revalidatePath for On-Demand Revalidation

// Force dynamic route handling
export const dynamic = "force-dynamic";

// Helper function to extract `id` asynchronously
const getIdFromContext = async (context) => {
  const { id } = await context.params;
  if (!id) {
    throw new Error("Product ID is missing in the route parameters.");
  }
  return id;
};

/**
 * GET /api/products/[id]
 *
 * Returns a single Product document by ID.
 * Includes virtuals and formats lots' expiration dates to "YYYY-MM-DD".
 * Caches the response for 60 seconds on the CDN.
 */
export async function GET(request, context) {
  try {
    const id = await getIdFromContext(context); // Await params

    await connectMongoDB();
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    // Convert to plain object and include virtuals
    const doc = product.toObject({ virtuals: true });

    // Format the lots' expiration dates
    if (Array.isArray(doc.Lots)) {
      doc.Lots = doc.Lots.map((lot) => {
        let expirationDate;

        if (
          lot.calculatedExpirationDate instanceof Date &&
          !isNaN(lot.calculatedExpirationDate)
        ) {
          expirationDate = lot.calculatedExpirationDate
            .toISOString()
            .split("T")[0];
        } else if (
          lot.ExpirationDate instanceof Date &&
          !isNaN(lot.ExpirationDate)
        ) {
          expirationDate = new Date(lot.ExpirationDate)
            .toISOString()
            .split("T")[0];
        } else {
          expirationDate = "N/A";
        }

        return {
          ...lot,
          ExpirationDate: expirationDate,
        };
      });
    }

    // Create response with Cache-Control header
    const response = NextResponse.json(doc, { status: 200 });
    response.headers.set(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=30"
    ); // Cache for 60 seconds

    return response;
  } catch (err) {
    console.error("GET /api/products/[id] error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/products/[id]
 *
 * Updates a product's top-level fields like CatalogNumber and ProductName.
 * Triggers revalidation of the GET /api/products/[id] route to update cached data immediately.
 */
export async function PUT(request, context) {
  try {
    const id = await getIdFromContext(context); // Await params
    const body = await request.json(); // Parse request body

    await connectMongoDB(); // Connect to MongoDB

    const updatedProduct = await Product.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updatedProduct) {
      return NextResponse.json(
        { message: "Product not found" },
        { status: 404 }
      );
    }

    // Convert to plain object and include virtuals
    const doc = updatedProduct.toObject({ virtuals: true });

    // Trigger On-Demand Revalidation for this product
    await revalidatePath(`/api/products/${id}`);

    // Create response with Cache-Control header to prevent caching
    const response = NextResponse.json(doc, { status: 200 });
    response.headers.set("Cache-Control", "no-store"); // Do not cache PUT responses

    return response;
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { message: "Failed to update product", details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 *
 * Deletes a product by ID.
 * Triggers revalidation of the GET /api/products/[id] route to update cached data immediately.
 */
export async function DELETE(request, context) {
  try {
    const id = await getIdFromContext(context); // Await params

    await connectMongoDB();

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    // Trigger On-Demand Revalidation for this product
    await revalidatePath(`/api/products/${id}`);

    // Create response with Cache-Control header to prevent caching
    const response = NextResponse.json(
      { message: "Product deleted" },
      { status: 200 }
    );
    response.headers.set("Cache-Control", "no-store"); // Do not cache DELETE responses

    return response;
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { message: "Failed to delete product", details: error.message },
      { status: 500 }
    );
  }
}
