
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface AccountSummaryProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountSummary: React.FC<AccountSummaryProps> = ({ account, showDebugInfo }) => {
  // Extract key summary fields
  const summaryFields = [
    { label: "Account Number", value: account.accountNumber || "Unknown" },
    { label: "Reported Balance", value: account.balance ? formatDollarAmount(account.balance) : "Not reported" },
    { label: "Account Status", value: account.status || "Unknown" },
    { label: "Open Date", value: account.openDate || "Not reported" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaryFields.map((field) => (
          <div 
            key={field.label} 
            className="bg-background p-4 rounded-md border"
          >
            <div className="text-sm font-medium text-muted-foreground mb-1">{field.label}</div>
            <div className="font-semibold">{field.value}</div>
          </div>
        ))}
      </div>
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(account, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountSummary;
