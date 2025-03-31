
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  // Utility function to check if a cell value exists
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
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
            <TableCell>{hasValue(summary.open) ? formatAccountValue(summary.open) : ""}</TableCell>
            <TableCell>{hasValue(summary.withBalance) ? formatAccountValue(summary.withBalance) : ""}</TableCell>
            <TableCell>{hasValue(summary.totalBalance) ? formatDollarAmount(summary.totalBalance) : ""}</TableCell>
            <TableCell>{hasValue(summary.available) ? formatDollarAmount(summary.available) : ""}</TableCell>
            <TableCell>{hasValue(summary.creditLimit) ? formatDollarAmount(summary.creditLimit) : ""}</TableCell>
            <TableCell>{hasValue(summary.debtToCredit) ? formatAccountValue(summary.debtToCredit) : ""}</TableCell>
            <TableCell>{hasValue(summary.payment) ? formatDollarAmount(summary.payment) : ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CreditAccountsTable;
