import connectMongoDB from "@lib/mongo/index.js";
import Product from "@/models/Product";
import { NextResponse } from "next/server";

// Force dynamic route handling
export const dynamic = "force-dynamic";

// PUT => edit top-level fields like CatalogNumber, ProductName
export async function PUT(request, { params }) {
  try {
    const { id } = params; // Extract `id`
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

    return NextResponse.json(updatedProduct, { status: 200 });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json(
      { message: "Failed to update product", details: error.message },
      { status: 500 }
    );
  }
}

// GET => return the entire product (including embedded lots)
export async function GET(request, { params }) {
  try {
    const { id } = params;

    await connectMongoDB();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(product, { status: 200 });
  } catch (error) {
    console.error("Error fetching product:", error);
    return NextResponse.json(
      { message: "Failed to fetch product", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE => remove entire product
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    await connectMongoDB();

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Product deleted" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json(
      { message: "Failed to delete product", details: error.message },
      { status: 500 }
    );
  }
}
