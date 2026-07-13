
import React from "react";
import { Database } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";

interface CollectionsHeaderProps {
  showDebugInfo: boolean;
  toggleDebug: () => void;
}

const CollectionsHeader: React.FC<CollectionsHeaderProps> = ({ 
  showDebugInfo, 
  toggleDebug 
}) => {
  const { advancedUiEnabled } = useReportWorkspace();

  return (
    <div className="flex items-center gap-2">
      <Database className="h-6 w-6" />
      <div>
        <h3 className="text-lg font-semibold leading-none">Collections</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Collection accounts on your credit report
        </p>
      </div>
      {advancedUiEnabled ? (
        <div className="ml-4 flex items-center space-x-2">
          <Switch
            id="debug-mode"
            checked={showDebugInfo}
            onCheckedChange={toggleDebug}
            className="scale-75"
          />
          <Label htmlFor="debug-mode" className="text-xs">Show Debug</Label>
        </div>
      ) : null}
    </div>
  );
};

export default CollectionsHeader;
