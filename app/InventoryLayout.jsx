"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import ProductDataSection from "./ProductDataSection";
import ChemicalDataSection from "./ChemicalDataSection";

export default function InventoryLayout() {
  const [activeSection, setActiveSection] = useState("chemical");
  const [productData, setProductData] = useState([]);
  const [chemicalData, setChemicalData] = useState([]);

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

  return (
    <div className="container mx-auto py-10">
      {/* Outer card wraps the entire inventory layout */}
      <Card className="mx-auto max-w-5xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Inventory</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Top row: toggle between Product and Chemical Inventory */}
          <div className="flex flex-col md:flex-row gap-4">
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
          </div>

          {/* Main content: either ProductDataSection or ChemicalDataSection */}
          {activeSection === "product" ? (
            <ProductDataSection data={productData} setData={setProductData} />
          ) : (
            <ChemicalDataSection data={chemicalData} setData={setChemicalData} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
