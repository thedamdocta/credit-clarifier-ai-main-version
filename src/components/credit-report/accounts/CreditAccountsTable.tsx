
import React, { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";
import { AlertCircle, Info, Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
  onRequestUpload?: () => void;
}

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ 
  accountSummaries,
  onRequestUpload 
}) => {
  console.log("Table rendering with account summaries:", accountSummaries);
  const [stableData, setStableData] = useState<AccountSummary[]>(accountSummaries);
  
  // If we receive new account summaries with actual data, update our stable data
  useEffect(() => {
    // Only update the stable data if:
    // 1. We currently have no stable data, or
    // 2. The new data has actual values that are better than what we currently have
    if (accountSummaries && accountSummaries.length > 0) {
      const newDataHasRealValues = accountSummaries.some(summary => 
        ((summary.open !== null && summary.open !== "" && summary.open !== "0") || 
         (summary.withBalance !== null && summary.withBalance !== "" && summary.withBalance !== "0") || 
         (summary.totalBalance !== null && summary.totalBalance !== "" && summary.totalBalance !== "$0")) &&
         summary.accountType.toLowerCase() !== "total" // Exclude "Total" from this check
      );
      
      const currentDataHasNoValues = !stableData || stableData.length === 0 || !stableData.some(summary => 
        (summary.open !== null && summary.open !== "" && summary.open !== "0") || 
        (summary.withBalance !== null && summary.withBalance !== "" && summary.withBalance !== "0") ||
        (summary.totalBalance !== null && summary.totalBalance !== "" && summary.totalBalance !== "$0")
      );
      
      if (currentDataHasNoValues || newDataHasRealValues) {
        console.log("Updating stable data with new account summaries that have real values");
        setStableData(accountSummaries);
      } else {
        console.log("Keeping existing stable data as it has better values than new data");
      }
    }
  }, [accountSummaries]);
  
  // More robust data validation - check if we have any meaningful data
  const summariesToDisplay = stableData && stableData.length > 0 ? stableData : accountSummaries;
  
  // Check if this is clearly sample data based on specific values we use in our sample
  const isSampleData = summariesToDisplay && 
    summariesToDisplay.some(s => s.accountType === "Revolving" && s.totalBalance === "$16,355" && s.payment === "$627") &&
    summariesToDisplay.some(s => s.accountType === "Installment" && s.totalBalance === "$204,150" && s.available === "$15,455");
  
  // Check if all values in the table are null/empty (no extraction)
  const hasNoData = !summariesToDisplay || summariesToDisplay.length === 0 || summariesToDisplay.every(summary =>
    (summary.open === null || summary.open === "") && 
    (summary.withBalance === null || summary.withBalance === "") && 
    (summary.totalBalance === null || summary.totalBalance === "" || summary.totalBalance === "$0")
  );
  
  // Function to render a cell value with proper formatting based on data type
  // This improved function adds better handling for edge cases
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string) => {
    // For zero values - explicitly check string "0" as well as number 0
    if (value === 0 || value === "0") {
      return fieldName === "debtToCredit" ? "0.0%" : "0";
    }
    
    // Handle negative values properly (often seen in Available fields)
    if (typeof value === 'string' && value.startsWith('-$')) {
      return value; // Keep negative dollar values as is
    }
    
    // Handle currencies with or without $ prefix consistently
    if (typeof value === 'string' && !isNaN(parseFloat(value.replace(/[^0-9.-]/g, '')))) {
      if (fieldName === 'totalBalance' || fieldName === 'available' || fieldName === 'creditLimit' || fieldName === 'payment') {
        const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ''));
        return value.includes('$') ? value : `$${numericValue}`;
      }
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
      {hasNoData && (
        <Alert className="mb-4 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 flex items-center justify-between">
            <span>We couldn't extract account data from your credit report. Try uploading a clearer PDF with the account summary table clearly visible.</span>
            {onRequestUpload && (
              <Button variant="outline" size="sm" className="ml-4 bg-white" onClick={onRequestUpload}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Better PDF
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      
      {!hasNoData && isSampleData && (
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
          {summariesToDisplay.map((summary) => (
            <TableRow 
              key={`account-summary-${summary.accountType}`}
              className={summary.accountType === 'Total' ? 'bg-muted/30 font-medium' : ''}
            >
              <TableCell className="font-medium">
                {summary.accountType}
                {isSampleData && (
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
