
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import { CreditReport, AccountSummary } from "@/lib/types/creditReport";

interface CreditAccountsProps {
  report: CreditReport;
}

const CreditAccounts: React.FC<CreditAccountsProps> = ({ report }) => {
  // Enhanced function to handle null, empty, and negative values
  const formatValue = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === '') {
      return ""; // Return empty string for null/undefined values
    }
    
    // Convert value to string for consistent processing
    const stringValue = String(value);
    
    // Check if it's already formatted with $ (don't double format)
    if (typeof stringValue === 'string' && stringValue.startsWith('$')) {
      // Handle case where the string already has $ but might need negative sign adjustment
      if (stringValue.includes('-$')) {
        return stringValue; // Already properly formatted negative value
      } else if (stringValue.startsWith('$-')) {
        // Fix incorrect format of '$-X' to '-$X'
        return '-$' + stringValue.substring(2);
      } else if (stringValue.charAt(0) === '-' && stringValue.charAt(1) === '$') {
        return stringValue; // Already properly formatted as '-$X'
      }
      return stringValue;
    }
    
    // For numerical values or numeric strings
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value.replace(/[^0-9.-]/g, ''))))) {
      let numericValue: number;
      
      if (typeof value === 'number') {
        numericValue = value;
      } else {
        // Extract numeric value from string, preserving negative sign
        const cleanedValue = value.replace(/[^0-9.-]/g, '');
        numericValue = parseFloat(cleanedValue);
      }
      
      // Check if the value is negative
      if (numericValue < 0) {
        // Format negative value as -$X,XXX
        return `-$${Math.abs(numericValue).toLocaleString()}`;
      } else {
        // Format positive value as $X,XXX
        return `$${numericValue.toLocaleString()}`;
      }
    }
    
    return value; // Return as is if it's not a numeric value
  };

  // Ensure we have all account types for the table
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Create default account summaries if missing
  const ensureAccountSummaries = () => {
    if (!report.accountSummaries || report.accountSummaries.length === 0) {
      return requiredAccountTypes.map(accountType => ({
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
      }));
    }

    // Ensure all required account types exist
    const existingTypes = report.accountSummaries.map(summary => summary.accountType);
    const summaries = [...report.accountSummaries];
    
    // Add missing account types
    requiredAccountTypes.forEach(accountType => {
      if (!existingTypes.includes(accountType)) {
        summaries.push({
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

    // Sort the summaries to match the required order
    return summaries.sort((a, b) => {
      return requiredAccountTypes.indexOf(a.accountType) - requiredAccountTypes.indexOf(b.accountType);
    });
  };

  // Get properly ordered account summaries
  const accountSummaries = ensureAccountSummaries();

  // Utility function to check if a cell value exists
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
  };

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
            {accountSummaries.map((summary, index) => (
              <TableRow 
                key={`account-summary-${summary.accountType}`} 
                className={summary.accountType === 'Total' ? "font-semibold bg-muted/30" : ""}
              >
                <TableCell className="font-medium">{summary.accountType}</TableCell>
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
