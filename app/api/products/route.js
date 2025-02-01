// app/api/products/route.js

import Product from "@/models/Product";
import connectMongoDB from "@lib/index.js";
import { NextResponse } from "next/server";
import { revalidatePath } from 'next/cache'; // Import revalidatePath for On-Demand Revalidation

// Force dynamic route handling if needed
export const dynamic = "force-dynamic";

/**
 * GET /api/products
 *
 * Returns an array of all Product documents.
 * Each product includes virtuals, and lots' expiration dates are formatted to "YYYY-MM-DD".
 * Caches the response for 60 seconds on the CDN.
 */
export async function GET() {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Fetch all products (virtuals will work because lean() is not used)
    const products = await Product.find({});

    // Format expiration dates for each lot
    const formatted = products.map((prod) => {
      const doc = prod.toObject({ virtuals: true });

      if (Array.isArray(doc.Lots)) {
        doc.Lots = doc.Lots.map((lot) => {
          let expirationDate;

          // Use `calculatedExpirationDate` if it's valid
          if (
            lot.calculatedExpirationDate instanceof Date &&
            !isNaN(lot.calculatedExpirationDate)
          ) {
            expirationDate = lot.calculatedExpirationDate
              .toISOString()
              .split("T")[0];
          }
          // Use `ExpirationDate` if it's valid
          else if (
            lot.ExpirationDate instanceof Date &&
            !isNaN(lot.ExpirationDate)
          ) {
            expirationDate = new Date(lot.ExpirationDate)
              .toISOString()
              .split("T")[0];
          } else {
            expirationDate = "N/A"; // Fallback if both dates are invalid
          }

          return {
            ...lot,
            ExpirationDate: expirationDate,
          };
        });
      }

      return doc;
    });

    // Create response with Cache-Control header
    const response = NextResponse.json(formatted, { status: 200 });
    response.headers.set(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=30"
    ); // Cache for 60 seconds

    return response;
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

/**
 * POST /api/products
 *
 * Creates a new product document.
 * Expects a JSON body like:
 *  {
 *    "CatalogNumber": "1300",
 *    "ProductName": "Gen III",
 *    "ShelfLife": 18,
 *    "Lots": [
 *      { "LotNumber": "G3-LotA", "Quantity": 100, "ExpirationDate": "2024-12-31" }
 *    ]
 *  }
 *
 * Returns the created doc, with each lot's ExpirationDate also formatted as "YYYY-MM-DD" if present.
 * Triggers revalidation of the GET /api/products route to update cached data immediately.
 */
export async function POST(request) {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    // Parse JSON body
    const body = await request.json();
    const { CatalogNumber, ProductName, ShelfLife, Lots } = body;

    // Validate required fields
    if (!CatalogNumber || !ProductName) {
      return NextResponse.json(
        { message: "Missing required fields (CatalogNumber, ProductName)" },
        { status: 400 }
      );
    }

    // Create product document
    const newProduct = await Product.create({
      CatalogNumber,
      ProductName,
      ShelfLife: ShelfLife || 12, // Default to 12 months if not provided
      Lots: Lots || [], // Default to empty array if no lots are provided
    });

    // Convert to plain object and include virtuals
    const doc = newProduct.toObject({ virtuals: true });

    // Format the lots' expiration dates
    if (Array.isArray(doc.Lots)) {
      doc.Lots = doc.Lots.map((lot) => {
        let expirationDate;

        // Use `calculatedExpirationDate` if it exists
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

    // Create response with Cache-Control header to prevent caching of POST responses
    const response = NextResponse.json(doc, { status: 201 });
    response.headers.set("Cache-Control", "no-store"); // Do not cache POST responses

    // Trigger On-Demand Revalidation for GET /api/products
    await revalidatePath('/api/products');

    return response;
  } catch (err) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
