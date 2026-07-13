
import React from "react";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, Download, FileText, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreditReport } from "@/lib/creditReportParser";

interface CreditReportHeaderProps {
  report: CreditReport;
}

const CreditReportHeader: React.FC<CreditReportHeaderProps> = ({ report }) => {
  const getBureauColor = (bureau: string) => {
    switch (bureau) {
      case 'Equifax':
        return 'bg-credit-blue text-white';
      case 'Experian':
        return 'bg-credit-indigo text-white';
      case 'TransUnion':
        return 'bg-credit-red text-white';
      default:
        return 'bg-credit-gray text-white';
    }
  };

  const handleDownloadPDF = () => {
    // In a real implementation, this would generate and download a PDF summary
  };

  const handleShareReport = () => {
    // In a real implementation, this would open a share dialog
  };

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Credit Report
          <Badge className={getBureauColor(report.bureau)}>{report.bureau}</Badge>
        </h1>
        <div className="text-muted-foreground flex items-center mt-1">
          <Calendar className="h-4 w-4 mr-1" />
          Report Date: {report.reportDate}
        </div>
      </div>

      <div className="flex gap-2 mt-2 md:mt-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                <Download className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download report as PDF</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleShareReport}>
                <Share2 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Share</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share report</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

export default CreditReportHeader;
