
import React, { useState, useEffect } from "react";
import { CreditReport } from "@/lib/types/creditReport";
import { getContactTableImages } from "@/lib/ai/contactInfoExtraction";
import AddressesTable from "./AddressesTable";
import EmploymentTable from "./EmploymentTable";
import ContactTableImages from "./ContactTableImages";
import { extractContactTableImages } from "./utils/contactImageExtraction";
import { prepareAddresses } from "./utils/addressPreparation";
import { prepareEmployment } from "./utils/employmentPreparation";

interface ContactInfoComponentProps {
  report: CreditReport;
}

const ContactInfoComponent: React.FC<ContactInfoComponentProps> = ({ report }) => {
  const [tableImages, setTableImages] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionAttempted, setExtractionAttempted] = useState(false);
  const [imageLoadStatus, setImageLoadStatus] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const existingImages = getContactTableImages();
    if (existingImages.length > 0) {
      console.log("Found existing contact table images:", existingImages.length);
      setTableImages(existingImages);
      setExtractionAttempted(true);
    }
  }, []);

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
    
    try {
      const newImages = await extractContactTableImages();
      setTableImages(newImages);
    } finally {
      setIsExtracting(false);
      setExtractionAttempted(true);
    }
  };

  const addresses = prepareAddresses(report);
  const employment = prepareEmployment(report);

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Previous Addresses</h3>
        <AddressesTable addresses={addresses} />
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Employment History</h3>
        <EmploymentTable employments={employment} />
      </div>
      
      <ContactTableImages 
        tableImages={tableImages}
        isExtracting={isExtracting}
        onExtractTableImages={handleExtractTableImages}
        imageLoadStatus={imageLoadStatus}
        onImageLoad={handleImageLoad}
        onImageError={handleImageError}
      />
    </div>
  );
};

export default ContactInfoComponent;
