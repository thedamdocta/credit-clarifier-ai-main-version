
import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import { CreditReport, AccountSummary } from "@/lib/creditReportParser";

interface CreditAccountsProps {
  report: CreditReport;
}

const CreditAccounts: React.FC<CreditAccountsProps> = ({ report }) => {
  // Function to handle null or empty values
  const formatValue = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === '') {
      return "$0";
    }
    if (typeof value === 'number') {
      return `$${value.toLocaleString()}`;
    }
    if (typeof value === 'string' && value.match(/^\d+$/)) {
      return `$${parseInt(value).toLocaleString()}`;
    }
    return value;
  };

  // Ensure we have all account types for the table
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Create default account summaries if missing
  const ensureAccountSummaries = () => {
    if (!report.accountSummaries || report.accountSummaries.length === 0) {
      return requiredAccountTypes.map(accountType => ({
        accountType,
        totalAccounts: 0,
        open: 0,
        closed: 0,
        balance: null,
        withBalance: 0,
        totalBalance: "$0",
        available: "$0",
        creditLimit: "$0",
        debtToCredit: "0%",
        payment: "$0"
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
          totalAccounts: 0,
          open: 0,
          closed: 0,
          balance: null,
          withBalance: 0,
          totalBalance: "$0",
          available: "$0",
          creditLimit: "$0",
          debtToCredit: "0%",
          payment: "$0"
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
                isHighlighted={summary.accountType === 'Total'}
              >
                <TableCell className="font-medium">{summary.accountType}</TableCell>
                <TableCell>{summary.open}</TableCell>
                <TableCell>{summary.withBalance || 0}</TableCell>
                <TableCell>{formatValue(summary.totalBalance)}</TableCell>
                <TableCell>{formatValue(summary.available)}</TableCell>
                <TableCell>{formatValue(summary.creditLimit)}</TableCell>
                <TableCell>{summary.debtToCredit || "0%"}</TableCell>
                <TableCell>{formatValue(summary.payment)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default CreditAccounts;
