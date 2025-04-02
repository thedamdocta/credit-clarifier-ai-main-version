
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
        
        // Clean up any problematic data before setting state
        const cleanedSummaries = accountSummaries.map(summary => {
          // Create a clean object to avoid duplication
          const cleanedSummary = { ...summary };
          
          // For specific account types like "Other", treat zeros explicitly
          if (summary.accountType === "Other" || summary.accountType === "Total") {
            // For "Other" or "Total" rows, preserve "0" values
            if (summary.open === "0" || summary.open === "," || summary.open === 0) {
              cleanedSummary.open = "0";
            }
            
            if (summary.withBalance === "0" || summary.withBalance === "," || summary.withBalance === 0) {
              cleanedSummary.withBalance = "0";
            }
            
            if (summary.totalBalance === "$0" || summary.totalBalance === "$," || 
                summary.totalBalance === "0" || summary.totalBalance === ",") {
              cleanedSummary.totalBalance = "$0";
            }
          } else {
            // For regular rows, handle zero values normally
            // Don't treat "0" values as empty, regardless of row type
            if (summary.open === "0" || summary.open === 0) {
              cleanedSummary.open = "0";
            } 
            else if (summary.open === ',' || summary.open === '' || summary.open === null) {
              cleanedSummary.open = null;
            }
            
            // Same for withBalance field
            if (summary.withBalance === "0" || summary.withBalance === 0) {
              cleanedSummary.withBalance = "0";
            } 
            else if (summary.withBalance === ',' || summary.withBalance === '' || summary.withBalance === null) {
              cleanedSummary.withBalance = null;
            }
            
            // Same for totalBalance field
            if (summary.totalBalance === "$0" || summary.totalBalance === "0" || summary.totalBalance === 0) {
              cleanedSummary.totalBalance = "$0";
            }
            else if (summary.totalBalance === '$,' || summary.totalBalance === '$' || 
                     summary.totalBalance === ',' || summary.totalBalance === '' || 
                     summary.totalBalance === null) {
              cleanedSummary.totalBalance = null;
            }
          }
          
          // Special processing for Total row - preserve all values
          if (summary.accountType === "Total") {
            // For Total row, we want to display any values that exist, not just zeroes
            // This preserves real sum values for the Total row
            if (summary.available) cleanedSummary.available = summary.available;
            if (summary.creditLimit) cleanedSummary.creditLimit = summary.creditLimit; 
            if (summary.debtToCredit) cleanedSummary.debtToCredit = summary.debtToCredit;
            if (summary.payment) cleanedSummary.payment = summary.payment;
          }
          
          // Special processing for Installment row - preserve all values, especially the negative values
          if (summary.accountType === "Installment") {
            // For Installment row, preserve values that might be negative
            if (summary.available) cleanedSummary.available = summary.available;
            if (summary.creditLimit) cleanedSummary.creditLimit = summary.creditLimit;
            if (summary.debtToCredit) cleanedSummary.debtToCredit = summary.debtToCredit;
            if (summary.payment) cleanedSummary.payment = summary.payment;
          }
          
          // Handle negative values in Available column - should be displayed as negative
          if (summary.available && summary.available.includes('-')) {
            cleanedSummary.available = summary.available;
          }
          
          return cleanedSummary;
        });
        
        setStableData(cleanedSummaries);
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
  const renderCellValue = (fieldName: string, value: any, formatter: (value: any) => string, accountType: string) => {
    // Special handling for zero values
    if (value === "0" || value === 0 || value === "$0" || value === "," || value === "$,") {
      // Always correctly format zero values
      if (fieldName === 'open' || fieldName === 'withBalance') return "0";
      if (fieldName === 'totalBalance' || fieldName === 'available' || 
          fieldName === 'creditLimit' || fieldName === 'payment') return "$0";
      if (fieldName === 'debtToCredit') return "0.0%";
    }
    
    // Special handling for Total row - don't display "x" for values that exist
    if (accountType === "Total" && value !== null && value !== undefined && value !== '') {
      return formatter(value);
    }
    
    // Special handling for the Other row
    if (accountType === "Other") {
      // For "Other" row, show zeros as "0" not "x"
      if (value === "0" || value === 0 || value === "," || value === "$,") {
        if (fieldName === 'open' || fieldName === 'withBalance') return "0";
        if (fieldName === 'totalBalance' || fieldName === 'available' || 
            fieldName === 'creditLimit' || fieldName === 'payment') return "$0";
        if (fieldName === 'debtToCredit') return "0.0%";
      }
    }
    
    // Special handling for the Installment row - preserve all values, especially negatives
    if (accountType === "Installment" && value !== null && value !== undefined && value !== '') {
      // Ensure negative values in Available are shown correctly
      if (fieldName === "available" && typeof value === "string" && value.includes("-")) {
        return formatter(value);
      }
      return formatter(value);
    }
    
    // Handle common OCR errors
    if (value === ',' || value === '.') {
      return "x";  // Display x instead of 0 for empty cells
    }
    
    // Handle "$," error specifically
    if (value === "$," || value === "$-" || value === "$." || value === "$") {
      return "x";  // Display x for empty currency cells
    }
    
    // Display "x" for null, undefined, or empty strings
    if (value === null || value === undefined || value === '') {
      return "x";
    }
    
    // Handle the case where Available is negative
    if (fieldName === "available" && typeof value === "string" && value.includes("-")) {
      // Keep the negative sign - this is valid for Available
      return formatter(value);
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
              <TableCell>{renderCellValue('open', summary.open, formatAccountValue, summary.accountType)}</TableCell>
              <TableCell>{renderCellValue('withBalance', summary.withBalance, formatAccountValue, summary.accountType)}</TableCell>
              <TableCell>{renderCellValue('totalBalance', summary.totalBalance, formatDollarAmount, summary.accountType)}</TableCell>
              <TableCell>{renderCellValue('available', summary.available, formatDollarAmount, summary.accountType)}</TableCell>
              <TableCell>{renderCellValue('creditLimit', summary.creditLimit, formatDollarAmount, summary.accountType)}</TableCell>
              <TableCell>{renderCellValue('debtToCredit', summary.debtToCredit, formatPercentageValue, summary.accountType)}</TableCell>
              <TableCell>{renderCellValue('payment', summary.payment, formatDollarAmount, summary.accountType)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CreditAccountsTable;
