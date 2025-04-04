
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
      <div className="text-sm text-muted-foreground text-center py-4">
        Loading address information...
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No address information available
      </div>
    );
  }

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
          {addresses.map((address, index) => (
            <TableRow key={`address-${index}`}>
              <TableCell className="font-medium">{address.address}</TableCell>
              <TableCell>{address.status}</TableCell>
              <TableCell>{address.dateReported}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AddressesTable;
