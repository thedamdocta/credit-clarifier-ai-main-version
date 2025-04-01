
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  console.log("Table rendering with account summaries:", accountSummaries);

  // More robust data validation - check if we have any meaningful data
  // Only consider values that aren't empty strings, null, undefined, or "0" for all accounts
  const hasAnyActualData = accountSummaries && accountSummaries.some(summary => 
    ((summary.open !== null && summary.open !== "" && summary.open !== "0") || 
     (summary.withBalance !== null && summary.withBalance !== "" && summary.withBalance !== "0") || 
     (summary.totalBalance !== null && summary.totalBalance !== "" && summary.totalBalance !== "$0")) &&
     summary.accountType.toLowerCase() !== "total" // Exclude "Total" from this check
  );

  // Check if this is clearly sample data based on the specific values we use in our sample
  const isSampleData = accountSummaries && 
    accountSummaries.some(s => s.accountType === "Revolving" && s.totalBalance === "$16,355" && s.payment === "$627") &&
    accountSummaries.some(s => s.accountType === "Installment" && s.totalBalance === "$204,150" && s.available === "$15,455");

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

  // Default sample data to show if no actual data is available - kept for compatibility
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
  
  // Use the actual data if it exists and has meaningful content
  const summariesToRender = accountSummaries && accountSummaries.length > 0 ? accountSummaries : sampleData;
  const usingSampleData = !hasAnyActualData || isSampleData;
  
  return (
    <div>
      {usingSampleData && (
        <Alert className="mb-4 bg-amber-50">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Using sample data. Upload a clearer credit report or table image to see your actual data.
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
              <TableCell className="font-medium">
                {summary.accountType}
                {usingSampleData && (
                  <Badge variant="outline" className="ml-2 text-xs">Sample</Badge>
                )}
              </TableCell>
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
