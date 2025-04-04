
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CreditReport, Collection } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";
import CollapsibleCard from "../common/CollapsibleCard";
import { extractCollectionsTableImage, resetCollectionsTableImage } from "@/utils/pdf/extractCollectionsTableImage";
import { extractCollectionsFromImage, convertToCollections } from "@/lib/ai/collectionExtraction";
import { convertToCollection } from "@/lib/parsers/equifax/equifaxCollections";

interface CollectionsComponentProps {
  report: CreditReport;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tableImageUrl, setTableImageUrl] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [extractionAttempts, setExtractionAttempts] = useState(0);
  
  useEffect(() => {
    // Reset state when report changes
    if (report && report.reportId) {
      resetCollectionsTableImage();
      setTableImageUrl(null);
      setExtractionAttempts(0);
      
      // Initialize collections from the report data
      if (report.collections && report.collections.length > 0) {
        console.log("Using collections from report data:", report.collections);
        setCollections(report.collections);
      } else {
        setCollections([]);
        // Auto-extract collection data when no collections are in the report
        console.log("No collections in report, attempting automatic extraction");
        setTimeout(() => handleExtraction(), 500);
      }
    }
  }, [report?.reportId]);
  
  const handleExtraction = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setExtractionAttempts(prev => prev + 1);
    
    try {
      // First try to extract the table image
      console.log("Attempting to extract collections table image");
      const imageUrl = await extractCollectionsTableImage(report);
      setTableImageUrl(imageUrl);
      
      if (imageUrl) {
        // Extract collections from the image
        console.log("Extracting collections from table image");
        const extractedCollections = await extractCollectionsFromImage(imageUrl);
        
        if (extractedCollections && extractedCollections.length > 0) {
          console.log("Successfully extracted collections from image:", extractedCollections);
          setCollections(extractedCollections);
          toast.success(`Found ${extractedCollections.length} collection accounts`);
          setIsProcessing(false);
          return;
        }
      }
      
      // Image extraction failed or found no collections, try text-based extraction
      console.log("Attempting text-based collection extraction");
      if (report && report.rawText) {
        const textExtractedCollections = convertToCollection(report.rawText);
        
        if (textExtractedCollections && textExtractedCollections.length > 0) {
          console.log("Successfully extracted collections from text:", textExtractedCollections);
          setCollections(textExtractedCollections);
          toast.success(`Found ${textExtractedCollections.length} collection accounts from text`);
          setIsProcessing(false);
          return;
        }
      }
      
      // If no collections found through standard methods, check if report already has any
      if (report.collections && report.collections.length > 0) {
        console.log("Using existing collections from report data");
        setCollections(report.collections);
        toast.success("Using collections from report data");
      } else {
        console.log("No collections found in report");
        setCollections([]);
        toast.info("No collection accounts found in your report");
      }
    } catch (error) {
      console.error("Error during collections extraction:", error);
      toast.error("Error extracting collection accounts");
      
      // Fallback to any existing collections data
      if (report.collections && report.collections.length > 0) {
        setCollections(report.collections);
      }
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleExtractFromImage = async (imageUrl: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Extract collections from the image
      const extractedCollections = await extractCollectionsFromImage(imageUrl);
      
      if (extractedCollections && extractedCollections.length > 0) {
        console.log("Successfully extracted collections from image:", extractedCollections);
        setCollections(extractedCollections);
        toast.success(`Successfully extracted ${extractedCollections.length} collection accounts`);
      } else {
        console.log("No collections extracted from image, trying text extraction");
        
        // Try text-based extraction as fallback
        if (report && report.rawText) {
          const textExtractedCollections = convertToCollection(report.rawText);
          
          if (textExtractedCollections && textExtractedCollections.length > 0) {
            console.log("Successfully extracted collections from text:", textExtractedCollections);
            setCollections(textExtractedCollections);
            toast.success(`Successfully extracted ${textExtractedCollections.length} collection accounts from text`);
          } else {
            // If no collections found, check if report already has any
            if (report.collections && report.collections.length > 0) {
              setCollections(report.collections);
              toast.success("Using collections from report data");
            } else {
              setCollections([]);
              toast.info("No collection accounts found in your report");
            }
          }
        }
      }
    } catch (error) {
      console.error("Error during collections extraction:", error);
      toast.error("Error extracting collection accounts");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleRetryExtraction = async () => {
    setIsProcessing(true);
    setExtractionAttempts(prev => prev + 1);
    toast.info("Retrying collections extraction...");
    
    try {
      // Reset the image cache to force a fresh extraction
      if (extractionAttempts > 1) {
        resetCollectionsTableImage();
        setTableImageUrl(null);
      }
      
      // Get a fresh table image
      const imageUrl = await extractCollectionsTableImage(report);
      
      if (imageUrl) {
        setTableImageUrl(imageUrl);
        await handleExtractFromImage(imageUrl);
      } else {
        toast.warning("Could not extract the collections table image");
        
        // Try text-based extraction as fallback
        if (report && report.rawText) {
          const textExtractedCollections = convertToCollection(report.rawText);
          
          if (textExtractedCollections && textExtractedCollections.length > 0) {
            setCollections(textExtractedCollections);
            toast.success(`Extracted ${textExtractedCollections.length} collection accounts from text`);
          } else {
            toast.info("No collection accounts found in your report text");
          }
        }
      }
    } catch (error) {
      console.error("Error during collections extraction retry:", error);
      toast.error("Error during collections extraction");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleTrainParser = () => {
    if (collections.length === 0) {
      toast.warning("No collection data available for training");
      return;
    }
    
    toast.info("Training parser with current collections data...");
    
    // Store the current collection data as a training example
    try {
      localStorage.setItem('collections_training_data', JSON.stringify(collections));
      toast.success("Successfully saved collections data for training");
    } catch (error) {
      console.error("Error saving collections training data:", error);
      toast.error("Failed to save training data");
    }
  };
  
  const triggerPdfUpload = () => {
    const fileInput = document.querySelector('input[type="file"][accept=".pdf"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    } else {
      toast.warning("PDF upload button not found. Please use the upload button in the navigation bar.");
    }
  };

  // Use collections if they exist, otherwise an empty array
  const pdfAvailable = report && report.rawText && report.rawText.length > 0;
  
  const header = (
    <div className="flex flex-row items-center justify-between w-full">
      <CollectionsHeader 
        showDebugInfo={showDebugInfo} 
        toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
      />
      
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryExtraction}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry Extraction
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={triggerPdfUpload}
          disabled={isProcessing}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload Better PDF
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrainParser}
          disabled={isProcessing}
        >
          <Save className="h-4 w-4 mr-1" />
          Train Parser
        </Button>
      </div>
    </div>
  );

  const content = (
    <>
      <p className="mb-4">
        This section shows all collection accounts found in your credit report, including agency information and collection details.
      </p>
      
      {!pdfAvailable && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-700">
            No PDF data available. Please upload a credit report PDF to view collection accounts.
          </p>
        </div>
      )}
      
      {isProcessing ? (
        <div className="py-8 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 text-credit-blue animate-spin mb-4" />
          <p className="text-sm font-medium">
            Extracting collection data...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Please wait while we analyze your collection accounts
          </p>
        </div>
      ) : (
        <CollectionsList 
          collections={collections} 
          showDebugInfo={showDebugInfo}
          tableImageUrl={tableImageUrl}
        />
      )}
    </>
  );
  
  return (
    <CollapsibleCard header={header}>
      {content}
    </CollapsibleCard>
  );
};

export default CollectionsComponent;
