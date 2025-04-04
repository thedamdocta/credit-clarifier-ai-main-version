
import React from "react";
import { Collection } from "@/lib/types/creditReport";
import CollectionItem from "./CollectionItem";
import CollectionsDataDebug from "./CollectionsDataDebug";
import { AlertTriangle } from "lucide-react";

interface CollectionsListProps {
  collections: Collection[];
  showDebugInfo: boolean;
  extractionAttempted?: boolean;
}

const CollectionsList: React.FC<CollectionsListProps> = ({ 
  collections, 
  showDebugInfo,
  extractionAttempted = false
}) => {
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
      
      {collections.length === 0 && extractionAttempted && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-green-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Good news!</h3>
              <div className="mt-2 text-sm text-green-700">
                <p>No collection accounts were found in your credit report. This is positive for your credit profile.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {collections.length === 0 && !extractionAttempted && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700 text-sm">
            No collection accounts found in your report. Displaying null values for testing.
          </p>
        </div>
      )}
      
      {collections.length > 0 && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-amber-800">Collection accounts found</h3>
              <div className="mt-2 text-sm text-amber-700">
                <p>Your credit report shows {collections.length} collection account(s). These can significantly impact your credit score.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {(collections.length > 0 || !extractionAttempted) && (
        displayCollections.map((collection, index) => (
          <CollectionItem 
            key={`collection-${index}`} 
            collection={collection} 
            index={index}
          />
        ))
      )}
    </div>
  );
};

export default CollectionsList;
