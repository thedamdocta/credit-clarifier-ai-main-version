
import React from "react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import { Loader2 } from "lucide-react";
import CreditAccountsDebug from "./CreditAccountsDebug";

interface AccountDataDebugProps {
  showDebugInfo: boolean;
  report: CreditReport;
  extractionAttempts: number;
  usingSampleData: boolean;
  tableImageUrl: string | null;
  extractionFailed: boolean;
  initialAccountDataFound: boolean;
  accountSummaries: AccountSummary[];
  isProcessing: boolean;
}

const AccountDataDebug: React.FC<AccountDataDebugProps> = ({
  showDebugInfo,
  report,
  extractionAttempts,
  usingSampleData,
  tableImageUrl,
  extractionFailed,
  initialAccountDataFound,
  accountSummaries,
  isProcessing
}) => {
  if (!showDebugInfo) return null;
  
  if (isProcessing) {
    return (
      <div className="py-8 flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 text-muted-foreground mb-4 animate-spin" />
        <p className="text-muted-foreground">Extracting account data...</p>
      </div>
    );
  }
  
  return (
    <div className="mb-4 p-4 border rounded bg-slate-50">
      <p className="text-xs mb-2">Debug: Extraction attempts: {extractionAttempts}</p>
      <p className="text-xs mb-2">Report ID: {report.reportId || 'None'}</p>
      <p className="text-xs mb-2">Using sample data: {usingSampleData ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Uploaded image found: {tableImageUrl ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Extraction failed: {extractionFailed ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Initial data found: {initialAccountDataFound ? 'Yes' : 'No'}</p>
      <p className="text-xs mb-2">Raw text length: {report.rawText ? report.rawText.length : 0} characters</p>
      <CreditAccountsDebug accountSummaries={accountSummaries} />
    </div>
  );
};

export default AccountDataDebug;
