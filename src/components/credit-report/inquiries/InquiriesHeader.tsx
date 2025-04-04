
import React from "react";
import { CardTitle } from "@/components/ui/card";
import { AlertCircle, BadgeInfo } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

interface InquiriesHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const InquiriesHeader: React.FC<InquiriesHeaderProps> = ({ showDebugInfo, toggleDebug }) => {
  return (
    <div className="flex items-center space-x-2">
      <AlertCircle className="h-5 w-5 text-credit-blue" />
      <CardTitle className="text-lg">Inquiries</CardTitle>
      
      <Toggle
        variant="outline"
        aria-label="Toggle debug information"
        pressed={showDebugInfo}
        onPressedChange={toggleDebug}
        className="ml-auto h-8 px-2 text-xs"
      >
        <BadgeInfo className="h-3.5 w-3.5 mr-1" />
        Debug Info
      </Toggle>
    </div>
  );
};

export default InquiriesHeader;
