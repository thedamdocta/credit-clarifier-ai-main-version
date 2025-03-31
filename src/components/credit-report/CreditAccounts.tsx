
import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";
import CreditAccountsHeader from "./accounts/CreditAccountsHeader";
import CreditAccountsDebug from "./accounts/CreditAccountsDebug";
import CreditAccountsTable from "./accounts/CreditAccountsTable";

interface CreditAccountsProps {
  report: CreditReport;
}

const CreditAccounts: React.FC<CreditAccountsProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Required account types in order
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Create properly ordered account summaries with empty values for missing types
  const accountSummaries: AccountSummary[] = [];
  
  // First create a map of existing account summaries by type
  const summariesByType = new Map<string, AccountSummary>();
  
  // Debug the incoming report data
  console.log("Incoming account summaries:", report.accountSummaries);
  
  if (report.accountSummaries && report.accountSummaries.length > 0) {
    report.accountSummaries.forEach(summary => {
      if (summary.accountType) {
        // Store the summary in our map, preserving all original values (including zeros)
        summariesByType.set(summary.accountType, summary);
        
        console.log(`Processing ${summary.accountType} account summary:`, summary);
      }
    });
  }
  
  // Then create our final list in the required order, creating empty entries for missing types
  requiredAccountTypes.forEach(accountType => {
    const existingSummary = summariesByType.get(accountType);
    
    if (existingSummary) {
      // For existing summaries, preserve all original values
      accountSummaries.push({
        ...existingSummary
      });
    } else {
      // For missing types, all values should be explicitly null
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
  
  // Log the final processed summaries
  console.log("Final account summaries for display:", accountSummaries);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CreditAccountsHeader 
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

export default CreditAccounts;
