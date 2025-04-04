
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
  // Default data when no inquiries are present
  const defaultData = [
    { date: null, company: null, requestor: null },
    { date: null, company: null, requestor: null }
  ];

  // Use the provided inquiries if available, otherwise use default data
  const tableData = inquiries.length > 0 ? inquiries : defaultData;
  
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
          {tableData.map((inquiry, index) => (
            <TableRow key={`hard-inquiry-${index}`}>
              <TableCell className="font-medium">{inquiry.date || '-'}</TableCell>
              <TableCell>{inquiry.company || '-'}</TableCell>
              <TableCell className="hidden md:table-cell">{inquiry.requestor || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default HardInquiriesTable;
