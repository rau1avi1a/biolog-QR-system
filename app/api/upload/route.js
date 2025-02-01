// app/api/upload/route.js
import { NextResponse } from 'next/server';
import { parse } from 'csv-parse/sync';
import connectMongoDB from '@lib/index.js';
import Chemical from '@/models/Chemical';

const readFile = async (file) => {
  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer).toString('utf-8');
};

function parseLots(lotString) {
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

function parseCSVToChemicals(csvData) {
  try {
    const lines = csvData.split('\n').map(line => line.trim()).filter(line => line);
    const dataLines = lines.slice(5);
    const records = parse(dataLines.join('\n'), {
      skip_empty_lines: true,
      relax_column_count: true,
    });
    
    const chemicals = records.slice(1).map(row => {
      const [itemNumber, displayName, lotString] = row;
      
      if (!itemNumber?.trim() || !displayName?.trim()) {
        console.warn("Invalid chemical record: Missing required fields", row);
        return null;
      }

      const lots = parseLots(lotString);

      return {
        BiologNumber: itemNumber.trim(),
        ChemicalName: displayName.trim(),
        Lots: lots,
        lastUpdated: new Date()
      };
    });

    return chemicals.filter(Boolean);
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error(`Failed to parse CSV: ${error.message}`);
  }
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
    const chemicals = parseCSVToChemicals(csvData);

    if (!chemicals.length) {
      return NextResponse.json(
        { error: 'No valid chemical records found in the CSV file.' }, 
        { status: 400 }
      );
    }

    await connectMongoDB();

    // For each chemical, first get existing data
    const bulkOps = await Promise.all(chemicals.map(async chemical => {
      const existingChem = await Chemical.findOne({ BiologNumber: chemical.BiologNumber });
      
      return {
        updateOne: {
          filter: { BiologNumber: chemical.BiologNumber },
          update: { 
            $set: {
              ChemicalName: chemical.ChemicalName,
              Lots: chemical.Lots, // Replace entire Lots array
              lastUpdated: new Date(),
              // Preserve existing fields if they exist
              ...(existingChem?.CASNumber && { CASNumber: existingChem.CASNumber }),
              ...(existingChem?.Location && { Location: existingChem.Location }),
              // If you add new fields, you can preserve them here
              ...(existingChem?.Synonyms && { Synonyms: existingChem.Synonyms })
            }
          },
          upsert: true
        }
      };
    }));

    const result = await Chemical.bulkWrite(bulkOps);

    return NextResponse.json(
      { 
        message: 'Chemicals updated successfully!',
        modifiedCount: result.modifiedCount,
        upsertedCount: result.upsertedCount
      }, 
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing chemicals:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chemicals', 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}
