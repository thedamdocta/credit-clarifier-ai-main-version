
import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import { extractAccounts } from "@/lib/parsers/accountsParser";
import AccountDetailsList from './accounts/AccountDetailsList';

interface AccountsDetailViewProps {
  report: CreditReport;
}

const AccountsDetailView: React.FC<AccountsDetailViewProps> = ({ report }) => {
  // Extract or use existing accounts
  const accounts = React.useMemo(() => {
    if (report?.accounts?.length > 0) {
      return report.accounts;
    } else if (report?.rawText) {
      // Extract accounts from the raw text if not already available
      console.log("Extracting accounts from raw text");
      return extractAccounts(report.rawText);
    }
    return [];
  }, [report]);

  return (
    <Card>
      <CardHeader className="pb-0">
        {/* Header content is handled by AccountDetailsList */}
      </CardHeader>
      <CardContent>
        <AccountDetailsList accounts={accounts} />
      </CardContent>
    </Card>
  );
};

export default AccountsDetailView;
