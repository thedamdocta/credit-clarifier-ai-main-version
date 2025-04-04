
import React from "react";
import { Collection } from "@/lib/types/creditReport";

interface CollectionSummaryProps {
  collection: Collection;
}

const CollectionSummary: React.FC<CollectionSummaryProps> = ({ collection }) => {
  const summaryItems = [
    { label: "Collection Agency", value: collection.collectionAgency },
    { label: "Original Creditor", value: collection.originalCreditorName },
    { label: "Account Number", value: collection.accountNumber },
    { label: "Amount", value: collection.amount },
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {summaryItems.map((item, index) => (
        <div key={index} className="bg-muted/20 p-4 rounded-md">
          <div className="text-sm text-muted-foreground">{item.label}</div>
          <div className="font-medium mt-1">{item.value || "Not reported"}</div>
        </div>
      ))}
    </div>
  );
};

export default CollectionSummary;
