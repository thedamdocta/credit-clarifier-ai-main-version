
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

interface OtherItemsProps {
  report: CreditReport;
}

const OtherItems: React.FC<OtherItemsProps> = ({ report }) => {
  // Format display text for counts based on value
  const formatCountDisplay = (count: number | undefined, itemType: string): string => {
    if (count === undefined) return "Not Available";
    
    // Handle singular vs plural for different item types
    if (itemType === "Statement") {
      return count === 1 ? `${count} Statement Found` : `${count} Statements Found`;
    } else if (itemType === "Collection") {
      return count === 1 ? `${count} Collection Found` : `${count} Collections Found`;
    } else if (itemType === "Item") {
      return count === 1 ? `${count} Item Found` : `${count} Items Found`;
    } else if (itemType === "Inquiry") {
      return count === 1 ? `${count} Inquiry Found` : `${count} Inquiries Found`;
    }
    
    // Default format for other types
    return count === 1 ? `${count} Record Found` : `${count} Records Found`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          Other Items
        </CardTitle>
        <CardDescription>Additional information in your credit file</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes your Personal Information and, if applicable, Consumer Statements, and could include other items that may affect your credit score and rating.</p>
        
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Consumer Statements</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCountDisplay(report.statementCount, "Statement")}
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Personal Information</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCountDisplay(report.personalInfoItemCount, "Item")}
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Inquiries</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCountDisplay(report.inquiryCount, "Inquiry")}
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium w-1/2">Most Recent Inquiry</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {report.recentInquiry || "Not Available"}
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Public Records</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCountDisplay(report.publicRecordCount, "Record")}
              </TableCell>
            </TableRow>
            
            <TableRow>
              <TableCell className="font-medium">Collections</TableCell>
              <TableCell className="text-right text-muted-foreground">
                {formatCountDisplay(report.collectionCount, "Collection")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default OtherItems;
