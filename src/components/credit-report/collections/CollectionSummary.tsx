
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import {
  humanizeExtractedText,
  isNotReportedValue,
} from "@/utils/formatters/accountValueFormatters";

interface CollectionSummaryProps {
  collection: Collection;
}

const CollectionSummary: React.FC<CollectionSummaryProps> = ({ collection }) => {
  const formatValue = (value?: string | null) => {
    const humanized = humanizeExtractedText(value).trim();
    return humanized || "Not reported";
  };

  const summaryItems = [
    { label: "Collection Agency", value: formatValue(collection.collectionAgency) },
    { label: "Original Creditor", value: formatValue(collection.originalCreditorName) },
    { label: "Subtype", value: formatValue(collection.accountSubtype) },
    { label: "Account Number", value: formatValue(collection.accountNumber) },
    { label: "Amount", value: formatValue(collection.amount) },
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {summaryItems.map((item, index) => (
        <div key={index} className="bg-muted/20 p-4 rounded-md">
          <div className="text-sm text-muted-foreground">{item.label}</div>
          <div className={isNotReportedValue(item.value || "Not reported") ? "mt-1 font-normal text-slate-400" : "font-medium mt-1"}>
            {item.value || "Not reported"}
          </div>
        </div>
      ))}
    </div>
  );
};

export default CollectionSummary;
