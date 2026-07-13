import React from "react";
import { Account, MonthlyHistoryEntry } from "@/lib/types/creditReport";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PaymentHistoryLegend, {
  collectPaymentHistoryLegendCodes,
  PaymentHistoryStatusBadge,
} from "@/components/credit-report/history/PaymentHistoryLegend";

interface AccountPaymentHistoryProps {
  account: Account;
  showDebugInfo: boolean;
}

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const historySources = [
  "balanceHistory",
  "scheduledPaymentHistory",
  "actualPaymentHistory",
  "creditLimitHistory",
  "amountPastDueHistory",
  "activityDesignatorHistory",
] as const;

const hasMeaningfulPaymentCode = (value: string | undefined) => Boolean(value && value.trim() && value.trim() !== "-");

const normalizePaymentHistory = (paymentHistory: string[]): string[] => {
  const normalized = Array.isArray(paymentHistory)
    ? paymentHistory.map((value) => (hasMeaningfulPaymentCode(value) ? value.trim() : "-"))
    : [];

  const targetLength = normalized.length > 0
    ? Math.ceil(normalized.length / 12) * 12
    : 36;

  while (normalized.length < targetLength) {
    normalized.push("-");
  }

  return normalized;
};

const derivePaymentHistoryYears = (account: Account, rowCount: number): string[] => {
  const explicitYears = Array.isArray(account.paymentHistoryYears)
    ? account.paymentHistoryYears
        .map((year) => year?.trim())
        .filter((year): year is string => Boolean(year && year.length > 0))
    : [];

  if (explicitYears.length > 0) {
    const normalizedYears = [...explicitYears];
    while (normalizedYears.length < rowCount) {
      normalizedYears.push("-");
    }
    return normalizedYears.slice(0, rowCount);
  }

  const years = new Set<number>();

  historySources.forEach((field) => {
    const entries = account[field] as MonthlyHistoryEntry[] | undefined;
    entries?.forEach((entry) => {
      const year = Number.parseInt(entry?.year ?? "", 10);
      if (Number.isFinite(year)) {
        years.add(year);
      }
    });
  });

  if (years.size > 0) {
    const sortedYears = Array.from(years)
      .sort((left, right) => right - left)
      .map(String);
    while (sortedYears.length < rowCount) {
      const lastYear = Number.parseInt(sortedYears[sortedYears.length - 1] ?? "", 10);
      if (!Number.isFinite(lastYear)) {
        break;
      }
      sortedYears.push(String(lastYear - 1));
    }
    return sortedYears.slice(0, rowCount);
  }

  const reportedYear = Number.parseInt((account.dateReported ?? "").match(/\b(19|20)\d{2}\b/)?.[0] ?? "", 10);
  if (Number.isFinite(reportedYear)) {
    return Array.from({ length: rowCount }, (_, index) => String(reportedYear - index));
  }

  return Array.from({ length: rowCount }, () => "-");
};

const splitPaymentHistoryRows = (paymentHistory: string[]): string[][] => {
  const normalized = normalizePaymentHistory(paymentHistory);

  return Array.from({ length: normalized.length / 12 }, (_, rowIndex) =>
    normalized
      .slice(rowIndex * 12, rowIndex * 12 + 12)
      .map((value) => (hasMeaningfulPaymentCode(value) ? value.trim() : "-"))
  );
};

const AccountPaymentHistory: React.FC<AccountPaymentHistoryProps> = ({ account, showDebugInfo }) => {
  const paymentRows = splitPaymentHistoryRows(account.paymentHistory || []);
  const years = derivePaymentHistoryYears(account, paymentRows.length);
  const hasAnyEvidence = paymentRows.some((row) => row.some((value) => value !== "-"));
  const legendCodes = collectPaymentHistoryLegendCodes(paymentRows.flat());

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm">
            <p className="mb-2">
              Payment history is a key factor in your credit score. This table shows the extracted monthly status codes for this account.
            </p>
            <p className="text-xs text-muted-foreground">
              Cells extracted as no data available are rendered as X to match the legend and the Equifax payment-history meaning.
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
              {paymentRows.map((row, rowIndex) => (
                <TableRow key={`${years[rowIndex]}-${rowIndex}`}>
                  <TableCell className="font-medium">{years[rowIndex] ?? "-"}</TableCell>
                  {row.map((status, monthIndex) => (
                    <TableCell key={`${rowIndex}-${monthIndex}`} className="p-2 text-center">
                      <PaymentHistoryStatusBadge value={status} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!hasAnyEvidence && (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
              No payment history codes were proven for this account from the extracted payment history grid.
            </div>
          )}
        </CardContent>
      </Card>

      {showDebugInfo && (
        <div className="mt-4 rounded-md border border-dashed bg-muted/50 p-4">
          <h4 className="mb-2 text-sm font-medium">Debug Information</h4>
          <pre className="overflow-x-auto text-xs">{JSON.stringify(account.paymentHistory, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default AccountPaymentHistory;
