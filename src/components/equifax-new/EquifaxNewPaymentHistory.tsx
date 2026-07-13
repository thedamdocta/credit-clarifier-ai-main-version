import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaymentHistoryLegend, {
  collectPaymentHistoryLegendCodes,
  PaymentHistoryStatusBadge,
} from "@/components/credit-report/history/PaymentHistoryLegend";
import { MonthlyHistoryEntry } from "@/lib/types/creditReport";

interface EquifaxNewPaymentHistoryProps {
  rows?: MonthlyHistoryEntry[];
}

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const normalizeRows = (rows?: MonthlyHistoryEntry[]): MonthlyHistoryEntry[] => {
  const normalized = Array.isArray(rows)
    ? rows.filter((row) => row && String(row.year ?? "").trim())
    : [];

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
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
      dec: "-",
    },
  ];
};

const EquifaxNewPaymentHistory: React.FC<EquifaxNewPaymentHistoryProps> = ({ rows }) => {
  const normalizedRows = normalizeRows(rows);
  const legendCodes = collectPaymentHistoryLegendCodes(
    normalizedRows.flatMap((row) => monthLabels.map((_, monthIndex) => {
      const monthKey = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][monthIndex] as keyof MonthlyHistoryEntry;
      return row[monthKey];
    }))
  );

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm">
            <p className="mb-2">
              This table shows the extracted monthly payment-history codes for this Equifax account.
            </p>
            <p className="text-xs text-muted-foreground">
              Green checks in the report are mapped to OK. Empty cells are rendered as X for no data available.
            </p>
          </div>

          <div className="mb-6">
            <PaymentHistoryLegend codes={legendCodes} />
          </div>

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
              {normalizedRows.map((row, rowIndex) => (
                <TableRow key={`${row.year}-${rowIndex}`}>
                  <TableCell className="font-medium">{row.year || "-"}</TableCell>
                  {monthLabels.map((_, monthIndex) => {
                    const monthKey = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"][monthIndex] as keyof MonthlyHistoryEntry;
                    const status = String(row[monthKey] ?? "-").trim() || "-";
                    return (
                      <TableCell key={`${rowIndex}-${monthKey}`} className="p-2 text-center">
                        <PaymentHistoryStatusBadge value={status} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EquifaxNewPaymentHistory;
