
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";

interface AIAnalysisAccountTableProps {
  accountSummaries: AccountSummary[];
}

const AIAnalysisAccountTable: React.FC<AIAnalysisAccountTableProps> = ({ accountSummaries }) => {
  // Function to render a cell value
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string) => {
    // Display "x" for null, undefined, or empty strings
    // But treat 0 as a valid value that should be displayed
    if (value === null || value === undefined || value === '') {
      return "x";
    }
    
    // For actual values (including 0), format them properly
    return formatter(value);
  };
  
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
          {accountSummaries.length > 0 ? (
            accountSummaries.map((summary, index) => (
              <TableRow 
                key={index} 
                className={summary.accountType === 'Total' ? 'font-semibold bg-muted/30' : ''}
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
