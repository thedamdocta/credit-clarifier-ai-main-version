
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";

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
        
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Consumer Statements</span>
            <span className="text-muted-foreground">
              {formatCountDisplay(report.statementCount, "Statement")}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Personal Information</span>
            <span className="text-muted-foreground">
              {formatCountDisplay(report.personalInfoItemCount, "Item")}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Inquiries</span>
            <span className="text-muted-foreground">
              {formatCountDisplay(report.inquiryCount, "Inquiry")}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Most Recent Inquiry</span>
            <span className="text-muted-foreground">{report.recentInquiry || "Not Available"}</span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Public Records</span>
            <span className="text-muted-foreground">
              {formatCountDisplay(report.publicRecordCount, "Record")}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Collections</span>
            <span className="text-muted-foreground">
              {formatCountDisplay(report.collectionCount, "Collection")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OtherItems;
