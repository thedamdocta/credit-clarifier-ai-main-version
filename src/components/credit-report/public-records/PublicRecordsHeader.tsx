
import React from "react";
import { CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Bug } from "lucide-react";

interface PublicRecordsHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const PublicRecordsHeader: React.FC<PublicRecordsHeaderProps> = ({ 
  showDebugInfo, 
  toggleDebug 
}) => {
  return (
    <>
      <div>
        <CardTitle className="flex items-center">
          <AlertTriangle className="h-5 w-5 mr-2" />
          Public Records
        </CardTitle>
        <CardDescription>Legal and financial public records that may appear on your credit report</CardDescription>
      </div>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={toggleDebug}
        className="flex items-center text-xs"
      >
        <Bug className="h-3 w-3 mr-1" />
        {showDebugInfo ? "Hide Debug" : "Show Debug"}
      </Button>
    </>
  );
};

export default PublicRecordsHeader;
