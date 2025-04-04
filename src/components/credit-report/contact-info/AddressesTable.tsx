
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Address {
  address: string | null;
  status: string | null;
  dateReported: string | null;
}

interface AddressesTableProps {
  addresses: Address[];
}

const AddressesTable: React.FC<AddressesTableProps> = ({ addresses }) => {
  // If there are no addresses, display a default row with "-" values
  const displayAddresses = addresses.length > 0 
    ? addresses 
    : [{ address: null, status: null, dateReported: null }];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">Address</TableHead>
            <TableHead className="w-[25%]">Status</TableHead>
            <TableHead className="w-[25%]">Date Reported</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayAddresses.map((address, index) => (
            <TableRow key={index}>
              <TableCell>{address.address || "-"}</TableCell>
              <TableCell>{address.status || "-"}</TableCell>
              <TableCell>{address.dateReported || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AddressesTable;
