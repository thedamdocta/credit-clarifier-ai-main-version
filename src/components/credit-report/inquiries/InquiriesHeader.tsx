
import React from "react";
import { FileSearch } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface InquiriesHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const InquiriesHeader: React.FC<InquiriesHeaderProps> = ({ 
  showDebugInfo, 
  toggleDebug 
}) => {
  return (
    <div className="flex items-center gap-2">
      <FileSearch className="h-6 w-6" />
      <div>
        <h3 className="text-lg font-semibold leading-none">Inquiries</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Companies that have requested your credit information
        </p>
      </div>
      <div className="ml-4 flex items-center space-x-2">
        <Switch
          id="inquiries-debug-mode"
          checked={showDebugInfo}
          onCheckedChange={toggleDebug}
          className="scale-75"
        />
        <Label htmlFor="inquiries-debug-mode" className="text-xs">Show Debug</Label>
      </div>
    </div>
  );
};

export default InquiriesHeader;
