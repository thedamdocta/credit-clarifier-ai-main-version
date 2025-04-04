
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import CollectionItem from "./CollectionItem";
import CollectionsDataDebug from "./CollectionsDataDebug";

interface CollectionsListProps {
  collections: Collection[];
  showDebugInfo: boolean;
}

const CollectionsList: React.FC<CollectionsListProps> = ({ collections, showDebugInfo }) => {
  // Sample collection data to display when no real collections are found
  const sampleCollections: Collection[] = [
    {
      dateReported: "01/15/2023",
      collectionAgency: "ABC Collection Services",
      balanceDate: "12/30/2022",
      originalCreditorName: "Credit Card Company XYZ",
      accountDesignatorCode: "O",
      dateAssigned: "09/15/2022",
      accountNumber: "XXXX1234",
      originalAmountOwed: "$1,250",
      creditorClassification: "Medical",
      amount: "$875",
      lastPaymentDate: "07/22/2022",
      statusDate: "01/10/2023",
      dateOfFirstDelinquency: "05/15/2022",
      status: "Open",
      comments: ["Account placed for collection", "Disputed by consumer"],
      contact: ["Phone: (800) 123-4567", "Email: collections@abccollect.com"]
    },
    {
      dateReported: "02/20/2023",
      collectionAgency: "XYZ Debt Recovery",
      balanceDate: "02/15/2023",
      originalCreditorName: "Regional Medical Center",
      accountDesignatorCode: "O",
      dateAssigned: "11/05/2022",
      accountNumber: "XXXX5678",
      originalAmountOwed: "$2,350",
      creditorClassification: "Medical",
      amount: "$2,350",
      lastPaymentDate: null,
      statusDate: "02/10/2023",
      dateOfFirstDelinquency: "08/20/2022",
      status: "Open",
      comments: ["Medical debt under dispute"],
      contact: ["Phone: (877) 987-6543"]
    }
  ];

  // Use real collections if available, otherwise use sample data
  const displayCollections = collections.length > 0 ? collections : sampleCollections;

  return (
    <div className="space-y-6">
      {showDebugInfo && <CollectionsDataDebug collections={collections} />}
      
      {collections.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700 text-sm">
            No real collection accounts found in your report. Displaying sample data for demonstration purposes.
          </p>
        </div>
      )}
      
      {displayCollections.map((collection, index) => (
        <CollectionItem 
          key={`collection-${index}`} 
          collection={collection} 
          index={index}
        />
      ))}
    </div>
  );
};

export default CollectionsList;
