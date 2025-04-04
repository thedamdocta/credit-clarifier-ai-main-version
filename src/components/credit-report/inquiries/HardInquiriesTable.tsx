
import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Inquiry } from "@/lib/types/creditReport";

interface HardInquiriesTableProps {
  inquiries: Inquiry[];
}

const HardInquiriesTable: React.FC<HardInquiriesTableProps> = ({ inquiries }) => {
  if (inquiries.length === 0) {
    return (
      <div className="text-center py-8 border rounded-md bg-gray-50">
        <p className="text-muted-foreground">No hard inquiries found in your credit report.</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead>Company</TableHead>
            <TableHead className="hidden md:table-cell">Request Originator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry, index) => (
            <TableRow key={`hard-inquiry-${index}`}>
              <TableCell className="font-medium">{inquiry.date || 'Unknown'}</TableCell>
              <TableCell>{inquiry.company || 'Unknown'}</TableCell>
              <TableCell className="hidden md:table-cell">{inquiry.requestor || 'Unknown'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default HardInquiriesTable;
