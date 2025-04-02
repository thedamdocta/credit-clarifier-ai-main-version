
import React from "react";
import CreditAccountsDebug from "./CreditAccountsDebug";
import { AccountSummary } from "@/lib/types/creditReport";

interface AccountsDebugInfoProps {
  accountSummaries: AccountSummary[];
  extractionAttempts: number;
  reportId: string | undefined;
  usingSampleData: boolean;
  tableImageUrl: string | null;
  extractionFailed: boolean;
  initialDataFound: boolean;
  rawTextLength: number;
}

const AccountsDebugInfo: React.FC<AccountsDebugInfoProps> = ({
  accountSummaries,
  extractionAttempts,
  reportId,
  usingSampleData,
  tableImageUrl,
  extractionFailed,
  initialDataFound,
  rawTextLength
}) => {
  return (
    <div className="mb-4 p-4 border rounded bg-slate-50">
      <p className="text-xs mb-2">Debug: Extraction attempts: {extractionAttempts}</p>
      <p className="text-xs mb-2">Report ID: {reportId || 'None'}</p>
      <p className="text-xs mb-2">Using sample data: {usingSampleData ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Uploaded image found: {tableImageUrl ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Extraction failed: {extractionFailed ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Initial data found: {initialDataFound ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Raw text length: {rawTextLength} characters</p>
      <CreditAccountsDebug 
        accountSummaries={accountSummaries} 
        tableImageUrl={tableImageUrl}
      />
    </div>
  );
};

export default AccountsDebugInfo;
