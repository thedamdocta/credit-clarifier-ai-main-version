
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface AccountDetailsProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountDetails: React.FC<AccountDetailsProps> = ({ account, showDebugInfo }) => {
  // Account details fields with their labels and values
  const detailFields = [
    { label: "High Credit", value: "Not reported" },
    { label: "Credit Limit", value: "Not reported" },
    { label: "Terms Frequency", value: "Not reported" },
    { label: "Balance", value: account.balance ? formatDollarAmount(account.balance) : "Not reported" },
    { label: "Amount Past Due", value: "Not reported" },
    { label: "Actual Payment Amount", value: "Not reported" },
    { label: "Date of Last Activity", value: "Not reported" },
    { label: "Months Reviewed", value: "Not reported" },
    { label: "Activity Designator", value: "Not reported" },
    { label: "Deferred Payment Start Date", value: "Not reported" },
    { label: "Payment Responsibility", value: "Not reported" },
    { label: "Account Type", value: account.accountType ? account.accountType : "Not reported" },
    { label: "Term Duration", value: "Not reported" },
    { label: "Date Opened", value: account.openDate ? account.openDate : "Not reported" },
    { label: "Date Reported", value: "Not reported" },
    { label: "Date of Last Payment", value: "Not reported" },
    { label: "Scheduled Payment Amount", value: "Not reported" },
    { label: "Delinquency First Reported", value: "Not reported" },
    { label: "Creditor Classification", value: "Not reported" },
    { label: "Charge Off Amount", value: "Not reported" },
    { label: "Balloon Payment Date", value: "Not reported" },
    { label: "Balloon Payment Amount", value: "Not reported" },
    { label: "Loan Type", value: "Not reported" },
    { label: "Date Closed", value: "Not reported" },
    { label: "Date of First Delinquency", value: "Not reported" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {detailFields.map((field) => (
          <div 
            key={field.label} 
            className="bg-background p-3 rounded-md border"
          >
            <div className="text-xs text-muted-foreground mb-1">{field.label}</div>
            <div className="text-sm font-medium">{field.value}</div>
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

export default AccountDetails;
