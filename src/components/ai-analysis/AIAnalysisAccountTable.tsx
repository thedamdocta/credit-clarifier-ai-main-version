
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";

interface AIAnalysisAccountTableProps {
  accountSummaries: AccountSummary[];
}

const AIAnalysisAccountTable: React.FC<AIAnalysisAccountTableProps> = ({ accountSummaries }) => {
  // Format value function for account summary table cells
  const formatValue = (value: string | number | undefined | null) => {
    // Return empty string for null/undefined values
    if (value === undefined || value === null || value === '') {
      return ""; 
    }
    
    // Convert value to string
    const stringValue = String(value);
    
    // For values already properly formatted with $ or -$, return as is
    if (typeof stringValue === 'string' && (stringValue.startsWith('$') || stringValue.startsWith('-$'))) {
      return stringValue;
    }
    
    // For numerical values or numeric strings that should be dollar amounts
    if (typeof value === 'number' || (typeof value === 'string' && !isNaN(Number(value.replace(/[^0-9.-]/g, ''))))) {
      let numericValue: number;
      
      if (typeof value === 'number') {
        numericValue = value;
      } else {
        // Extract numeric value from string, preserving negative sign
        const cleanedValue = value.replace(/[^0-9.-]/g, '');
        numericValue = parseFloat(cleanedValue);
      }
      
      // Format according to sign
      return numericValue < 0 ? 
        `-$${Math.abs(numericValue).toLocaleString()}` : 
        `$${numericValue.toLocaleString()}`;
    }
    
    return value; // Return as is if it's not a numeric value
  };

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
                <TableCell>{hasValue(summary.open) ? summary.open : ""}</TableCell>
                <TableCell>{hasValue(summary.withBalance) ? summary.withBalance : ""}</TableCell>
                <TableCell>{hasValue(summary.totalBalance) ? formatValue(summary.totalBalance) : ""}</TableCell>
                <TableCell>{hasValue(summary.available) ? formatValue(summary.available) : ""}</TableCell>
                <TableCell>{hasValue(summary.creditLimit) ? formatValue(summary.creditLimit) : ""}</TableCell>
                <TableCell>{hasValue(summary.debtToCredit) ? summary.debtToCredit : ""}</TableCell>
                <TableCell>{hasValue(summary.payment) ? formatValue(summary.payment) : ""}</TableCell>
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
