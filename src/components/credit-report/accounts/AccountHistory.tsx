
import React, { useMemo } from "react";
import { Account, MonthlyHistoryEntry } from "@/lib/types/creditReport";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AccountHistoryProps {
  account: Account;
  showDebugInfo: boolean;
}

const AccountHistory: React.FC<AccountHistoryProps> = ({ account, showDebugInfo }) => {
  type HistoryField = keyof Pick<
    Account,
    | "balanceHistory"
    | "scheduledPaymentHistory"
    | "actualPaymentHistory"
    | "creditLimitHistory"
    | "amountPastDueHistory"
    | "activityDesignatorHistory"
  >;

  const historyConfigs: { title: string; field: HistoryField }[] = [
    { title: "Balance History", field: "balanceHistory" },
    { title: "Scheduled Payment History", field: "scheduledPaymentHistory" },
    { title: "Actual Payment History", field: "actualPaymentHistory" },
    { title: "Credit Limit History", field: "creditLimitHistory" },
    { title: "Amount Past Due History", field: "amountPastDueHistory" },
    { title: "Activity Designator History", field: "activityDesignatorHistory" }
  ];

  const monthKeys: (keyof MonthlyHistoryEntry)[] = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ];

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const placeholderRow: MonthlyHistoryEntry = useMemo(
    () => ({
      year: "-",
      jan: "-",
      feb: "-",
      mar: "-",
      apr: "-",
      may: "-",
      jun: "-",
      jul: "-",
      aug: "-",
      sep: "-",
      oct: "-",
      nov: "-",
      dec: "-"
    }),
    []
  );

  const placeholderRows: MonthlyHistoryEntry[] = useMemo(
    () => [placeholderRow, { ...placeholderRow }, { ...placeholderRow }],
    [placeholderRow]
  );

  const renderHistoryTable = (config: { title: string; field: HistoryField }) => {
    const historyEntries = (account[config.field] as MonthlyHistoryEntry[] | undefined) ?? [];
    const rows = historyEntries.length > 0 ? historyEntries : placeholderRows;

    return (
      <Card key={config.field} className="mb-6 border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">{config.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Year</TableHead>
                {monthLabels.map((label) => (
                  <TableHead key={label}>{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell className="font-medium">{row.year || "-"}</TableCell>
                  {monthKeys.map((monthKey, monthIndex) => (
                    <TableCell key={`${rowIndex}-${monthKey}-${monthIndex}`}>
                      {(row[monthKey] as string | undefined) && row[monthKey]?.toString().trim() !== ""
                        ? row[monthKey]
                        : "-"}
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

  return (
    <div className="space-y-4">
      {historyConfigs.map((config) => renderHistoryTable(config))}

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
