
import React from 'react';
import { CreditReport } from '@/lib/types/creditReport';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CreditReportComponentProps {
  report: CreditReport;
}

const CreditReportComponent: React.FC<CreditReportComponentProps> = ({ report }) => {
  return (
    <div className="space-y-6">
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
