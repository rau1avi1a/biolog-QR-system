/**
 * scripts/seedSubSheets.js
 *
 * Example usage to parse numeric part from the folder under "/MFG Documents/MI/"
 * Then store a "snapshot" of catalogNumber/productName plus a reference to Product.
 */

import "dotenv/config";
import mongoose from "mongoose";
import getDropboxClient from "./lib/dropbox.js";
import connectMongoDB from "./lib/index.js";

import SubSheets from "./models/SubSheets.js";
import Product from "./models/Product.js";

async function seedSubSheets1() {
  try {
    // 1) Connect to Mongo
    await connectMongoDB();

    // 2) Create Dropbox client
    const dbx = getDropboxClient();

    // Start from "/MFG Documents/MI"
    const folderToImport = "/MFG Documents/MI";

    // 3) List contents (recursive:true if you want subfolders)
    const listRes = await dbx.filesListFolder({
      path: folderToImport,
      recursive: true,
    });
    const entries = listRes.result.entries;

    // 4) Iterate each entry
    for (const entry of entries) {
      // Skip folders and non-PDF files
      if (entry[".tag"] === "folder") continue;
      if (!entry.name.toLowerCase().endsWith(".pdf")) continue;

      console.log(`Processing PDF: ${entry.path_lower}`);

      // 5) Download the PDF from Dropbox
      const dlRes = await dbx.filesDownload({ path: entry.path_lower });
      const fileBinary = dlRes.result.fileBinary; // ArrayBuffer
      const pdfBuffer = Buffer.from(fileBinary);

      // 6) Parse the folder name after "MI"
      //    e.g. "/MFG Documents/MI/1006 - SomeProduct/subfolder/file.pdf"
      const segments = entry.path_lower.split("/");
      let catalogNumber = null;
      let productDoc = null; // We'll store the entire product doc if found

      if (segments.length > 3) {
        // For example "1006 - SomeProduct"
        const folderName = segments[3];
        // Extract digits only (e.g. "1006")
        const match = folderName.match(/\d+/);
        if (match) {
          catalogNumber = match[0]; // e.g. "1006"
          console.log("Parsed CatalogNumber:", catalogNumber);

          // 7) Try to find a Product by that number
          productDoc = await Product.findOne({ CatalogNumber: catalogNumber });
          if (productDoc) {
            console.log(
              `Found Product: ${productDoc.ProductName} (CatalogNumber: ${catalogNumber})`
            );
          } else {
            console.warn(`No Product found for CatalogNumber: ${catalogNumber}`);
          }
        }
      }

      // 8) Create SubSheets doc
      //    We'll store a subdocument "product" that has a hard copy + reference
      const subSheetDoc = new SubSheets({
        fileName: entry.name, // the actual PDF filename
        SolutionName: segments[3], // or anything else you want, e.g. folderName

        product: {
          catalogNumber: catalogNumber || null,
          productReference: productDoc?._id || null,
        },

        pdf: {
          data: pdfBuffer,
          contentType: "application/pdf",
        },
      });

      // 9) Save to Mongo
      await subSheetDoc.save();
      console.log(`Created SubSheet _id=${subSheetDoc._id}`);
    }

    console.log("Seeding completed!");
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    await mongoose.disconnect();
  }
}

