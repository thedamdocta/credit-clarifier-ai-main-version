import React from 'react';
import NewCreditAccounts from './NewCreditAccounts';
import { CreditReport } from '@/lib/types/creditReport';

interface CreditReportComponentProps {
  report: CreditReport;
}

const CreditReportComponent: React.FC<CreditReportComponentProps> = ({ report }) => {
  return (
    <div className="space-y-6">
      <NewCreditAccounts reportId={report.reportId} />
      {/* Other credit report components can go here */}
    </div>
  );
};

export default CreditReportComponent;
