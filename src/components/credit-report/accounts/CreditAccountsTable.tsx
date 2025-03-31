
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  // Check if a cell should display a value or "x"
  // This is now account-type and field-specific based on examples
  const shouldDisplayValue = (accountType: string, fieldName: string, value: any): boolean => {
    // Mortgage and Other rows always show "x" for all fields except the account type
    if ((accountType === 'Mortgage' || accountType === 'Other') && 
        fieldName !== 'accountType') {
      return false;
    }
    
    // Revolving row displays "x" for open and withBalance (based on first example)
    // But shows values for financial amounts
    if (accountType === 'Revolving') {
      if (fieldName === 'open' || fieldName === 'withBalance') {
        // Example 1 shows "x", Example 2 shows "0"
        // Since we can't determine which to use without context, we'll:
        // Display the actual value if it exists and isn't null/undefined
        return value !== null && value !== undefined && value !== '';
      }
    }
    
    // Total row displays "x" for open and withBalance columns
    if (accountType === 'Total') {
      if (fieldName === 'open' || fieldName === 'withBalance') {
        // For these fields, check if we should display x
        // Example 1 shows "x", Example 2 shows "2"
        // Since we can't determine which to use without context, we'll:
        // Display the actual value if it exists and isn't null/undefined
        return value !== null && value !== undefined && value !== '';
      }
    }
    
    // Default behavior: show value if it exists (including 0)
    return value !== null && value !== undefined && value !== '';
  };

  // Function to render a cell value with proper formatting based on data type
  const renderCellValue = (accountType: string, fieldName: string, value: any, formatter: (value: any) => string) => {
    if (shouldDisplayValue(accountType, fieldName, value)) {
      return formatter(value);
    }
    return "x";
  };

  return (
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
        {accountSummaries.map((summary) => (
          <TableRow 
            key={`account-summary-${summary.accountType}`} 
            className={summary.accountType === 'Total' ? 'font-semibold bg-muted/30' : ''}
          >
            <TableCell className="font-medium">{summary.accountType}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'open', summary.open, formatAccountValue)}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'withBalance', summary.withBalance, formatAccountValue)}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'totalBalance', summary.totalBalance, formatDollarAmount)}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'available', summary.available, formatDollarAmount)}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'creditLimit', summary.creditLimit, formatDollarAmount)}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'debtToCredit', summary.debtToCredit, formatAccountValue)}</TableCell>
            <TableCell>{renderCellValue(summary.accountType, 'payment', summary.payment, formatDollarAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CreditAccountsTable;
