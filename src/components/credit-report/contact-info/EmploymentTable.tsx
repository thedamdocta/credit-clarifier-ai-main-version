
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmploymentInfo } from "@/lib/ai/contactInfoExtraction";

interface EmploymentTableProps {
  employments: EmploymentInfo[];
  isLoading?: boolean;
}

const EmploymentTable: React.FC<EmploymentTableProps> = ({ employments, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Loading employment information...
      </div>
    );
  }

  if (!employments || employments.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No employment information available
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Company</TableHead>
            <TableHead>Occupation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employments.map((employment, index) => (
            <TableRow key={`employment-${index}`}>
              <TableCell className="font-medium">{employment.company}</TableCell>
              <TableCell>{employment.occupation}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EmploymentTable;
