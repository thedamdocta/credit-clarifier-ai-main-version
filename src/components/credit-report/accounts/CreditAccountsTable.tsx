
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, hasDisplayValue } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  // Function to render a cell value with proper formatting based on data type
  const renderCellValue = (value: any, formatter: (value: any) => string) => {
    // Always format the value, the formatter will handle empty values
    return formatter(value);
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
            <TableCell>{renderCellValue(summary.open, formatAccountValue)}</TableCell>
            <TableCell>{renderCellValue(summary.withBalance, formatAccountValue)}</TableCell>
            <TableCell>{renderCellValue(summary.totalBalance, formatDollarAmount)}</TableCell>
            <TableCell>{renderCellValue(summary.available, formatDollarAmount)}</TableCell>
            <TableCell>{renderCellValue(summary.creditLimit, formatDollarAmount)}</TableCell>
            <TableCell>{renderCellValue(summary.debtToCredit, formatAccountValue)}</TableCell>
            <TableCell>{renderCellValue(summary.payment, formatDollarAmount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CreditAccountsTable;
