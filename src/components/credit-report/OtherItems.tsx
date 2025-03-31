
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import OtherItemsHeader from "./other-items/OtherItemsHeader";
import OtherItemsTable from "./other-items/OtherItemsTable";

interface OtherItemsProps {
  report: CreditReport;
}

const OtherItems: React.FC<OtherItemsProps> = ({ report }) => {
  return (
    <Card>
      <CardHeader>
        <OtherItemsHeader />
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes your Personal Information and, if applicable, Consumer Statements, and could include other items that may affect your credit score and rating.</p>
        
        <OtherItemsTable report={report} />
      </CardContent>
    </Card>
  );
};

export default OtherItems;
