
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CreditReport } from "@/lib/types/creditReport";
import CollectionsHeader from "./CollectionsHeader";
import CollectionsList from "./CollectionsList";
import ExtractedSourceTabs from "../source/ExtractedSourceTabs";
import { useReportWorkspace } from "@/features/workspace/ReportWorkspaceContext";

interface CollectionsComponentProps {
  report: CreditReport;
}

const CollectionsComponent: React.FC<CollectionsComponentProps> = ({ report }) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const { advancedUiEnabled } = useReportWorkspace();
  const collections = Array.isArray(report.collections) ? report.collections : [];

  useEffect(() => {
    if (!advancedUiEnabled) {
      setShowDebugInfo(false);
    }
  }, [advancedUiEnabled]);
  
  return (
    <Card>
      <CardHeader>
        <CollectionsHeader 
          showDebugInfo={showDebugInfo} 
          toggleDebug={() => setShowDebugInfo(!showDebugInfo)} 
        />
      </CardHeader>
      <CardContent>
        <ExtractedSourceTabs
          sessionId={report.sourceSessionId}
          pageNumbers={report.sourceComponents?.collections?.pages}
          sourceTitle="Collections Source Pages"
          sourceDescription="These report pages support the extracted collections section. Some pages may also be used by other components."
          tabsClassName="mb-4"
        >
          <>
            <p className="mb-4">
              This section shows all collection accounts found in your credit report, including agency information and collection details.
            </p>
            <CollectionsList 
              collections={collections} 
              showDebugInfo={advancedUiEnabled && showDebugInfo}
              sourceSessionId={report.sourceSessionId}
            />
          </>
        </ExtractedSourceTabs>
      </CardContent>
    </Card>
  );
};

export default CollectionsComponent;
