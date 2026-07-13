
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import AccountHeader from "./AccountHeader";
import AccountsList from "./AccountsList";
import ExtractedSourceTabs from "../source/ExtractedSourceTabs";

interface AccountsComponentProps {
  report: CreditReport;
}

const AccountsComponent: React.FC<AccountsComponentProps> = ({ report }) => {
  const accounts = Array.isArray(report.accounts) ? report.accounts : [];

  return (
    <Card>
      <CardHeader>
        <AccountHeader />
      </CardHeader>
      <CardContent>
        <ExtractedSourceTabs
          sessionId={report.sourceSessionId}
          pageNumbers={report.sourceComponents?.accounts?.pages}
          sourceTitle="Accounts Source Pages"
          sourceDescription="These report pages support the extracted account section. Some pages may be reused by more than one account or component."
          tabsClassName="mb-4"
        >
          <>
            <p className="mb-4">
              This section shows all accounts found in your credit report, including payment history and account details.
            </p>
            <AccountsList accounts={accounts} sourceSessionId={report.sourceSessionId} />
          </>
        </ExtractedSourceTabs>
      </CardContent>
    </Card>
  );
};

export default AccountsComponent;
