
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsDebug from "./accounts/CreditAccountsDebug";
import CreditAccountsTable from "./accounts/CreditAccountsTable";

interface SummaryProps {
  report: CreditReport;
}

const Summary: React.FC<SummaryProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = React.useState(false);
  
  // Required account types in order
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Create properly ordered account summaries with empty values for missing types
  const accountSummaries: AccountSummary[] = [];
  
  // First create a map of existing account summaries by type
  const summariesByType = new Map<string, AccountSummary>();
  
  // Log what we're receiving for debugging
  console.log('Summary component received report with account summaries:', 
    report.accountSummaries ? report.accountSummaries.length : 0);
  
  if (report.accountSummaries && report.accountSummaries.length > 0) {
    // Log the actual data we received for debugging
    console.log('Raw account summaries in report:', JSON.stringify(report.accountSummaries));
    
    report.accountSummaries.forEach(summary => {
      if (summary.accountType) {
        // Preserve all existing data including null values
        summariesByType.set(summary.accountType, { ...summary });
      }
    });
  }
  
  // Then create our final list in the required order, creating empty entries for missing types
  requiredAccountTypes.forEach(accountType => {
    const existingSummary = summariesByType.get(accountType);
    
    if (existingSummary) {
      accountSummaries.push(existingSummary);
    } else {
      // Create default entry with null values for missing account types
      accountSummaries.push({
        accountType,
        totalAccounts: null,
        open: null,
        closed: null,
        balance: null,
        withBalance: null,
        totalBalance: null,
        available: null,
        creditLimit: null,
        debtToCredit: null,
        payment: null
      });
    }
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CreditAccountsHeader 
          title="Credit Summary"
          description="Summary of your credit accounts"
          showDebugInfo={showDebugInfo} 
          toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
        />
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
        
        {showDebugInfo && (
          <>
            <div className="p-2 mb-4 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-sm font-medium text-amber-800">Debug Information</p>
              <p className="text-xs text-amber-700">
                Account Summaries Count: {report.accountSummaries?.length || 0}
              </p>
              <p className="text-xs text-amber-700 truncate">
                Raw Data: {JSON.stringify(report.accountSummaries).substring(0, 100)}...
              </p>
            </div>
            <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />
          </>
        )}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default Summary;
