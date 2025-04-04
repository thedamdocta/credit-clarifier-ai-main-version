
import React from "react";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

interface ContactInfoHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const ContactInfoHeader: React.FC<ContactInfoHeaderProps> = ({
  showDebugInfo,
  toggleDebug
}) => {
  return (
    <div className="flex flex-col space-y-1">
      <CardTitle className="flex items-center space-x-2">
        <span>Contact Information</span>
        <Button 
          variant="outline" 
          size="sm" 
          className="ml-2 h-7" 
          onClick={toggleDebug}
        >
          <Bug className="h-4 w-4 mr-1" />
          {showDebugInfo ? "Hide Debug" : "Debug"}
        </Button>
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        Previous addresses and employment information from your credit report
      </p>
    </div>
  );
};

export default ContactInfoHeader;
