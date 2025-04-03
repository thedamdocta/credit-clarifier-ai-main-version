
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
  
  if (report.accountSummaries && report.accountSummaries.length > 0) {
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
        
        {showDebugInfo && <CreditAccountsDebug accountSummaries={report.accountSummaries || []} />}
        
        <CreditAccountsTable accountSummaries={accountSummaries} />
      </CardContent>
    </Card>
  );
};

export default Summary;
