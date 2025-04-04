
import React from "react";
import { PersonalInfo } from "@/lib/types/creditReport";
import { User, FileText } from "lucide-react";
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
      
      {personalInfo.addresses.length > 1 && (
        <Badge variant="outline" className="ml-auto">
          {personalInfo.addresses.length} Addresses
        </Badge>
      )}
      
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
