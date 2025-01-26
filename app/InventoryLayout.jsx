"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import ProductDataSection from "./ProductDataSection";
import ChemicalDataSection from "./ChemicalDataSection";

export default function InventoryLayout() {
  const [activeSection, setActiveSection] = useState("product");
  const [productData, setProductData] = useState([]);
  const [chemicalData, setChemicalData] = useState([]);
  const [uploadMessage, setUploadMessage] = useState("");

  // Fetch both data sets on mount
  useEffect(() => {
    // Fetch Product Inventory
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProductData(data))
      .catch(console.error);

    // Fetch Chemical Inventory
    fetch("/api/chemicals")
      .then((res) => res.json())
      .then((data) => setChemicalData(data))
      .catch(console.error);
  }, []);

  // Handle File Upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      setUploadMessage("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (response.ok) {
        setUploadMessage("Database seeded successfully!");
        // Refresh Product Data after successful upload
        fetch("/api/products")
          .then((res) => res.json())
          .then((data) => setProductData(data))
          .catch(console.error);
      } else {
        setUploadMessage(result.error || "Failed to upload file.");
      }
    } catch (error) {
      setUploadMessage("An error occurred during file upload.");
    }
  };

  return (
    <div className="container mx-auto py-10">
      {/* Outer card wraps the entire inventory layout */}
      <Card className="mx-auto max-w-5xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Inventory</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top row: toggle product vs chemical */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveSection("product")}
              className={`px-4 py-2 font-semibold rounded ${
                activeSection === "product"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              Product Inventory
            </button>
            <button
              onClick={() => setActiveSection("chemical")}
              className={`px-4 py-2 font-semibold rounded ${
                activeSection === "chemical"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              Chemical Inventory
            </button>
          </div>

          {/* Main content: either the ProductDataSection or ChemicalDataSection */}
          {activeSection === "product" ? (
            <ProductDataSection data={productData} setData={setProductData} />
          ) : (
            <ChemicalDataSection data={chemicalData} setData={setChemicalData} />
          )}

          {/* Upload button for Product Inventory */}
          {activeSection === "product" && (
            <div className="mt-6">
              <label
                htmlFor="file-upload"
                className="block mb-2 font-semibold text-gray-700"
              >
                Upload NetSuite Data:
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {uploadMessage && (
                <p
                  className={`mt-2 text-sm ${
                    uploadMessage.includes("success")
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {uploadMessage}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