async function seedSubSheets2() {
    try {
      // 1) Connect to Mongo
      await connectMongoDB();
  
      // 2) Create Dropbox client
      const dbx = getDropboxClient();
  
      // Start from "/MFG Documents/MI"
      const folderToImport = "/MFG Documents/PM";
  
      // 3) List contents (recursive:true if you want subfolders)
      const listRes = await dbx.filesListFolder({
        path: folderToImport,
        recursive: true,
      });
      const entries = listRes.result.entries;
  
      // 4) Iterate each entry
      for (const entry of entries) {
        // Skip folders and non-PDF files
        if (entry[".tag"] === "folder") continue;
        if (!entry.name.toLowerCase().endsWith(".pdf")) continue;
  
        console.log(`Processing PDF: ${entry.path_lower}`);
  
        // 5) Download the PDF from Dropbox
        const dlRes = await dbx.filesDownload({ path: entry.path_lower });
        const fileBinary = dlRes.result.fileBinary; // ArrayBuffer
        const pdfBuffer = Buffer.from(fileBinary);
  
        // 6) Parse the folder name after "MI"
        //    e.g. "/MFG Documents/MI/1006 - SomeProduct/subfolder/file.pdf"
        const segments = entry.path_lower.split("/");
        let catalogNumber = null;
        let productDoc = null; // We'll store the entire product doc if found
  
        if (segments.length > 3) {
          // For example "1006 - SomeProduct"
          const folderName = segments[3];
          // Extract digits only (e.g. "1006")
          const match = folderName.match(/\d+/);
          if (match) {
            catalogNumber = match[0]; // e.g. "1006"
            console.log("Parsed CatalogNumber:", catalogNumber);
  
            // 7) Try to find a Product by that number
            productDoc = await Product.findOne({ CatalogNumber: catalogNumber });
            if (productDoc) {
              console.log(
                `Found Product: ${productDoc.ProductName} (CatalogNumber: ${catalogNumber})`
              );
            } else {
              console.warn(`No Product found for CatalogNumber: ${catalogNumber}`);
            }
          }
        }
  
        // 8) Create SubSheets doc
        //    We'll store a subdocument "product" that has a hard copy + reference
        const subSheetDoc = new SubSheets({
          fileName: entry.name, // the actual PDF filename
          SolutionName: segments[3], // or anything else you want, e.g. folderName
  
          product: {
            catalogNumber: catalogNumber || null,
            productReference: productDoc?._id || null,
          },
  
          pdf: {
            data: pdfBuffer,
            contentType: "application/pdf",
          },
        });
  
        // 9) Save to Mongo
        await subSheetDoc.save();
        console.log(`Created SubSheet _id=${subSheetDoc._id}`);
      }
  
      console.log("Seeding completed!");
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      await mongoose.disconnect();
    }
  }
  

  async function seedSubSheets3() {
    try {
      // 1) Connect to Mongo
      await connectMongoDB();
  
      // 2) Create Dropbox client
      const dbx = getDropboxClient();
  
      // Start from "/MFG Documents/MI"
      const folderToImport = "/MFG Documents/PMM";
  
      // 3) List contents (recursive:true if you want subfolders)
      const listRes = await dbx.filesListFolder({
        path: folderToImport,
        recursive: true,
      });
      const entries = listRes.result.entries;
  
      // 4) Iterate each entry
      for (const entry of entries) {
        // Skip folders and non-PDF files
        if (entry[".tag"] === "folder") continue;
        if (!entry.name.toLowerCase().endsWith(".pdf")) continue;
  
        console.log(`Processing PDF: ${entry.path_lower}`);
  
        // 5) Download the PDF from Dropbox
        const dlRes = await dbx.filesDownload({ path: entry.path_lower });
        const fileBinary = dlRes.result.fileBinary; // ArrayBuffer
        const pdfBuffer = Buffer.from(fileBinary);
  
        // 6) Parse the folder name after "MI"
        //    e.g. "/MFG Documents/MI/1006 - SomeProduct/subfolder/file.pdf"
        const segments = entry.path_lower.split("/");
        let catalogNumber = null;
        let productDoc = null; // We'll store the entire product doc if found
  
        if (segments.length > 3) {
          // For example "1006 - SomeProduct"
          const folderName = segments[3];
          // Extract digits only (e.g. "1006")
          const match = folderName.match(/\d+/);
          if (match) {
            catalogNumber = match[0]; // e.g. "1006"
            console.log("Parsed CatalogNumber:", catalogNumber);
  
            // 7) Try to find a Product by that number
            productDoc = await Product.findOne({ CatalogNumber: catalogNumber });
            if (productDoc) {
              console.log(
                `Found Product: ${productDoc.ProductName} (CatalogNumber: ${catalogNumber})`
              );
            } else {
              console.warn(`No Product found for CatalogNumber: ${catalogNumber}`);
            }
          }
        }
  
        // 8) Create SubSheets doc
        //    We'll store a subdocument "product" that has a hard copy + reference
        const subSheetDoc = new SubSheets({
          fileName: entry.name, // the actual PDF filename
          SolutionName: segments[3], // or anything else you want, e.g. folderName
  
          product: {
            catalogNumber: catalogNumber || null,
            productReference: productDoc?._id || null,
          },
  
          pdf: {
            data: pdfBuffer,
            contentType: "application/pdf",
          },
        });
  
        // 9) Save to Mongo
        await subSheetDoc.save();
        console.log(`Created SubSheet _id=${subSheetDoc._id}`);
      }
  
      console.log("Seeding completed!");
    } catch (error) {
      console.error("Error seeding data:", error);
    } finally {
      await mongoose.disconnect();
    }
  }

// Run it
(async function runAllSeeds() {
    try {
      console.log("=== Starting seedSubSheets3 ===");
      await seedSubSheets2();
      console.log("=== Finished seedSubSheets3 ===");
  
      console.log("All seeding steps completed!");
    } catch (err) {
      console.error("Error in seeding pipeline:", err);
    } finally {
      // Optionally close the DB and exit
      await mongoose.disconnect();
      process.exit(0);
    }
  })();