
import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collection } from "@/lib/types/creditReport";

interface CollectionsTableProps {
  collections: Collection[];
}

const CollectionsTable: React.FC<CollectionsTableProps> = ({ collections }) => {
  if (!collections || collections.length === 0) {
    return null;
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Collection Agency</TableHead>
            <TableHead>Original Creditor</TableHead>
            <TableHead>Account Number</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {collections.map((collection, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium">{collection.collectionAgency || 'N/A'}</TableCell>
              <TableCell>{collection.originalCreditorName || 'N/A'}</TableCell>
              <TableCell>{collection.accountNumber || 'N/A'}</TableCell>
              <TableCell className="text-right">{collection.amount || '$0'}</TableCell>
              <TableCell>
                <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                  {collection.status || 'Collection'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CollectionsTable;
