
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddressInfo } from "@/lib/ai/contactInfoExtraction";

interface AddressesTableProps {
  addresses: AddressInfo[];
  isLoading?: boolean;
}

const AddressesTable: React.FC<AddressesTableProps> = ({ addresses, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Reported</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8">
                <div className="text-sm text-muted-foreground">
                  Loading address information...
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  // Always render the table with or without data
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Address</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date Reported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {addresses.length > 0 ? (
            addresses.map((address, index) => (
              <TableRow key={`address-${index}`}>
                <TableCell className="font-medium">{address.address}</TableCell>
                <TableCell>{address.status}</TableCell>
                <TableCell>{address.dateReported}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="text-center py-8">
                <div className="text-sm text-muted-foreground">
                  No address information found in the report
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AddressesTable;
