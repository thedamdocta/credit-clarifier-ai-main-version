
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import { extractAccounts } from "@/lib/parsers/accountsParser";
import AccountDetailsList from './accounts/AccountDetailsList';

interface CreditAccountsProps {
  report: CreditReport;
}

const CreditAccounts: React.FC<CreditAccountsProps> = ({ report }) => {
  // Extract or use existing accounts
  const accounts = React.useMemo(() => {
    if (report?.accounts?.length > 0) {
      console.log("Using existing accounts from report:", report.accounts.length);
      return report.accounts;
    } else if (report?.rawText) {
      // Extract accounts from the raw text if not already available
      console.log("Extracting accounts from raw text");
      return extractAccounts(report.rawText);
    }
    console.log("No accounts or raw text available");
    return [];
  }, [report]);

  console.log(`Retrieved ${accounts.length} credit accounts for display`);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          Credit Accounts
        </CardTitle>
        <CardDescription>
          Detailed information about each account in your credit report
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AccountDetailsList accounts={accounts} />
      </CardContent>
    </Card>
  );
};

export default CreditAccounts;
