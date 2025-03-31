
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { CreditReport } from "@/lib/creditReportParser";

interface OtherItemsProps {
  report: CreditReport;
}

const OtherItems: React.FC<OtherItemsProps> = ({ report }) => {
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
            <span className="font-medium">Collections</span>
            <span className="text-muted-foreground">
              {report.collectionCount !== undefined ? `${report.collectionCount} Records Found` : "Not Available"}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Public Records</span>
            <span className="text-muted-foreground">
              {report.publicRecordCount !== undefined ? `${report.publicRecordCount} Records Found` : "Not Available"}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Credit Inquiries</span>
            <span className="text-muted-foreground">
              {report.inquiryCount !== undefined ? `${report.inquiryCount} Records Found` : "Not Available"}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Most Recent Inquiry</span>
            <span className="text-muted-foreground">{report.recentInquiry || "Not Available"}</span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Personal Information</span>
            <span className="text-muted-foreground">
              {report.personalInfoItemCount !== undefined ? `${report.personalInfoItemCount} Items Found` : "Not Available"}
            </span>
          </div>
          
          <div className="flex justify-between items-center border-b pb-2">
            <span className="font-medium">Statement</span>
            <span className="text-muted-foreground">{report.statementCount !== undefined ? `${report.statementCount} Records Found` : "0 Records Found"}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OtherItems;
