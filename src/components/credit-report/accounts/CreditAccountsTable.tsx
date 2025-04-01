
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // Improved data validation: Check if we have any actual meaningful data
  const hasAnyActualData = accountSummaries && accountSummaries.some(summary => 
    (summary.open !== null && summary.open !== "") || 
    (summary.withBalance !== null && summary.withBalance !== "") || 
    (summary.totalBalance !== null && summary.totalBalance !== "") ||
    (summary.available !== null && summary.available !== "") ||
    (summary.creditLimit !== null && summary.creditLimit !== "") ||
    (summary.debtToCredit !== null && summary.debtToCredit !== "") ||
    (summary.payment !== null && summary.payment !== "")
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

  // Default sample data to show if no actual data is available
  const sampleData = [
    { 
      accountType: 'Revolving', 
      totalAccounts: null, 
      open: "5", 
      closed: null, 
      balance: null, 
      withBalance: "3", 
      totalBalance: "$12,500", 
      available: "$25,000", 
      creditLimit: "$37,500", 
      debtToCredit: "33.3%", 
      payment: "$250" 
    },
    { 
      accountType: 'Mortgage', 
      totalAccounts: null, 
      open: "1", 
      closed: null, 
      balance: null, 
      withBalance: "1", 
      totalBalance: "$180,000", 
      available: "0", 
      creditLimit: "0", 
      debtToCredit: null, 
      payment: "$1,200" 
    },
    { 
      accountType: 'Installment', 
      totalAccounts: null, 
      open: "2", 
      closed: null, 
      balance: null, 
      withBalance: "2", 
      totalBalance: "$22,500", 
      available: "$0", 
      creditLimit: "$0", 
      debtToCredit: null, 
      payment: "$650" 
    },
    { 
      accountType: 'Other', 
      totalAccounts: null, 
      open: "0", 
      closed: null, 
      balance: null, 
      withBalance: "0", 
      totalBalance: "$0", 
      available: "$0", 
      creditLimit: "$0", 
      debtToCredit: null, 
      payment: "$0" 
    },
    { 
      accountType: 'Total', 
      totalAccounts: null, 
      open: "8", 
      closed: null, 
      balance: null, 
      withBalance: "6", 
      totalBalance: "$215,000", 
      available: "$25,000", 
      creditLimit: "$37,500", 
      debtToCredit: "49.8%", 
      payment: "$2,100" 
    }
  ];
  
  // Use the actual data if it exists, otherwise use sample data
  const summariesToRender = hasAnyActualData ? accountSummaries : sampleData;
  const usingSampleData = !hasAnyActualData;
  
  return (
    <div>
      {usingSampleData && (
        <Alert className="mb-4 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            No account data was found in your credit report. Displaying sample data for demonstration purposes.
          </AlertDescription>
        </Alert>
      )}
      
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
          {summariesToRender.map((summary) => (
            <TableRow 
              key={`account-summary-${summary.accountType}`}
              className={summary.accountType === 'Total' ? 'bg-muted/30 font-medium' : ''}
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CreditAccountsTable;
