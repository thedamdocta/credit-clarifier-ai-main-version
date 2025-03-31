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
  
  // Required account types in order - REMOVED Collection
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Create properly ordered account summaries with empty values for missing types
  const accountSummaries: AccountSummary[] = [];
  
  // First create a map of existing account summaries by type
  const summariesByType = new Map<string, AccountSummary>();
  if (report.accountSummaries && report.accountSummaries.length > 0) {
    report.accountSummaries.forEach(summary => {
      if (summary.accountType) {
        // Clean up the data based on the account type
        if (summary.accountType === 'Revolving') {
          // For Revolving, preserve actual values but some fields will be marked "x" in the table
          const revolving = {
            ...summary,
            // Preserve actual values, including zeros
            totalAccounts: summary.totalAccounts,
            open: summary.open,
            withBalance: summary.withBalance,
            totalBalance: summary.totalBalance,
            available: summary.available,
            creditLimit: summary.creditLimit,
            debtToCredit: summary.debtToCredit,
            payment: summary.payment,
          };
          summariesByType.set(summary.accountType, revolving);
        } else if (summary.accountType === 'Mortgage' || summary.accountType === 'Other') {
          // For Mortgage and Other, nullify all values except accountType to show "x"
          summariesByType.set(summary.accountType, {
            accountType: summary.accountType,
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
        } else if (summary.accountType === 'Total') {
          // For Total, keep certain values and x-out others
          const total = {
            ...summary,
            // These will show as "x" in the table but we keep real values
            totalAccounts: summary.totalAccounts,
            open: summary.open,
            withBalance: summary.withBalance,
            // These show the actual values
            totalBalance: summary.totalBalance,
            available: summary.available,
            creditLimit: summary.creditLimit,
            debtToCredit: summary.debtToCredit,
            payment: summary.payment,
          };
          summariesByType.set(summary.accountType, total);
        } else {
          // For other types like Installment, keep all values as is
          summariesByType.set(summary.accountType, summary);
        }
      }
    });
  }
  
  // Then create our final list in the required order, creating empty entries for missing types
  requiredAccountTypes.forEach(accountType => {
    const existingSummary = summariesByType.get(accountType);
    
    if (existingSummary) {
      accountSummaries.push(existingSummary);
    } else {
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
