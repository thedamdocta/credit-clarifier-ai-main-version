
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Bug, RefreshCw } from "lucide-react";
import TableImageDisplay from "../accounts/TableImageDisplay";
import CollectionsTable from "./CollectionsTable";
import CollectionsDataDebug from "./CollectionsDataDebug";
import { Collection, CreditReport } from "@/lib/types/creditReport";

interface CollectionsComponentProps {
  report: CreditReport;
  showDebugInfo?: boolean;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ 
  report, 
  showDebugInfo = false 
}) => {
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>(report?.collections || []);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractionFailed, setExtractionFailed] = useState<boolean>(false);

  // Function to handle data extraction from the image
  const handleDataExtracted = (extractedCollections: Collection[]) => {
    console.log("Collections data extracted:", extractedCollections);
    setCollections(extractedCollections);
    setExtractionFailed(extractedCollections.length === 0);
  };

  // Placeholder for extraction retry functionality
  const handleRetryExtraction = () => {
    setIsProcessing(true);
    // Future implementation will extract collections data
    setTimeout(() => {
      setIsProcessing(false);
      console.log("Collection extraction retry attempted");
    }, 1000);
  };

  // Sample function to simulate table image URL extraction
  useEffect(() => {
    if (report && report.rawText) {
      // In the future, this will be replaced with actual extraction logic
      const sampleImageUrl = "/lovable-uploads/458643ea-a052-40a4-a3fd-e8a38ddec467.png";
      setTableImageUrl(sampleImageUrl);
    }
  }, [report]);

  return (
    <Card className="mb-6 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-primary">Collections</CardTitle>
          <div className="flex gap-2">
            {showDebugInfo && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRetryExtraction}
                disabled={isProcessing}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Extraction
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log("Upload better PDF clicked")}
            >
              Upload Better PDF
            </Button>
            {showDebugInfo && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => console.log("Train Parser clicked")}
              >
                <Bug className="mr-2 h-4 w-4" />
                Train Parser
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          Collection accounts reported on your credit file
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Display extracted table image in debug mode */}
        {showDebugInfo && (
          <TableImageDisplay
            imageUrl={tableImageUrl}
            showDebugInfo={showDebugInfo}
            onDataExtracted={handleDataExtracted}
          />
        )}

        {collections && collections.length > 0 ? (
          <CollectionsTable collections={collections} />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center border rounded-lg bg-muted/30">
            <AlertCircle className="w-12 h-12 mb-2 text-muted-foreground" />
            <h3 className="mb-1 text-lg font-medium">No Collection Accounts Found</h3>
            <p className="text-sm text-muted-foreground">
              {extractionFailed
                ? "Failed to extract collection data. Please try uploading a clearer PDF."
                : "No collection accounts were detected in your credit report."}
            </p>
          </div>
        )}

        {/* Debug information display */}
        {showDebugInfo && (
          <CollectionsDataDebug
            showDebugInfo={showDebugInfo}
            tableImageUrl={tableImageUrl}
            collections={collections}
            isProcessing={isProcessing}
            extractionFailed={extractionFailed}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CollectionsComponent;
