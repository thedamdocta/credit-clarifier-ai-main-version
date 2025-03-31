
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount } from "@/utils/formatters/accountValueFormatters";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // Check if a value exists and should display a real value (not "x")
  const shouldDisplayValue = (value: any): boolean => {
    // Special handling for numeric zero - display it as "0"
    if (value === 0 || value === "0") {
      console.log("Found zero value, displaying as 0");
      return true;
    }
    
    // For all other cases, only show value if it actually exists
    const hasValue = value !== null && value !== undefined && value !== '';
    console.log(`Value check: ${value} - has value: ${hasValue}`);
    return hasValue;
  };

  // Function to render a cell value with proper formatting
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string) => {
    console.log(`Rendering cell: ${fieldName} - value: ${value} - type: ${typeof value}`);
    
    if (shouldDisplayValue(value)) {
      const formattedValue = formatter(value);
      console.log(`Formatted value: ${formattedValue}`);
      return formattedValue;
    }
    
    console.log(`Value doesn't meet display criteria, showing "x" for ${fieldName}`);
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
        {accountSummaries.map((summary) => {
          console.log(`Rendering row for: ${summary.accountType}`, summary);
          
          return (
            <TableRow 
              key={`account-summary-${summary.accountType}`} 
              className={summary.accountType === 'Total' ? 'font-semibold bg-muted/30' : ''}
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
  );
};

export default CreditAccountsTable;
