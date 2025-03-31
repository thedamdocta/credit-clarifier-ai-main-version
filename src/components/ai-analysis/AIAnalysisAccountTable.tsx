
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface AIAnalysisAccountTableProps {
  accountSummaries: AccountSummary[];
}

const AIAnalysisAccountTable: React.FC<AIAnalysisAccountTableProps> = ({ accountSummaries }) => {
  // Utility function to check if a cell value exists
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== '';
  };
  
  // Filter out account types that have no data at all
  const hasAnyData = (summary: AccountSummary): boolean => {
    return hasValue(summary.open) || 
           hasValue(summary.withBalance) || 
           hasValue(summary.totalBalance) || 
           hasValue(summary.available) || 
           hasValue(summary.creditLimit) || 
           hasValue(summary.debtToCredit) || 
           hasValue(summary.payment);
  };

  const summariesWithData = accountSummaries.filter(hasAnyData);
  
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
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
          {summariesWithData.length > 0 ? (
            summariesWithData.map((summary, index) => (
              <TableRow 
                key={index} 
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
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-4">No account summary data detected</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AIAnalysisAccountTable;
