
// Create this new file to store parsing logs
const parsingLogs: any[] = [];
let parsingSummary: any = {
  reportId: null,
  bureau: null,
  textLength: 0,
  durationMs: 0,
  errors: 0
};

export const parsingLogger = {
  logEvent(stage: string, details?: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage,
      details,
    });
  },
  
  logError(stage: string, error: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage,
      error: error.toString(),
      details: { stack: error.stack },
      success: false
    });
    parsingSummary.errors++;
  },
  
  logSuccess(stage: string, details?: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage,
      details,
      success: true
    });
  },
  
  logReportExtraction(reportId: string, bureau: string, textLength: number, durationMs: number) {
    parsingSummary = {
      reportId,
      bureau,
      textLength,
      durationMs,
      errors: parsingSummary.errors
    };
    
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'report_extracted',
      details: {
        reportId,
        bureau,
        textLength,
        durationMs
      },
      success: true
    });
  },
  
  logAccountSummariesExtraction(summaries: any[]) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'account_summaries_extracted',
      details: {
        count: summaries.length,
      },
      summaries: summaries,
      success: true
    });
  },
  
  logExtractedReport(report: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'final_report',
      report: report,
      success: true
    });
  },
  
  logTableImageExtracted(imageUrl: string) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'table_image_extracted',
      tableImageUrl: imageUrl,
      success: true
    });
  },
  
  getLogs() {
    return [...parsingLogs];
  },
  
  getSummary() {
    return { ...parsingSummary };
  },
  
  clearLogs() {
    parsingLogs.length = 0;
    parsingSummary = {
      reportId: null,
      bureau: null,
      textLength: 0,
      durationMs: 0,
      errors: 0
    };
  }
};
