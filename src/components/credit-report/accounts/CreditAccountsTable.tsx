import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccountSummary } from "@/lib/types/creditReport";
import { formatAccountValue, formatDollarAmount, formatPercentageValue } from "@/utils/formatters/accountValueFormatters";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CreditAccountsTableProps {
  accountSummaries: AccountSummary[];
}

const renderCellValue = (
  fieldName: "open" | "withBalance" | "totalBalance" | "available" | "creditLimit" | "debtToCredit" | "payment",
  value: string | null,
) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (fieldName === "debtToCredit") {
    return formatPercentageValue(value);
  }

  if (
    fieldName === "totalBalance" ||
    fieldName === "available" ||
    fieldName === "creditLimit" ||
    fieldName === "payment"
  ) {
    return formatDollarAmount(value);
  }

  return formatAccountValue(value);
};

const CreditAccountsTable: React.FC<CreditAccountsTableProps> = ({ accountSummaries }) => {
  const hasRows = Array.isArray(accountSummaries) && accountSummaries.length > 0;

  if (!hasRows) {
    return (
      <Alert className="bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          Credit accounts summary is unavailable for this report.
        </AlertDescription>
      </Alert>
    );
  }

  return (
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
        {accountSummaries.map((summary) => (
          <TableRow
            key={`account-summary-${summary.accountType}`}
            className={summary.accountType === "Total" ? "bg-muted/30 font-medium" : ""}
          >
            <TableCell className="font-medium">{summary.accountType}</TableCell>
            <TableCell>{renderCellValue("open", summary.open)}</TableCell>
            <TableCell>{renderCellValue("withBalance", summary.withBalance)}</TableCell>
            <TableCell>{renderCellValue("totalBalance", summary.totalBalance)}</TableCell>
            <TableCell>{renderCellValue("available", summary.available)}</TableCell>
            <TableCell>{renderCellValue("creditLimit", summary.creditLimit)}</TableCell>
            <TableCell>{renderCellValue("debtToCredit", summary.debtToCredit)}</TableCell>
            <TableCell>{renderCellValue("payment", summary.payment)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export default CreditAccountsTable;
