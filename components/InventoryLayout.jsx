"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import ProductDataSection from "./Products/ProductInventorySection";
import ChemicalDataSection from "./Chemicals/ChemicalInventorySection";

export default function InventoryLayout() {
  const [activeSection, setActiveSection] = useState("chemical");
  const [productData, setProductData] = useState([]);
  const [chemicalData, setChemicalData] = useState([]);

  useEffect(() => {
    // 1. Fetch Products from new Items API
    fetch("/api/items?itemType=product")
      .then((res) => res.json())
      .then(({ items }) => {
        // if your ProductDataSection expects the old shape, map here similarly
        setProductData(items);
      })
      .catch(console.error);

    // 2. Fetch Chemicals from new Items API
    fetch("/api/items?itemType=chemical")
      .then((res) => res.json())
      .then(({ items }) => {
        // Map Item → legacy Chemical shape for your existing UI
        const chems = items.map((item) => ({
          _id:           item.id,
          BiologNumber:  item.sku,
          ChemicalName:  item.displayName,
          CASNumber:     item.casNumber  ?? "",
          Location:      item.location   ?? "",
          Lots:          (item.lots || []).map((l) => ({
            _id:       l.LotNumber,          // use the lot ID if you had one
            LotNumber: l.LotNumber,
            Quantity:  l.Quantity
          })),
          // copy any other fields your UI reads…
        }));
        setChemicalData(chems);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto max-w-5xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Inventory</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveSection("chemical")}
              className={`px-4 py-2 font-semibold rounded ${
                activeSection === "chemical"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              Chemicals
            </button>
            <button
              onClick={() => setActiveSection("solutions")}
              className={`px-4 py-2 font-semibold rounded ${
                activeSection === "product"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              Solutions
            </button>
            
            <button
              onClick={() => setActiveSection("product")}
              className={`px-4 py-2 font-semibold rounded ${
                activeSection === "product"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              Products
            </button>

          </div>

          {activeSection === "product" ? (
            <ProductDataSection data={productData} setData={setProductData} />
          ) : (
            <ChemicalDataSection
              data={chemicalData}
              setData={setChemicalData}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
