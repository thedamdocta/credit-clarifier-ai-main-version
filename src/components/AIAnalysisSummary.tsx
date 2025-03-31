
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import { AlertCircle } from "lucide-react";

interface AIAnalysisSummaryProps {
  report: CreditReport;
}

const AIAnalysisSummary: React.FC<AIAnalysisSummaryProps> = ({ report }) => {
  return (
    <Card className="mt-8 border-dashed border-yellow-500">
      <CardHeader className="bg-yellow-50">
        <CardTitle className="flex items-center text-yellow-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          AI Analysis Debug Summary
        </CardTitle>
        <CardDescription className="text-yellow-600">
          This is a temporary display to troubleshoot AI detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-4">
          <div>
            <h3 className="font-medium mb-1">Detected Bureau</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm">{report.bureau}</pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">Detected Report Date</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm">{report.reportDate}</pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">Detected Personal Information</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
              {JSON.stringify(report.personalInfo, null, 2)}
            </pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">Detected Credit Scores</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
              {JSON.stringify(report.creditScores, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-medium mb-1">Number of Accounts Detected</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm">{report.accounts.length}</pre>
            {report.accounts.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium">First Account Sample</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
                  {JSON.stringify(report.accounts[0], null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAnalysisSummary;
