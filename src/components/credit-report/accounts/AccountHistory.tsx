
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountHistoryProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountHistory: React.FC<AccountHistoryProps> = ({ account, showDebugInfo }) => {
  // Get current year for generating dynamic years if none are provided
  const currentYear = new Date().getFullYear();
  
  // Generate years dynamically from account data or use the last 4 years as fallback
  // In real implementation, these would be derived from actual account data
  const getYearsFromAccount = (account: Account): string[] => {
    // This is where you would extract years from account history data
    // For now, we'll use the current year and 3 previous years as a fallback
    return [
      currentYear.toString(),
      (currentYear - 1).toString(),
      (currentYear - 2).toString(),
      (currentYear - 3).toString(),
    ];
  };
  
  const years = getYearsFromAccount(account);
  
  // Data categories to display as separate tables
  const dataCategories = [
    { title: "Balance", key: "balance" },
    { title: "Scheduled Payment", key: "scheduledPayment" },
    { title: "Actual Payment", key: "actualPayment" },
    { title: "Credit Limit", key: "creditLimit" },
    { title: "Amount Past Due", key: "amountPastDue" },
    { title: "Activity Designator", key: "activityDesignator" }
  ];

  // Months for table headers
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Function to render a single history table for a data category
  const renderHistoryTable = (category: { title: string, key: string }) => {
    return (
      <Card key={category.key} className="mb-6 border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">{category.title} History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Year</TableHead>
                {months.map(month => (
                  <TableHead key={month}>{month}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {years.map(year => (
                <TableRow key={year}>
                  <TableCell className="font-medium">{year}</TableCell>
                  {months.map(month => {
                    // Get data for this cell (would be populated with real data in production)
                    // All values are null by default
                    const cellValue = null;
                    
                    return (
                      <TableCell key={`${year}-${month}`}>
                        {cellValue !== null ? cellValue : "-"}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  // Render Comment table separately as it has a different structure (2x2)
  const renderCommentTable = () => {
    return (
      <Card className="mb-6 border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">Comments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {account.comments && account.comments.length > 0 ? (
                account.comments.map((comment, i) => (
                  <TableRow key={i}>
                    <TableCell>{/* Date would come from structured comment data */}</TableCell>
                    <TableCell>{comment}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-muted-foreground">No comments available</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Render main data tables */}
      {dataCategories.map(category => renderHistoryTable(category))}
      
      {/* Render comments table */}
      {renderCommentTable()}
      
      {showDebugInfo && (
        <div className="mt-4 p-4 bg-muted/50 rounded-md border border-dashed">
          <h4 className="text-sm font-medium mb-2">Debug Information</h4>
          <pre className="text-xs overflow-x-auto">
            {JSON.stringify(account, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default AccountHistory;
