
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
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Company</TableHead>
              <TableHead>Occupation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} className="text-center py-8">
                <div className="text-sm text-muted-foreground">
                  Loading employment information...
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
            <TableHead>Company</TableHead>
            <TableHead>Occupation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employments.length > 0 ? (
            employments.map((employment, index) => (
              <TableRow key={`employment-${index}`}>
                <TableCell className="font-medium">{employment.company}</TableCell>
                <TableCell>{employment.occupation}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={2} className="text-center py-8">
                <div className="text-sm text-muted-foreground">
                  No employment information found in the report
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default EmploymentTable;
