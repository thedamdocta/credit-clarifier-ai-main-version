import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PaymentHistoryLegend, {
  collectPaymentHistoryLegendCodes,
  isRecognizedPaymentHistoryCode,
  PaymentHistoryStatusBadge,
} from "@/components/credit-report/history/PaymentHistoryLegend";
import { MonthlyHistoryEntry } from "@/lib/types/creditReport";

interface EquifaxNewMonth24HistorySection {
  key?: string;
  label?: string;
  rows?: MonthlyHistoryEntry[];
}

interface EquifaxNewMonth24HistoryProps {
  sections?: EquifaxNewMonth24HistorySection[];
}

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
  "dec",
];

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const fallbackRows = (): MonthlyHistoryEntry[] => [
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

const normalizeSections = (sections?: EquifaxNewMonth24HistorySection[]): EquifaxNewMonth24HistorySection[] => {
  if (!Array.isArray(sections) || sections.length === 0) {
    return [];
  }
  return sections.map((section) => ({
    key: section?.key ?? "",
    label: section?.label ?? "History",
    rows: Array.isArray(section?.rows) && section.rows.length > 0 ? section.rows : fallbackRows(),
  }));
};

const EquifaxNewMonth24History: React.FC<EquifaxNewMonth24HistoryProps> = ({ sections }) => {
  const normalizedSections = normalizeSections(sections);

  if (!normalizedSections.length) {
    return (
      <Card className="border border-gray-200">
        <CardHeader className="py-3">
          <CardTitle className="text-md font-medium">24 Month History</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">Not reported</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {normalizedSections.map((section) => (
        (() => {
          const sectionRows = section.rows ?? fallbackRows();
          const legendCodes = collectPaymentHistoryLegendCodes(
            sectionRows.flatMap((row) => monthKeys.map((monthKey) => row[monthKey]))
          );
          const hasRecognizedStatuses = legendCodes.length > 2;

          return (
            <Card key={section.key || section.label} className="border border-gray-200">
              <CardHeader className="py-3">
                <CardTitle className="text-md font-medium">{section.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {hasRecognizedStatuses ? (
                  <div className="mb-6">
                    <PaymentHistoryLegend codes={legendCodes} />
                  </div>
                ) : null}
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
                {sectionRows.map((row, rowIndex) => (
                  <TableRow key={`${section.key}-${row.year}-${rowIndex}`}>
                    <TableCell className="font-medium">{row.year || "-"}</TableCell>
                    {monthKeys.map((monthKey) => (
                      <TableCell key={`${section.key}-${rowIndex}-${monthKey}`}>
                        {hasRecognizedStatuses && isRecognizedPaymentHistoryCode(row[monthKey])
                          ? <PaymentHistoryStatusBadge value={row[monthKey]} />
                          : (String(row[monthKey] ?? "-").trim() || "-")}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </CardContent>
            </Card>
          );
        })()
      ))}
    </div>
  );
};

export default EquifaxNewMonth24History;
