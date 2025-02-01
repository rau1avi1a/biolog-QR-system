"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChemicalTable } from "./ChemHomeTable";
import ChemEditParentDialog from "./ChemEditParentDialog";
import ChemEditLotDialog from "./ChemEditLotDialog";
import ChemAddLotDialog from "./ChemAddLotDialog";
import { Upload } from "lucide-react";

export default function ChemicalDataSection({ data, setData }) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [editParentOpen, setEditParentOpen] = React.useState(false);
  const [parentToEdit, setParentToEdit] = React.useState(null);
  const [addLotOpen, setAddLotOpen] = React.useState(false);
  const [chemIdForAddLot, setChemIdForAddLot] = React.useState(null);
  const [editLotOpen, setEditLotOpen] = React.useState(false);
  const [chemIdForLot, setChemIdForLot] = React.useState(null);
  const [lotToEdit, setLotToEdit] = React.useState(null);
  const fileInputRef = useRef(null);

  function handleEditParent(chem) {
    setParentToEdit(chem);
    setEditParentOpen(true);
  }

  function handleParentSaved(updated) {
    setData((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  }

  function handleAddLot(chem) {
    setChemIdForAddLot(chem._id);
    setAddLotOpen(true);
  }

  function handleLotAdded(updated) {
    setData((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  }

  function handleEditLot(chemId, lot) {
    setChemIdForLot(chemId);
    setLotToEdit(lot);
    setEditLotOpen(true);
  }

  function handleLotSaved(updated) {
    setData((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please upload a valid CSV file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      alert(result.message || "Upload successful!");
      fetchData();
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(`Error uploading file: ${error.message}`);
    } finally {
      setIsUploading(false);
      event.target.value = null;
    }
  }

  async function fetchData() {
    try {
      const response = await fetch("/api/chemicals");
      if (!response.ok) throw new Error("Failed to fetch data");
      const newData = await response.json();
      setData(newData);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("Failed to fetch chemical data.");
    }
  }

  React.useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Chemical Inventory</h1>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            ref={fileInputRef}
            disabled={isUploading}
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? "Uploading..." : "Upload from Netsuite"}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <ChemicalTable
          data={data}
          onEditParent={handleEditParent}
          onAddLot={handleAddLot}
          onEditLot={handleEditLot}
        />
      </div>

      <ChemEditParentDialog
        open={editParentOpen}
        onClose={() => setEditParentOpen(false)}
        chemical={parentToEdit}
        onSaved={handleParentSaved}
      />

      <ChemAddLotDialog
        open={addLotOpen}
        onClose={() => setAddLotOpen(false)}
        chemicalId={chemIdForAddLot}
        onLotAdded={handleLotAdded}
      />

      <ChemEditLotDialog
        open={editLotOpen}
        onClose={() => setEditLotOpen(false)}
        chemicalId={chemIdForLot}
        lot={lotToEdit}
        onSaved={handleLotSaved}
      />
    </div>
  );
}