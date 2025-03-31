
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // Check if a cell is truly empty and should display "x"
  const isCellEmpty = (value: any): boolean => {
    return value === null || value === undefined || value === '';
  };

  // Function to render a cell value with proper formatting based on account type
  const renderCellValue = (accountType: string, fieldName: string, value: any, formatter: (value: any) => string) => {
    console.log(`Rendering cell for ${accountType} - ${fieldName}: ${value} (${typeof value})`);
    
    // If the value is empty (null, undefined, or empty string), show "x"
    if (isCellEmpty(value)) {
      return "x";
    }
    
    // For values that exist (including zero values), display them properly formatted
    const formattedValue = formatter(value);
    console.log(`Formatted value: ${formattedValue}`);
    return formattedValue;
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
        {accountSummaries.map((summary) => {
          console.log(`Rendering row for: ${summary.accountType}`, summary);
          const isTotal = summary.accountType === 'Total';
          
          return (
            <TableRow 
              key={`account-summary-${summary.accountType}`} 
              className={isTotal ? "font-medium bg-muted/30" : ""}
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
          );
        })}
      </TableBody>
    </Table>
  );
};

export default CreditAccountsTable;
