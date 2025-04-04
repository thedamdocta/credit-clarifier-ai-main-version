
import React, { useState } from "react";
import { CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

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
          variant="ghost" 
          size="icon" 
          className="h-6 w-6" 
          onClick={toggleDebug}
        >
          {showDebugInfo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </CardTitle>
      <p className="text-sm text-muted-foreground">
        Previous addresses and employment information from your credit report
      </p>
    </div>
  );
};

export default ContactInfoHeader;
