
import React, { useState, useEffect } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { Table, TableHead, TableHeader, TableRow, TableBody, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Home, Loader2, ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContactTableImages, extractContactInfoTables } from "@/lib/ai/contactInfoExtraction";
import { toast } from "sonner";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [activeTab, setActiveTab] = useState("addresses");
  const [tableImages, setTableImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionAttempted, setExtractionAttempted] = useState(false);
  const [imageLoadStatus, setImageLoadStatus] = useState<Record<number, boolean>>({});
  const [enlargeImage, setEnlargeImage] = useState(false);

  useEffect(() => {
    // Get any existing extracted images on component mount
    const existingImages = getContactTableImages();
    if (existingImages.length > 0) {
      console.log("Found existing contact table images:", existingImages.length);
      setTableImages(existingImages);
      setExtractionAttempted(true);
    }
  }, []);

  // Track image load status
  const handleImageLoad = (index: number) => {
    setImageLoadStatus(prev => ({ ...prev, [index]: true }));
    console.log(`Contact table image ${index} loaded successfully`);
  };

  const handleImageError = (index: number) => {
    setImageLoadStatus(prev => ({ ...prev, [index]: false }));
    console.error(`Contact table image ${index} failed to load`);
  };

  const handleExtractTableImages = async () => {
    if (isExtracting) return;
    
    setIsExtracting(true);
    toast.info("Attempting to extract contact information tables...");
    
    try {
      // Access the PDF document from the window object (set during PDF processing)
      const pdfData = (window as any).currentPdfDocument;
      
      if (!pdfData) {
        toast.error("PDF document not available for extraction");
        console.error("No PDF document available in window.currentPdfDocument");
        setIsExtracting(false);
        setExtractionAttempted(true);
        return;
      }

      console.log("Starting contact table extraction from PDF");
      const result = await extractContactInfoTables(pdfData);
      
      // Update the images array after extraction
      const newImages = getContactTableImages();
      setTableImages(newImages);
      
      if (newImages.length > 0) {
        toast.success(`Successfully extracted ${newImages.length} contact table images`);
        console.log("Contact table images extracted:", newImages.length);
      } else {
        toast.warning("No contact table images could be extracted");
        console.warn("No contact table images were extracted");
      }
    } catch (error) {
      console.error("Error extracting contact table images:", error);
      toast.error("Failed to extract contact table images");
    } finally {
      setIsExtracting(false);
      setExtractionAttempted(true);
    }
  };

  // Format address for display
  const formatAddress = (address: string) => {
    // Remove any "Current" or "Former" prefixes that might have been captured
    return address.replace(/^(current|former)\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}\s+/i, '');
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="addresses" className="flex items-center">
            <Home className="h-4 w-4 mr-2" />
            Addresses
          </TabsTrigger>
          <TabsTrigger value="employment" className="flex items-center">
            <Briefcase className="h-4 w-4 mr-2" />
            Employment
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="addresses" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              {report.personalInfo && report.personalInfo.addresses && report.personalInfo.addresses.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date Reported</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.personalInfo.addresses.map((address, index) => {
                      // Check if this is actually an address with status info
                      const isAddressObj = typeof address === 'object' && address !== null && 'address' in address;
                      
                      if (isAddressObj) {
                        const addressObj = address as any;
                        return (
                          <TableRow key={`address-${index}`}>
                            <TableCell>{formatAddress(addressObj.address)}</TableCell>
                            <TableCell>{addressObj.status || 'Unknown'}</TableCell>
                            <TableCell>{addressObj.dateReported || 'Unknown'}</TableCell>
                          </TableRow>
                        );
                      } else {
                        // Simple string address without status info
                        let status = 'Unknown';
                        let dateReported = '';
                        
                        // Try to extract status from the address string
                        if (typeof address === 'string') {
                          if (address.toLowerCase().includes('current')) {
                            status = 'Current';
                          } else if (address.toLowerCase().includes('former')) {
                            status = 'Former';
                          }
                          
                          // Try to extract date from the address string
                          const dateMatch = address.match(/(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}/i);
                          if (dateMatch) {
                            dateReported = dateMatch[0];
                          }
                        }
                        
                        return (
                          <TableRow key={`address-${index}`}>
                            <TableCell>{formatAddress(String(address))}</TableCell>
                            <TableCell>{status}</TableCell>
                            <TableCell>{dateReported}</TableCell>
                          </TableRow>
                        );
                      }
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No address information available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="employment" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              {report.personalInfo && report.personalInfo.employmentHistory ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Occupation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{report.personalInfo.employmentHistory}</TableCell>
                      <TableCell>Not specified</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No employment information available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Table Image Extraction and Display Section */}
      <div className="mt-6 border rounded-lg p-3 bg-gray-50 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-medium">Contact Information Images</h3>
          <div className="flex gap-2">
            {tableImages.length > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setEnlargeImage(!enlargeImage)}
              >
                {enlargeImage ? (
                  <>
                    <ZoomOut className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Reduce</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="h-3.5 w-3.5 mr-1" />
                    <span className="text-xs">Enlarge</span>
                  </>
                )}
              </Button>
            )}
            
            <Button
              variant="default"
              size="sm"
              onClick={handleExtractTableImages}
              disabled={isExtracting}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isExtracting ? 'animate-spin' : ''}`} />
              <span className="text-xs">{isExtracting ? 'Extracting...' : 'Extract Tables'}</span>
            </Button>
          </div>
        </div>
        
        {tableImages.length > 0 ? (
          <div className="space-y-4">
            {tableImages.map((imageUrl, index) => (
              <div key={`contact-img-${index}`} className="border rounded-md overflow-hidden bg-white">
                <div className="bg-muted/30 p-2 flex justify-between items-center">
                  <span className="text-xs font-medium">Contact Table Image {index + 1}</span>
                  <span className="text-xs">
                    {imageLoadStatus[index] === true && (
                      <span className="text-green-600">✓ Loaded</span>
                    )}
                    {imageLoadStatus[index] === false && (
                      <span className="text-red-500">✗ Failed</span>
                    )}
                    {imageLoadStatus[index] === undefined && (
                      <span className="text-amber-500">⋯ Loading</span>
                    )}
                  </span>
                </div>
                <div className={`relative overflow-auto ${enlargeImage ? 'h-[500px]' : 'h-[250px]'}`}>
                  <img 
                    src={imageUrl} 
                    alt={`Contact information table ${index + 1}`} 
                    className={`max-w-full ${enlargeImage ? 'h-auto' : 'h-full'} object-contain mx-auto`}
                    onLoad={() => handleImageLoad(index)}
                    onError={() => handleImageError(index)}
                  />
                </div>
                <div className="p-2 flex justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={imageUrl} target="_blank" rel="noopener noreferrer">
                      View Full Image
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 border rounded-md bg-white">
            {isExtracting ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Extracting contact information tables...</p>
              </div>
            ) : extractionAttempted ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No contact information tables were extracted.</p>
                <p className="text-xs text-muted-foreground mt-1">Try clicking "Extract Tables" to attempt extraction again.</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Click "Extract Tables" to extract contact information tables from the PDF.</p>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-2 text-xs text-muted-foreground">
          <p>This feature extracts contact information tables from the PDF to improve data accuracy.</p>
        </div>
      </div>
    </div>
  );
};

export default ContactInfoComponent;
