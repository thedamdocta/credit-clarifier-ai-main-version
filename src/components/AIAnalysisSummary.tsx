
import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import AIAnalysisHeader from "./ai-analysis/AIAnalysisHeader";
import AIAnalysisContent from "./ai-analysis/AIAnalysisContent";

interface AIAnalysisSummaryProps {
  report: CreditReport;
}

const AIAnalysisSummary: React.FC<AIAnalysisSummaryProps> = ({ report }) => {
  return (
    <Card className="mt-8 border-dashed border-yellow-500">
      <CardHeader className="bg-yellow-50">
        <AIAnalysisHeader />
      </CardHeader>
      <AIAnalysisContent report={report} />
    </Card>
  );
};

export default AIAnalysisSummary;
