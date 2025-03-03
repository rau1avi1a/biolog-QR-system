// pages/cyclecount.jsx
"use client"
import React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function CycleCountPage() {
  const [cycleCount, setCycleCount] = useState(null);
  const [updatedItems, setUpdatedItems] = useState([]);
  const [chemical, setChemical] = React.useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch the active cycle count on mount.
  useEffect(() => {
    async function fetchCycleCount() {
      setLoading(true);
      try {
        const res = await fetch("/api/cyclecount/active");
        if (res.ok) {
          const data = await res.json();
          setCycleCount(data.cycleCount);
          // initialize updatedItems with the previous values
          if (data.cycleCount) {
            setUpdatedItems(
              data.cycleCount.items.map((item) => ({
                chemicalId: item.chemical,
                LotNumber: item.LotNumber,
                countedQuantity: item.previousQuantity
              }))
            );
          }
        }
      } catch (error) {
        console.error("Error fetching cycle count:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCycleCount();
  }, []);

  // Handler for generating a new cycle count.
  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/cyclecount/generate", {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setCycleCount(data.cycleCount);
        setUpdatedItems(
          data.cycleCount.items.map((item) => ({
            chemicalId: item.chemical,
            LotNumber: item.LotNumber,
            countedQuantity: item.previousQuantity
          }))
        );
      }
    } catch (error) {
      console.error("Error generating cycle count:", error);
    } finally {
      setLoading(false);
    }
  }

  // Handler for when an input changes.
  const handleInputChange = (index, value) => {
    const newItems = [...updatedItems];
    newItems[index].countedQuantity = Number(value);
    setUpdatedItems(newItems);
  };

  // Handler for submitting the cycle count.
  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/cyclecount/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleCountId: cycleCount._id,
          updatedItems
        })
      });
      if (res.ok) {
        alert("Cycle count submitted successfully!");
        setCycleCount(null);
        setUpdatedItems([]);
      } else {
        alert("There was an error submitting the cycle count.");
      }
    } catch (error) {
      console.error("Error submitting cycle count:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto max-w-4xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl">Cycle Count</CardTitle>
        </CardHeader>

        {loading && <p>Loading...</p>}
        {!loading && !cycleCount && (
          <div className="px-4">
            <Button
              className="mb-4"
              onClick={handleGenerate}
            >
              Generate Cycle Count
            </Button>
          </div>

        )}

        {!loading && cycleCount && (
          <CardContent variant="outlined" sx={{ bgcolor: "#E8E8E8" }}>
            <form onSubmit={handleSubmit}>
              <table border="1" cellPadding="8">
                <thead>
                  <tr>
                    <th>Chemical</th>
                    <th>Lot Number</th>
                    <th>Previous Quantity</th>
                    <th>Counted Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleCount.items.map((item, index) => (
                    <tr key={item._id || index}>
                      <td>{item.ChemicalName}</td>
                      <td>{item.LotNumber}</td>
                      <td>{item.previousQuantity}</td>
                      <td>
                        <input
                          type="number"
                          value={updatedItems[index]?.countedQuantity}
                          onChange={(e) =>
                            handleInputChange(index, e.target.value)
                          }
                          required
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <br />
              <button type="submit">Submit Cycle Count</button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>

  );
}
