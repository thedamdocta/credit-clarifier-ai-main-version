
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";

interface CreditAccountsProps {
  report: CreditReport;
}

const CreditAccounts: React.FC<CreditAccountsProps> = ({ report }) => {
  // Format value function - handles each cell independently
  const formatValue = (value: string | number | undefined | null) => {
    // Return empty string for null/undefined values
    if (value === undefined || value === null || value === '') {
      return ""; 
    }
    
    // Convert value to string
    const stringValue = String(value);
    
    // For values already properly formatted with $ or -$, return as is
    if (typeof stringValue === 'string' && (stringValue.startsWith('$') || stringValue.startsWith('-$'))) {
      return stringValue;
    }
    
    // For numerical values or numeric strings that should be dollar amounts
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value.replace(/[^0-9.-]/g, ''))))) {
      let numericValue: number;
      
      if (typeof value === 'number') {
        numericValue = value;
      } else {
        // Extract numeric value from string, preserving negative sign
        const cleanedValue = value.replace(/[^0-9.-]/g, '');
        numericValue = parseFloat(cleanedValue);
      }
      
      // Format according to sign
      return numericValue < 0 ? 
        `-$${Math.abs(numericValue).toLocaleString()}` : 
        `$${numericValue.toLocaleString()}`;
    }
    
    return value; // Return as is if it's not a numeric value
  };

  // Utility function to check if a cell value exists
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
  };

  // Required account types in order - updated to include Collection
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Collection', 'Other', 'Total'];
  
  // Create properly ordered account summaries with empty values for missing types
  const accountSummaries: AccountSummary[] = [];
  
  // First create a map of existing account summaries by type
  const summariesByType = new Map<string, AccountSummary>();
  if (report.accountSummaries && report.accountSummaries.length > 0) {
    report.accountSummaries.forEach(summary => {
      if (summary.accountType) {
        summariesByType.set(summary.accountType, summary);
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

  // Log the account summaries for debugging
  console.log("Account summaries to be displayed:", accountSummaries);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <CreditCard className="h-5 w-5 mr-2" />
          Credit Accounts
        </CardTitle>
        <CardDescription>Summary of your credit accounts</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
        
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead>Account Type</TableHead>
              <TableHead>Total Accounts</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>With Balance</TableHead>
              <TableHead>Total Balance</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Debt-to-Credit</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accountSummaries.map((summary) => (
              <TableRow 
                key={`account-summary-${summary.accountType}`} 
                className={summary.accountType === 'Total' ? 'font-semibold bg-muted/30' : ''}
              >
                <TableCell className="font-medium">{summary.accountType}</TableCell>
                <TableCell>{hasValue(summary.totalAccounts) ? summary.totalAccounts : ""}</TableCell>
                <TableCell>{hasValue(summary.open) ? summary.open : ""}</TableCell>
                <TableCell>{hasValue(summary.withBalance) ? summary.withBalance : ""}</TableCell>
                <TableCell>{hasValue(summary.totalBalance) ? formatValue(summary.totalBalance) : ""}</TableCell>
                <TableCell>{hasValue(summary.available) ? formatValue(summary.available) : ""}</TableCell>
                <TableCell>{hasValue(summary.creditLimit) ? formatValue(summary.creditLimit) : ""}</TableCell>
                <TableCell>{hasValue(summary.debtToCredit) ? summary.debtToCredit : ""}</TableCell>
                <TableCell>{hasValue(summary.payment) ? formatValue(summary.payment) : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default CreditAccounts;
