import React, { useState } from "react";
import { FileText, FileImage } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SourceReportViewer from "./SourceReportViewer";

interface ExtractedSourceTabsProps {
  sessionId?: string | null;
  pageNumbers?: number[];
  children?: React.ReactNode;
  extractedContent?: React.ReactNode;
  sourceContent?: React.ReactNode;
  extractedLabel?: string;
  sourceLabel?: string;
  sourceTitle?: string;
  sourceDescription?: string;
  tabsClassName?: string;
  contentClassName?: string;
}

const ExtractedSourceTabs: React.FC<ExtractedSourceTabsProps> = ({
  sessionId,
  pageNumbers = [],
  children,
  extractedContent,
  sourceContent,
  extractedLabel = "Extracted Data",
  sourceLabel = "Source Report",
  sourceTitle,
  sourceDescription,
  tabsClassName,
  contentClassName,
}) => {
  const [activeTab, setActiveTab] = useState("extracted");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={contentClassName}>
      <TabsList className={tabsClassName}>
        <TabsTrigger value="extracted">
          <FileText className="mr-1 h-4 w-4" />
          {extractedLabel}
        </TabsTrigger>
        <TabsTrigger value="source">
          <FileImage className="mr-1 h-4 w-4" />
          {sourceLabel}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="extracted">{extractedContent ?? children}</TabsContent>
      <TabsContent value="source">
        {activeTab === "source" ? (
          sourceContent ?? (
          <SourceReportViewer
            sessionId={sessionId}
            pageNumbers={pageNumbers}
            title={sourceTitle}
            description={sourceDescription}
          />
          )
        ) : null}
      </TabsContent>
    </Tabs>
  );
};

export default ExtractedSourceTabs;
