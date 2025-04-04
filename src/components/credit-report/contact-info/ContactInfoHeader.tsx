
import React from "react";
import { FileCog, BadgeInfo } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContactInfoHeaderProps {
  personalInfo: any;
}

const ContactInfoHeader: React.FC<ContactInfoHeaderProps> = ({ personalInfo }) => {
  const getName = () => {
    if (!personalInfo || !personalInfo.name) {
      return "No Name Available";
    }
    
    // Clean up the name, removing "formerly known as" and other extraneous information
    let name = personalInfo.name;
    
    // Remove "formerly known as" and the text after it
    name = name.split("Formerly known as")[0].trim();
    
    // Remove "Social Security Number" and the text after it
    name = name.split("Social Security Number")[0].trim();
    
    return name;
  };

  const getAddressCount = () => {
    if (!personalInfo || !personalInfo.addresses) {
      return 0;
    }
    return personalInfo.addresses.length;
  };

  const hasEmploymentInfo = () => {
    return personalInfo && personalInfo.employmentHistory;
  };

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-2">
        <FileCog className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="text-base font-medium">Contact Information</h3>
          <p className="text-sm text-muted-foreground">{getName()}</p>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="bg-muted/50 hover:bg-muted">
          {getAddressCount()} Address{getAddressCount() !== 1 ? 'es' : ''}
        </Badge>
        
        {hasEmploymentInfo() && (
          <Badge variant="outline" className="bg-muted/50 hover:bg-muted">
            <BadgeInfo className="h-3 w-3 mr-1" />
            Employment Info
          </Badge>
        )}
      </div>
    </div>
  );
};

export default ContactInfoHeader;
