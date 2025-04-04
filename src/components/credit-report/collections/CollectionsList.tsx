
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import CollectionItem from "./CollectionItem";
import CollectionsDataDebug from "./CollectionsDataDebug";

interface CollectionsListProps {
  collections: Collection[];
  showDebugInfo: boolean;
}

const CollectionsList: React.FC<CollectionsListProps> = ({ collections, showDebugInfo }) => {
  // Create a null collection placeholder when no real collections exist
  const nullCollection: Collection = {
    dateReported: null,
    collectionAgency: null,
    balanceDate: null,
    originalCreditorName: null,
    accountDesignatorCode: null,
    dateAssigned: null,
    accountNumber: null,
    originalAmountOwed: null,
    creditorClassification: null,
    amount: null,
    lastPaymentDate: null,
    statusDate: null,
    dateOfFirstDelinquency: null,
    status: null,
    comments: [],
    contact: []
  };

  // Use nullCollection if no real collections are found - now just one sample instead of two
  const displayCollections = collections.length > 0 ? collections : [nullCollection];

  return (
    <div className="space-y-6">
      {showDebugInfo && <CollectionsDataDebug collections={collections} />}
      
      {collections.length === 0 && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700 text-sm">
            No real collection accounts found in your report. Displaying null values for testing.
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
