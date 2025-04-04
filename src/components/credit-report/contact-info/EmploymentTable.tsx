
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Employment {
  company: string | null;
  occupation: string | null;
}

interface EmploymentTableProps {
  employments: Employment[];
}

const EmploymentTable: React.FC<EmploymentTableProps> = ({ employments }) => {
  // If there are no employments, display a default row with "Not Reported" values
  const displayEmployments = employments.length > 0 
    ? employments 
    : [{ company: null, occupation: null }];

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50%]">Company</TableHead>
            <TableHead className="w-[50%]">Occupation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayEmployments.map((employment, index) => (
            <TableRow key={index}>
              <TableCell>{employment.company || "Not Reported"}</TableCell>
              <TableCell>{employment.occupation || "Not Reported"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EmploymentTable;
