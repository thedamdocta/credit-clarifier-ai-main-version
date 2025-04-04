
import React from "react";
import { HardInquiry } from "@/lib/types/creditReport";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Calendar } from "lucide-react";

interface HardInquiriesTableProps {
  inquiries: HardInquiry[];
}

const HardInquiriesTable: React.FC<HardInquiriesTableProps> = ({ inquiries }) => {
  if (inquiries.length === 0) {
    return (
      <div className="text-center p-8 border rounded-lg bg-muted/10">
        <p className="text-muted-foreground">No hard inquiries found in your report.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="w-[180px]">Company</TableHead>
            <TableHead>Request Originator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inquiries.map((inquiry, index) => (
            <TableRow key={`hard-inquiry-${index}`}>
              <TableCell className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {inquiry.date || "Not reported"}
              </TableCell>
              <TableCell className="font-medium">{inquiry.company || "Not reported"}</TableCell>
              <TableCell>{inquiry.requestOriginator || "Not reported"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default HardInquiriesTable;
