
import React, { useMemo } from "react";
import { Account } from "@/lib/types/creditReport";
import {
  formatDollarAmount,
  humanizeExtractedText,
  isNotReportedValue,
} from "@/utils/formatters/accountValueFormatters";

interface AccountDetailsProps {
  account: Account;
  showDebugInfo: boolean;
}

const hasOwnField = (value: unknown, key: string) =>
  Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.prototype.hasOwnProperty.call(value, key));

const MissingFieldValue: React.FC = () => <span className="text-sm font-medium text-red-600">Missing</span>;

const AccountDetails: React.FC<AccountDetailsProps> = ({ account, showDebugInfo }) => {
  const normalizeValue = (value?: string | null): string => {
    if (!value) return "Not reported";
    const trimmed = humanizeExtractedText(value).trim();
    if (trimmed.length === 0 || trimmed.toLowerCase() === "not reported") {
      return "Not reported";
    }
    return trimmed;
  };

  const normalizeCurrency = (value?: string | null): string => {
    const normalized = normalizeValue(value);
    if (normalized === "Not reported") {
      return normalized;
    }
    return formatDollarAmount(normalized);
  };

  const detailFields = useMemo(
    () => [
      { label: "Account Type", value: normalizeValue(account.accountType) },
      { label: "Account Category", value: normalizeValue(account.accountCategory) },
      { label: "Account Ownership", value: normalizeValue(account.accountOwnership) },
      { label: "Account Status", value: normalizeValue(account.accountStatus ?? account.status) },
      { label: "High Credit", value: normalizeCurrency(account.highCredit) },
      { label: "Credit Limit", value: normalizeCurrency(account.creditLimit) },
      { label: "Current Balance", value: normalizeCurrency(account.currentBalance ?? account.balance) },
      { label: "Amount Past Due", value: normalizeCurrency(account.amountPastDue) },
      { label: "Charge Off Amount", value: normalizeCurrency(account.chargeOffAmount) },
      { label: "Actual Payment Amount", value: normalizeCurrency(account.actualPaymentAmount) },
      { label: "Scheduled Payment Amount", value: normalizeCurrency(account.scheduledPaymentAmount) },
      { label: "Payment Amount", value: normalizeCurrency(account.paymentAmount) },
      { label: "Balloon Payment Amount", value: normalizeCurrency(account.balloonPaymentAmount) },
      { label: "Credit Type", value: normalizeValue(account.creditType) },
      { label: "Loan Type", value: normalizeValue(account.loanType) },
      { label: "Terms Frequency", value: normalizeValue(account.termsFrequency) },
      { label: "Term Duration", value: normalizeValue(account.termDuration) },
      { label: "Months Reviewed", value: normalizeValue(account.monthsReviewed) },
      { label: "Payment Responsibility", value: normalizeValue(account.paymentResponsibility ?? account.responsibility) },
      { label: "Activity Designator", value: normalizeValue(account.activityDesignator) },
      { label: "Deferred Payment Start Date", value: normalizeValue(account.deferredPaymentStartDate) },
      { label: "Balloon Payment Date", value: normalizeValue(account.balloonPaymentDate) },
      { label: "Date Opened", value: normalizeValue(account.dateOpened ?? account.openDate) },
      { label: "Date Closed", value: normalizeValue(account.dateClosed) },
      { label: "Date Reported", value: normalizeValue(account.dateReported) },
      { label: "Last Payment Date", value: normalizeValue(account.lastPaymentDate) },
      { label: "Date of Last Activity", value: normalizeValue(account.dateOfLastActivity) },
      { label: "Date of First Delinquency", value: normalizeValue(account.dateOfFirstDelinquency) },
      { label: "Delinquency First Reported", value: normalizeValue(account.delinquencyFirstReported) },
      { label: "Creditor Classification", value: normalizeValue(account.creditorClassification) }
    ],
    [
      account.accountType,
      account.accountCategory,
      account.accountOwnership,
      account.status,
      account.highCredit,
      account.creditLimit,
      account.currentBalance,
      account.balance,
      account.amountPastDue,
      account.chargeOffAmount,
      account.actualPaymentAmount,
      account.scheduledPaymentAmount,
      account.paymentAmount,
      account.balloonPaymentAmount,
      account.creditType,
      account.loanType,
      account.termsFrequency,
      account.termDuration,
      account.monthsReviewed,
      account.paymentResponsibility,
      account.responsibility,
      account.activityDesignator,
      account.deferredPaymentStartDate,
      account.balloonPaymentDate,
      account.dateOpened,
      account.openDate,
      account.dateClosed,
      account.dateReported,
      account.lastPaymentDate,
      account.dateOfLastActivity,
      account.dateOfFirstDelinquency,
      account.delinquencyFirstReported,
      account.creditorClassification,
      account.accountStatus
    ]
  );

  const hasCurrentBalanceField = hasOwnField(account, "currentBalance") || hasOwnField(account, "balance");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {detailFields.map((field) => (
          <div 
            key={field.label} 
            className="bg-background p-3 rounded-md border"
          >
            <div className="text-xs text-muted-foreground mb-1">{field.label}</div>
            {field.label === "Current Balance" && !hasCurrentBalanceField ? (
              <MissingFieldValue />
            ) : (
              <div
                className={
                  isNotReportedValue(field.value)
                    ? "text-sm font-normal text-slate-400"
                    : "text-sm font-medium"
                }
              >
                {field.value}
              </div>
            )}
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
