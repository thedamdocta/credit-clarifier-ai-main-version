import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditReport } from "@/lib/creditReportParser";
import { AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AIAnalysisSummaryProps {
  report: CreditReport;
}

const AIAnalysisSummary: React.FC<AIAnalysisSummaryProps> = ({ report }) => {
  // Calculate total accounts from account summaries if available
  const totalAccounts = report.accountSummaries?.find(summary => summary.accountType === 'Total')?.totalAccounts || 0;
  
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
  
  return (
    <Card className="mt-8 border-dashed border-yellow-500">
      <CardHeader className="bg-yellow-50">
        <CardTitle className="flex items-center text-yellow-700">
          <AlertCircle className="h-5 w-5 mr-2" />
          AI Analysis Debug Summary
        </CardTitle>
        <CardDescription className="text-yellow-600">
          This is a temporary display to troubleshoot AI detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-4">
          <div>
            <h3 className="font-medium mb-1">Detected Bureau</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm">{report.bureau}</pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">Detected Report Date</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm">{report.reportDate}</pre>
          </div>
          
          <div>
            <h3 className="font-medium mb-1">Detected Personal Information</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
              {JSON.stringify(report.personalInfo, null, 2)}
            </pre>
          </div>
          
          {report.accountSummaries && report.accountSummaries.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Detected Account Summaries (8x5 Table)</h3>
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
                    {report.accountSummaries.map((summary, index) => (
                      <TableRow 
                        key={index} 
                        className={summary.accountType === 'Total' ? 'bg-muted/30 font-semibold' : ''}
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-medium mb-1">Number of Accounts Detected</h3>
            <pre className="bg-slate-100 p-2 rounded text-sm">
              {report.accounts.length} (Individual accounts) / {totalAccounts} (From summary)
            </pre>
            {report.accounts.length > 0 && (
              <div className="mt-2">
                <h4 className="text-sm font-medium">First Account Sample</h4>
                <pre className="bg-slate-100 p-2 rounded text-sm whitespace-pre-wrap">
                  {JSON.stringify(report.accounts[0], null, 2)}
                </pre>
              </div>
            )}
          </div>

          {report.bureau === 'Equifax' && (
            <div>
              <h3 className="font-medium mb-1">Equifax-Specific Data</h3>
              <div className="grid gap-2">
                <div>
                  <h4 className="text-sm font-medium">Personal Info Items</h4>
                  <pre className="bg-slate-100 p-2 rounded text-sm">{report.personalInfoItemCount || 0} Items Found</pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Inquiries</h4>
                  <pre className="bg-slate-100 p-2 rounded text-sm">{report.inquiryCount || 0} Inquiries Found</pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Most Recent Inquiry</h4>
                  <pre className="bg-slate-100 p-2 rounded text-sm">{report.recentInquiry || 'None'}</pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Public Records</h4>
                  <pre className="bg-slate-100 p-2 rounded text-sm">{report.publicRecordCount || 0} Records Found</pre>
                </div>
                <div>
                  <h4 className="text-sm font-medium">Collections</h4>
                  <pre className="bg-slate-100 p-2 rounded text-sm">{report.collectionCount || 0} Collections Found</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIAnalysisSummary;
