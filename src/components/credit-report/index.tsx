
import React from 'react';
import { CreditReport } from '@/lib/types/creditReport';
import { Separator } from '@/components/ui/separator';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
      
      {/* Credit report content will be added here in future updates */}
      <Separator className="my-4" />
    </div>
  );
};

export default CreditReportComponent;
