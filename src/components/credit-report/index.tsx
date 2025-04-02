
import React from 'react';
import { CreditReport } from '@/lib/types/creditReport';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CreditReportComponentProps {
  report: CreditReport;
}

const CreditReportComponent: React.FC<CreditReportComponentProps> = ({ report }) => {
  // Check if the report is very large and might cause performance issues
  const isLargeReport = report.rawText && report.rawText.length > 200000;
  
  return (
    <div className="space-y-6">
      {isLargeReport && (
        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Large Report Detected</AlertTitle>
          <AlertDescription>
            This credit report is very large and might take longer to process. 
            Some features may be limited for better performance.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Credit Report Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Report from: {report.bureau}</p>
          <p>Date: {report.reportDate}</p>
          <p>Accounts: {report.accounts.length}</p>
        </CardContent>
      </Card>
      <Separator className="my-4" />
    </div>
  );
};

export default CreditReportComponent;
