// app/api/products/upload/route.js
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectMongoDB from '@/lib/index.js';
import Product from '@/models/Product';

const readFile = async (file) => {
  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer).toString('utf-8');
};

function parseCSVToProducts(csvData) {
  try {
    // Split the CSV into lines
    const lines = csvData.split('\n').map(line => line.trim()).filter(line => line);

    // Skip header lines (if needed)
    const dataLines = lines.slice(5);  // Adjust this number based on your CSV structure

    // Parse the actual data rows
    const records = parse(dataLines.join('\n'), {
      skip_empty_lines: true,
      relax_column_count: true,
    });

    // Get headers (first row of data)
    const headers = records[0];
    
    // Process data rows (skip header row)
    const products = records.slice(1).map(row => {
      const [catalogNumber, productName, lotString] = row;
      
      if (!catalogNumber?.trim() || !productName?.trim()) {
        console.warn("Invalid product record: Missing required fields", row);
        return null;
      }

      // Parse lots if they exist
      const lots = parseLotInfo(lotString);

      return {
        CatalogNumber: catalogNumber.trim(),
        ProductName: productName.trim(),
        Lots: lots,
        lastUpdated: new Date()
      };
    });

    return products.filter(Boolean);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
}

function parseLotInfo(lotString) {
  if (!lotString) return [];
  
  const lots = lotString.split(',').map(lot => {
    const match = lot.trim().match(/([A-Za-z0-9-]+)\(([0-9.]+)\)/);
    if (!match) return null;
    
    return {
      LotNumber: match[1],
      Quantity: parseFloat(match[2]),
      isAvailable: parseFloat(match[2]) > 0,
      lastUpdated: new Date()
    };
  }).filter(Boolean);

  return lots;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded.' }, 
        { status: 400 }
      );
    }

    const csvData = await readFile(file);
    const products = parseCSVToProducts(csvData);

    if (!products.length) {
      return NextResponse.json(
        { error: 'No valid product records found in the CSV file.' }, 
        { status: 400 }
      );
    }

    await connectMongoDB();

    const bulkOps = products.map(product => ({
      updateOne: {
        filter: { CatalogNumber: product.CatalogNumber },
        update: { 
          $set: {
            ProductName: product.ProductName,
            ShelfLife: product.ShelfLife,
            lastUpdated: new Date()
          },
          $addToSet: {
            Lots: {
              $each: product.Lots
            }
          }
        },
        upsert: true
      }
    }));

    const result = await Product.bulkWrite(bulkOps);

    return NextResponse.json(
      { 
        message: 'Products added successfully!',
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }, 
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing products:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process products', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}