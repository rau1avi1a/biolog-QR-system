// app/chemicals/[id]/page.jsx
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft } from "lucide-react";
import { formatDistance } from 'date-fns';
import ChemicalAuditTable from "@/components/ChemicalAuditTable"

export default function ChemicalDetail() {
  const router = useRouter();
  const params = useParams();
  const [chemical, setChemical] = React.useState(null);
  const [auditHistory, setAuditHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      if (!params?.id) return;
      
      try {
        // Fetch chemical details
        const chemResponse = await fetch(`/api/chemicals/${params.id}`);
        if (!chemResponse.ok) throw new Error("Failed to fetch chemical");
        const chemData = await chemResponse.json();
        setChemical(chemData);

        // Fetch audit history
        const auditResponse = await fetch(`/api/chemicals/${params.id}/audit`);
        if (auditResponse.ok) {
          const auditData = await auditResponse.json();
          setAuditHistory(auditData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [params?.id]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          Loading...
        </div>
      </div>
    );
  }

  if (!chemical) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[400px]">
          Chemical not found
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <Button
        variant="outline"
        className="mb-4"
        onClick={() => router.push(`/`)}
      >
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid gap-6">
{/* Previous imports remain the same */}

        <Card>
          <CardHeader>
            <CardTitle>Chemical Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2">
              <div>
                <dt className="font-semibold">Biolog Number</dt>
                <dd>{chemical.BiologNumber}</dd>
              </div>
              <div>
                <dt className="font-semibold">Chemical Name</dt>
                <dd>{chemical.ChemicalName}</dd>
              </div>
              <div>
                <dt className="font-semibold">CAS Number</dt>
                <dd>{chemical.CASNumber || "N/A"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Location</dt>
                <dd>{chemical.Location || "N/A"}</dd>
              </div>
              <div>
                <dt className="font-semibold">Total Quantity</dt>
                <dd>{chemical.totalQuantity}</dd>
              </div>
              <div>
                <dt className="font-semibold">Status</dt>
                <dd className={chemical.totalQuantity > 0 ? "text-green-600" : "text-red-600"}>
                  {chemical.totalQuantity > 0 ? "Available" : "Out of Stock"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Update the Lots table section */}
        <Card>
          <CardHeader>
            <CardTitle>Current Lots</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot Number</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chemical.Lots.map((lot) => (
                  <TableRow key={lot._id || lot.LotNumber}>
                    <TableCell>{lot.LotNumber}</TableCell>
                    <TableCell>{lot.Quantity}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/chemicals/${chemical._id}/lots/${lot._id}`)}
                      >
                        View Lot Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ChemicalAuditTable auditHistory={auditHistory}></ChemicalAuditTable>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}