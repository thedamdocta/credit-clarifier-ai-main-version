
import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collection } from "@/lib/types/creditReport";

interface CollectionsTableProps {
  collections: Collection[];
}

const CollectionsTable: React.FC<CollectionsTableProps> = ({ collections }) => {
  const [activeTab, setActiveTab] = useState("details");

  // Helper function to render a table cell with a value or "-" if null/empty
  const renderValue = (value: any) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return value;
  };

  // Get status badge based on status text
  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">-</Badge>;

    const statusLower = status.toLowerCase();
    if (statusLower.includes("paid")) {
      return <Badge className="bg-green-500 text-white">Paid</Badge>;
    } else if (statusLower.includes("collection")) {
      return <Badge variant="destructive">Collection</Badge>;
    } else {
      return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div>
      {collections.map((collection, index) => (
        <div key={index} className="mb-6 border rounded-lg overflow-hidden">
          <div className="p-4 bg-muted/30">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex-grow">
                <h3 className="text-lg font-medium">{renderValue(collection.collectionAgency)}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm text-muted-foreground">
                  <div>Account #: {renderValue(collection.accountNumber)}</div>
                  <div>Original Creditor: {renderValue(collection.originalCreditorName)}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {getStatusBadge(collection.status)}
                <div className="text-sm text-muted-foreground">
                  Reported: {renderValue(collection.dateReported)}
                </div>
              </div>
            </div>
          </div>

          <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b px-4">
              <TabsList className="bg-transparent border-b-0 h-10">
                <TabsTrigger value="details" className="data-[state=active]:border-b-2">
                  Details
                </TabsTrigger>
                <TabsTrigger value="comments" className="data-[state=active]:border-b-2">
                  Comments & Contact
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="details" className="p-0 border-0">
              <div className="p-4">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Date Reported</TableCell>
                      <TableCell>{renderValue(collection.dateReported)}</TableCell>
                      <TableCell className="font-medium">Original Amount</TableCell>
                      <TableCell>{renderValue(collection.originalAmountOwed)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Balance Date</TableCell>
                      <TableCell>{renderValue(collection.balanceDate)}</TableCell>
                      <TableCell className="font-medium">Current Amount</TableCell>
                      <TableCell>{renderValue(collection.amount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Date Assigned</TableCell>
                      <TableCell>{renderValue(collection.dateAssigned)}</TableCell>
                      <TableCell className="font-medium">Last Payment Date</TableCell>
                      <TableCell>{renderValue(collection.lastPaymentDate)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Status Date</TableCell>
                      <TableCell>{renderValue(collection.statusDate)}</TableCell>
                      <TableCell className="font-medium">First Delinquency</TableCell>
                      <TableCell>{renderValue(collection.dateOfFirstDelinquency)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Account Designator</TableCell>
                      <TableCell>{renderValue(collection.accountDesignatorCode)}</TableCell>
                      <TableCell className="font-medium">Creditor Classification</TableCell>
                      <TableCell>{renderValue(collection.creditorClassification)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="comments" className="p-0 border-0">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-2">Comments</h4>
                  <p className="text-sm text-muted-foreground">
                    {collection.comments ? collection.comments : "No comments available"}
                  </p>
                </div>
                <div className="border rounded-md p-4">
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <p className="text-sm text-muted-foreground">
                    {collection.contact ? collection.contact : "No contact information available"}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ))}
    </div>
  );
};

export default CollectionsTable;
