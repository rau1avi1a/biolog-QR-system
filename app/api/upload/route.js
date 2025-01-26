import { NextResponse } from "next/server"
import { read, utils } from "xlsx"
import connectMongoDB from "@/lib/mongo/index.js"
import Product from "@/models/Product"

export const config = {
  api: {
    bodyParser: false,
  },
};

// 1) Read entire raw body
async function getFullRequestBuffer(req) {
  const chunks = [];
  for await (const chunk of req.body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// 2) Extract XML
function extractXMLString(fullString) {
  const startIndex = fullString.indexOf('<?xml');
  if (startIndex < 0) {
    throw new Error("No '<?xml' found. Are you sure this is Excel-XML?");
  }
  const endTag = '</Workbook>';
  const endIndex = fullString.indexOf(endTag);
  if (endIndex < 0) {
    throw new Error("No '</Workbook>' found. Possibly incomplete file.");
  }
  return fullString.substring(startIndex, endIndex + endTag.length);
}

// 3) Parse with sheetjs
function parseRowsFromXML(xmlString) {
  const workbook = read(xmlString, { type: "string" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(sheet, { header: 1 });
  return rows;
}

/**
 * 4) Transform => product docs
 */
function transformRowsToProducts(rows) {
  // Skip the header row
  const dataRows = rows.slice(1);

  const products = [];
  const invalidRows = [];

  dataRows.forEach((row, idx) => {
    // console.log(`=== DEBUG Row #${idx} ===`);
    // console.log("Full row =>", JSON.stringify(row));

    const catalogNum = (row[0] || "").toString().trim();
    const productName = (row[1] || "").toString().trim();
    const lotString = (row[2] || "").toString().trim();

    // console.log(" => CatalogNumber:", catalogNum);
    // console.log(" => ProductName:", productName);
    // console.log(" => LotString:", lotString);

    if (!catalogNum || !productName) {
      console.warn(`Invalid row #${idx}: Missing CatalogNumber or ProductName.`);
      invalidRows.push(row);
      return;
    }

    const lots = [];
    if (lotString) {
      // Split multiple lots separated by commas
      const pieces = lotString.split(",");
      for (const piece of pieces) {
        const match = piece.match(/^([\w-]+)\((\d+)\)$/);
        if (match) {
          const lotNum = match[1];
          const qty = parseInt(match[2], 10) || 0;
          lots.push({
            LotNumber: lotNum,
            Quantity: qty,
            ExpirationDate: null, // Adjust if ExpirationDate is added later
            isAvailable: qty > 0,
          });
        } else {
          console.warn(" => Lot string does not match expected format:", piece);
        }
      }
    } else {
      console.warn(` => LotString is empty for CatalogNumber: ${catalogNum}`);
    }

    // console.log(" => Final lots array:", lots);
    // console.log("======================================\n");

    products.push({
      CatalogNumber: catalogNum,
      ProductName: productName,
      Lots: lots,
    });
  });

  if (invalidRows.length) {
    console.warn("Invalid rows detected:", JSON.stringify(invalidRows));
  }

  return products;
}

export async function POST(req) {
  try {
    // A) Read entire raw body
    const fullBuffer = await getFullRequestBuffer(req);
    const fullString = fullBuffer.toString("utf-8");

    // B) Extract <Workbook>...
    const xmlString = extractXMLString(fullString);

    // C) Parse => array-of-arrays
    const rows = parseRowsFromXML(xmlString);

    // D) Transform => product docs
    const products = transformRowsToProducts(rows);
    if (!products.length) {
      throw new Error("No valid product rows found after parsing.");
    }

    // E) Connect + seed
    await connectMongoDB();
    await Product.deleteMany({});
    await Product.insertMany(products);

    return NextResponse.json({ message: "Database seeded successfully!" });
  } catch (err) {
    console.error("Error seeding from NetSuite Excel:", err);
    return NextResponse.json(
      { error: "Failed to seed. Check logs.", details: err.message },
      { status: 500 }
    );
  }
}
