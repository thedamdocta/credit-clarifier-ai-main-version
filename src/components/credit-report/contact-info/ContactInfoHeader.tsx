
import React from "react";
import { PersonalInfo } from "@/lib/types/creditReport";
import { User, FileText, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContactInfoHeaderProps {
  personalInfo: PersonalInfo;
  showDebugInfo?: boolean;
  toggleDebug?: () => void;
}

const ContactInfoHeader: React.FC<ContactInfoHeaderProps> = ({ 
  personalInfo,
  showDebugInfo = false,
  toggleDebug 
}) => {
  // Add check to ensure personalInfo exists and has addresses
  const addressCount = personalInfo?.addresses?.length || 0;
  const hasEmployment = personalInfo?.employmentHistory && personalInfo.employmentHistory.trim() !== '';

  return (
    <div className="flex items-center space-x-4">
      <User className="h-5 w-5 text-muted-foreground" />
      <div>
        <h3 className="text-lg font-medium leading-none">
          Contact Information
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Address history and employment details
        </p>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex gap-2">
        {addressCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {addressCount} {addressCount === 1 ? 'Address' : 'Addresses'}
          </Badge>
        )}
        
        {hasEmployment && (
          <Badge variant="outline" className="text-xs flex items-center">
            <Building className="h-3 w-3 mr-1" />
            Employment
          </Badge>
        )}
      </div>
      
      {showDebugInfo !== undefined && toggleDebug && (
        <button 
          onClick={toggleDebug}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center"
        >
          <FileText className="h-3 w-3 mr-1" />
          {showDebugInfo ? "Hide Details" : "Show Details"}
        </button>
      )}
    </div>
  );
};

export default ContactInfoHeader;
