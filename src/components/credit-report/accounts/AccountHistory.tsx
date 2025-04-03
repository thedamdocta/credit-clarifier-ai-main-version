
import React from "react";
import { Account } from "@/lib/types/creditReport";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountHistoryProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountHistory: React.FC<AccountHistoryProps> = ({ account, showDebugInfo }) => {
  // Example years for demonstration - in real implementation, these would be derived from the account data
  const years = ["2024", "2023", "2022", "2021"];
  
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
                  {months.map(month => (
                    <TableCell key={`${year}-${month}`}>
                      {/* This would be populated with real data from the account */}
                      {/* All values are null by default */}
                    </TableCell>
                  ))}
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
