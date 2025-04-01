
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // Check if we have any valid data (at least one field with an actual value)
  const hasAnyData = accountSummaries && accountSummaries.some(summary => 
    summary.open !== null || 
    summary.withBalance !== null || 
    summary.totalBalance !== null ||
    summary.available !== null ||
    summary.creditLimit !== null ||
    summary.debtToCredit !== null ||
    summary.payment !== null
  );

  // Function to render a cell value with proper formatting based on data type
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string) => {
    // For zero values - explicitly check string "0" as well as number 0
    if (value === 0 || value === "0") {
      return fieldName === "debtToCredit" ? "0.0%" : "0";
    }
    
    // Display "x" for null, undefined, or empty strings
    if (value === null || value === undefined || value === '') {
      return "x";
    }
    
    // For actual values, format them properly
    return formatter(value);
  };

  // FIXED: Added fallback account summaries when we have an empty array
  const summariesToRender = accountSummaries.length > 0 ? accountSummaries : [
    { accountType: 'Revolving', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Mortgage', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Installment', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Other', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null },
    { accountType: 'Total', totalAccounts: null, open: null, closed: null, balance: null, withBalance: null, totalBalance: null, available: null, creditLimit: null, debtToCredit: null, payment: null }
  ];
  
  return (
    <div>
      {!hasAnyData && (
        <Alert className="mb-4 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            No account data was found in your credit report. The table below shows placeholder values.
          </AlertDescription>
        </Alert>
      )}
      
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
          {summariesToRender.map((summary) => (
            <TableRow 
              key={`account-summary-${summary.accountType}`}
              className={summary.accountType === 'Total' ? 'bg-muted/30 font-medium' : ''}
            >
              <TableCell className="font-medium">{summary.accountType}</TableCell>
              <TableCell>{renderCellValue('open', summary.open, formatAccountValue)}</TableCell>
              <TableCell>{renderCellValue('withBalance', summary.withBalance, formatAccountValue)}</TableCell>
              <TableCell>{renderCellValue('totalBalance', summary.totalBalance, formatDollarAmount)}</TableCell>
              <TableCell>{renderCellValue('available', summary.available, formatDollarAmount)}</TableCell>
              <TableCell>{renderCellValue('creditLimit', summary.creditLimit, formatDollarAmount)}</TableCell>
              <TableCell>{renderCellValue('debtToCredit', summary.debtToCredit, formatPercentageValue)}</TableCell>
              <TableCell>{renderCellValue('payment', summary.payment, formatDollarAmount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CreditAccountsTable;
