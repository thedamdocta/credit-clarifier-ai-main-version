
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  // Check if a cell should display a value or "x"
  const shouldDisplayValue = (accountType: string, fieldName: string, value: any): boolean => {
    // From logs we can see Revolving and Total rows should have "x" for most fields
    if ((accountType === 'Revolving' || accountType === 'Total') && 
        fieldName !== 'accountType' && 
        fieldName !== 'totalBalance' && 
        fieldName !== 'available' && 
        fieldName !== 'creditLimit' && 
        fieldName !== 'debtToCredit' && 
        fieldName !== 'payment') {
      return false;
    }
    
    // Also for mortgage row, check if it should be "x"
    if (accountType === 'Mortgage' && 
        fieldName !== 'accountType') {
      return false;
    }
    
    // For other rows, check if value exists
    if (accountType === 'Other' && 
        fieldName !== 'accountType') {
      return false;
    }
    
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
