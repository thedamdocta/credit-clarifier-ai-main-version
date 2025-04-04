
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface AccountDetailsProps {
  account: Account;
  showDebugInfo?: boolean;
}

const AccountDetails: React.FC<AccountDetailsProps> = ({ account, showDebugInfo }) => {
  // Format balance for display
  const formattedBalance = account.balance !== null 
    ? formatDollarAmount(account.balance) 
    : "Not reported";
  
  // Format the account number with masking if present
  const formatAccountNumber = (accountNumber: string) => {
    if (!accountNumber || accountNumber.toLowerCase() === "not reported") {
      return "Not reported";
    }
    
    // If the account number is longer than 4 characters, mask all but the last 4
    if (accountNumber.length > 4) {
      return "XXXX-XXXX-" + accountNumber.slice(-4);
    }
    
    return accountNumber;
  };

  // Fix the type comparison by converting both to strings for comparison
  const isZeroBalance = account.balance === 0 || (account.balance !== null && account.balance.toString() === "0") || account.balance === null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      <div>
        <p className="text-sm text-muted-foreground">Account Number</p>
        <p className="font-medium">{formatAccountNumber(account.accountNumber)}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Account Type</p>
        <p className="font-medium">{account.accountType || "Not reported"}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Open Date</p>
        <p className="font-medium">{account.openDate || "Not reported"}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Status</p>
        <p className="font-medium">{account.status || "Not reported"}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Balance</p>
        <p className={`font-medium ${isZeroBalance ? "" : "text-credit-blue"}`}>
          {formattedBalance}
        </p>
      </div>
    </div>
  );
};

export default AccountDetails;
