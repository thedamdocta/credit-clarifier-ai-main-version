
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
  startParsing(): string {
    const reportId = `report-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'parsing_started',
      reportId,
      success: true
    });
    parsingSummary.reportId = reportId;
    parsingSummary.errors = 0;
    return reportId;
  },
  
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
  
  logTextExtraction(textLength: number) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'text_extraction',
      details: { textLength },
      success: true
    });
    parsingSummary.textLength = textLength;
  },
  
  logBureauIdentification(bureau: string, method: string) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'bureau_identification',
      details: { bureau, method },
      success: true
    });
    parsingSummary.bureau = bureau;
  },
  
  logSummaryExtraction(success: boolean, details?: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'summary_extraction',
      details,
      success
    });
  },
  
  logPersonalInfoExtraction(success: boolean, details?: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'personal_info_extraction',
      details,
      success
    });
  },
  
  logAccountsExtraction(accountCount: number) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'accounts_extraction',
      details: { accountCount },
      success: accountCount > 0
    });
  },
  
  logCreditScoresExtraction(scoreCount: number) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'credit_scores_extraction',
      details: { scoreCount },
      success: scoreCount > 0
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
  
  trackReport(report: any) {
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'report_tracking',
      report: report,
      success: true
    });
  },
  
  completeParsing() {
    const startTime = parsingSummary.startTime || Date.now() - 5000;
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    parsingLogs.push({
      timestamp: new Date(),
      stage: 'parsing_completed',
      details: {
        reportId: parsingSummary.reportId,
        durationMs,
        errors: parsingSummary.errors
      },
      success: parsingSummary.errors === 0
    });
    
    parsingSummary.durationMs = durationMs;
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
