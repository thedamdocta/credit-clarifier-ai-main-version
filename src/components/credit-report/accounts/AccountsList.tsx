
import React from "react";
import { Account } from "@/lib/types/creditReport";
import AccountItem from "./AccountItem";

interface AccountsListProps {
  accounts: Account[];
  sourceSessionId?: string | null;
}

const AccountsList: React.FC<AccountsListProps> = ({ accounts, sourceSessionId }) => {
  if (!accounts || accounts.length === 0) {
    return (
      <div className="text-center p-8 border rounded-md">
        <p className="text-muted-foreground">No account information found in this credit report.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accounts.map((account, index) => (
        <AccountItem 
          key={`account-${account.accountName || "unknown"}-${account.accountNumber || "unknown"}-${index}`} 
          account={account}
          sourceSessionId={sourceSessionId}
        />
      ))}
    </div>
  );
};

export default AccountsList;
