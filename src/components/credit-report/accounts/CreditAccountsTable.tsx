
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // Check if we have any valid data
  const hasAnyData = accountSummaries && accountSummaries.some(summary => 
    summary.open !== null || 
    summary.withBalance !== null || 
    summary.totalBalance !== null ||
    summary.available !== null ||
    summary.creditLimit !== null
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

  return (
    <div>
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
          {accountSummaries.length > 0 ? (
            accountSummaries.map((summary) => (
              <TableRow 
                key={`account-summary-${summary.accountType}`}
                className={summary.accountType === 'Total' ? 'bg-muted/30' : ''}
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
            ))
          ) : (
            // Display empty rows when no data is available
            ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'].map(accountType => (
              <TableRow key={`empty-${accountType}`}>
                <TableCell className="font-medium">{accountType}</TableCell>
                {/* Display "x" in all cells for empty rows */}
                {Array(7).fill(0).map((_, i) => (
                  <TableCell key={i}>x</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CreditAccountsTable;
