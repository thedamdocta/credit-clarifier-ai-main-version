import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditReport } from "@/lib/creditReportParser";
import { CalendarDays, CreditCard, FileText, Info, ShieldCheck } from "lucide-react";

interface EquifaxCreditReportProps {
  report: CreditReport;
}

const EquifaxCreditReport: React.FC<EquifaxCreditReportProps> = ({ report }) => {
  // Function to handle null or empty values
  const formatValue = (value: string | number | undefined | null) => {
    if (value === undefined || value === null || value === '') {
      return "$0";
    }
    if (typeof value === 'number') {
      return `$${value.toLocaleString()}`;
    }
    if (typeof value === 'string' && value.match(/^\d+$/)) {
      return `$${parseInt(value).toLocaleString()}`;
    }
    return value;
  };

  // Ensure we have all account types for the table
  const requiredAccountTypes = ['Revolving', 'Mortgage', 'Installment', 'Other', 'Total'];
  
  // Create default account summaries if missing
  const ensureAccountSummaries = () => {
    if (!report.accountSummaries || report.accountSummaries.length === 0) {
      return requiredAccountTypes.map(accountType => ({
        accountType,
        totalAccounts: 0,
        open: 0,
        closed: 0,
        balance: null,
        withBalance: 0,
        totalBalance: "$0",
        available: "$0",
        creditLimit: "$0",
        debtToCredit: "0%",
        payment: "$0"
      }));
    }

    // Ensure all required account types exist
    const existingTypes = report.accountSummaries.map(summary => summary.accountType);
    const summaries = [...report.accountSummaries];
    
    // Add missing account types
    requiredAccountTypes.forEach(accountType => {
      if (!existingTypes.includes(accountType)) {
        summaries.push({
          accountType,
          totalAccounts: 0,
          open: 0,
          closed: 0,
          balance: null,
          withBalance: 0,
          totalBalance: "$0",
          available: "$0",
          creditLimit: "$0",
          debtToCredit: "0%",
          payment: "$0"
        });
      }
    });

    // Sort the summaries to match the required order
    return summaries.sort((a, b) => {
      return requiredAccountTypes.indexOf(a.accountType) - requiredAccountTypes.indexOf(b.accountType);
    });
  };

  // Get properly ordered account summaries
  const accountSummaries = ensureAccountSummaries();

  return (
    <div className="space-y-6">
      {/* Report Confirmation Section */}
      <Card>
        <CardHeader className="bg-credit-blue bg-opacity-10">
          <CardTitle className="text-credit-blue flex items-center">
            <ShieldCheck className="h-5 w-5 mr-2" />
            Report Confirmation
          </CardTitle>
          <CardDescription>
            Your Equifax credit report information
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid gap-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Confirmation Number</span>
              <span className="text-muted-foreground">{report.confirmationNumber || "Not Available"}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Report Date</span>
              <span className="text-muted-foreground">{report.reportDate || "Not Available"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Info className="h-5 w-5 mr-2" />
            1. Summary
          </CardTitle>
          <CardDescription>Overview of your Equifax credit file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Credit File Status</span>
              <span className="text-green-500 font-medium">{report.creditFileStatus || "No fraud indicator on file"}</span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Alert Contacts</span>
              <span className="text-muted-foreground">{report.alertContacts || "0 Records Found"}</span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Average Account Age</span>
              <span className="text-muted-foreground">{report.averageAccountAge || "Not Available"}</span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Length of Credit History</span>
              <span className="text-muted-foreground">{report.lengthOfCreditHistory || "Not Available"}</span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Accounts with Negative Information</span>
              <span className="text-muted-foreground">{report.accountsWithNegativeInfo || "Not Available"}</span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Oldest Account</span>
              <div className="text-right">
                <div>{report.oldestAccount?.accountName || "Not Available"}</div>
                {report.oldestAccount?.openDate && (
                  <div className="text-xs text-muted-foreground">Opened {report.oldestAccount.openDate}</div>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Most Recent Account</span>
              <div className="text-right">
                <div>{report.recentAccount?.accountName || "Not Available"}</div>
                {report.recentAccount?.openDate && (
                  <div className="text-xs text-muted-foreground">Opened {report.recentAccount.openDate}</div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Credit Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Credit Accounts
          </CardTitle>
          <CardDescription>Summary of your credit accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Your credit report includes information about activity on your credit accounts that may affect your credit score and rating.</p>
          
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
              {accountSummaries.map((summary, index) => (
                <TableRow 
                  key={`account-summary-${summary.accountType}`} 
                  isHighlighted={summary.accountType === 'Total'}
                >
                  <TableCell className="font-medium">{summary.accountType}</TableCell>
                  <TableCell>{summary.open}</TableCell>
                  <TableCell>{summary.withBalance || 0}</TableCell>
                  <TableCell>{formatValue(summary.totalBalance)}</TableCell>
                  <TableCell>{formatValue(summary.available)}</TableCell>
                  <TableCell>{formatValue(summary.creditLimit)}</TableCell>
                  <TableCell>{summary.debtToCredit || "0%"}</TableCell>
                  <TableCell>{formatValue(summary.payment)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Other Items Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Other Items
          </CardTitle>
          <CardDescription>Additional information in your credit file</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4">Your credit report includes your Personal Information and, if applicable, Consumer Statements, and could include other items that may affect your credit score and rating.</p>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Collections</span>
              <span className="text-muted-foreground">
                {report.collectionCount !== undefined ? `${report.collectionCount} Records Found` : "Not Available"}
              </span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Public Records</span>
              <span className="text-muted-foreground">
                {report.publicRecordCount !== undefined ? `${report.publicRecordCount} Records Found` : "Not Available"}
              </span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Credit Inquiries</span>
              <span className="text-muted-foreground">
                {report.inquiryCount !== undefined ? `${report.inquiryCount} Records Found` : "Not Available"}
              </span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Most Recent Inquiry</span>
              <span className="text-muted-foreground">{report.recentInquiry || "Not Available"}</span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Personal Information</span>
              <span className="text-muted-foreground">
                {report.personalInfoItemCount !== undefined ? `${report.personalInfoItemCount} Items Found` : "Not Available"}
              </span>
            </div>
            
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-medium">Statement</span>
              <span className="text-muted-foreground">{report.statementCount !== undefined ? `${report.statementCount} Records Found` : "0 Records Found"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Dispute Information Section */}
      <Card>
        <CardHeader className="bg-gray-50">
          <CardTitle className="text-sm flex items-center">
            <CalendarDays className="h-4 w-4 mr-2" />
            Dispute Information
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm pt-4">
          <p className="mb-2">
            If you believe any information in this report is inaccurate or incomplete, you may dispute it by:
          </p>
          <ul className="list-disc pl-5 mb-4 space-y-1">
            <li>
              <span className="font-medium">Online:</span>{" "}
              <a href="https://www.equifax.com/personal/credit-report-services/credit-dispute/" className="text-blue-600 hover:underline">
                www.equifax.com/personal/credit-report-services/credit-dispute/
              </a>
            </li>
            <li>
              <span className="font-medium">Mail:</span> Equifax Information Services LLC, P.O. Box 740241, Atlanta, GA 30374
            </li>
            <li>
              <span className="font-medium">Phone:</span> 866-349-5186
            </li>
          </ul>
          <p>
            For information about your credit score, call: <span className="font-medium">1-877-SCORE-11</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default EquifaxCreditReport;
