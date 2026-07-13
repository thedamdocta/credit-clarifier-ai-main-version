
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import OtherItemsHeader from "./other-items/OtherItemsHeader";
import OtherItemsTable from "./other-items/OtherItemsTable";
import ExtractedSourceTabs from "./source/ExtractedSourceTabs";

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
        <ExtractedSourceTabs
          sessionId={report.sourceSessionId}
          pageNumbers={report.sourceComponents?.otherItemsSummary?.pages}
          sourceTitle="Other Items Source Pages"
          tabsClassName="mb-4"
        >
          <>
            <p className="mb-4">Your credit report includes your Personal Information and, if applicable, Consumer Statements, and could include other items that may affect your credit score and rating.</p>
            
            <OtherItemsTable report={report} />
          </>
        </ExtractedSourceTabs>
      </CardContent>
    </Card>
  );
};

export default OtherItems;
