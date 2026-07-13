
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  humanizeExtractedText,
  isNotReportedValue,
} from "@/utils/formatters/accountValueFormatters";

interface CollectionDetailsProps {
  collection: Collection;
}

const CollectionDetails: React.FC<CollectionDetailsProps> = ({ collection }) => {
  const formatDetailValue = (value: string | null | undefined) => {
    const humanized = humanizeExtractedText(value).trim();
    return humanized || "Not reported";
  };

  const details = [
    { label: "Date Reported", value: collection.dateReported },
    { label: "Balance Date", value: collection.balanceDate },
    { label: "Reporting Category", value: collection.reportingCategory },
    { label: "Legal Category", value: collection.legalCategory },
    { label: "Account Designator Code", value: collection.accountDesignatorCode },
    { label: "Date Assigned", value: collection.dateAssigned },
    { label: "Original Amount Owed", value: collection.originalAmountOwed },
    { label: "Creditor Classification", value: collection.creditorClassification },
    { label: "Last Payment Date", value: collection.lastPaymentDate },
    { label: "Status Date", value: collection.statusDate },
    { label: "Date of First Delinquency", value: collection.dateOfFirstDelinquency },
  ];
  
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium mb-2">Collection Account Details</h4>
      <Table>
        <TableBody>
          {details.map((detail, index) => (
            <TableRow key={index}>
              <TableCell className="font-medium w-1/3 py-2">{detail.label}</TableCell>
              <TableCell
                className={
                  isNotReportedValue(formatDetailValue(detail.value)) ? "py-2 text-slate-400" : "py-2"
                }
              >
                {formatDetailValue(detail.value)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CollectionDetails;
