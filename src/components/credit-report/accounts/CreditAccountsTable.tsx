
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // Function to render a cell value with proper formatting based on data type
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string) => {
    console.log(`Rendering cell: ${fieldName} - value: ${value}`);
    
    // For zero values - explicitly check string "0" as well as number 0
    if (value === 0 || value === "0") {
      console.log(`Found zero value in ${fieldName} cell`);
      return "0";
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
          {accountSummaries.map((summary) => {
            // Debug per row
            console.log(`Rendering row for ${summary.accountType}:`, summary);
            
            return (
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
                <TableCell>{renderCellValue('debtToCredit', summary.debtToCredit, formatAccountValue)}</TableCell>
                <TableCell>{renderCellValue('payment', summary.payment, formatDollarAmount)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default CreditAccountsTable;
