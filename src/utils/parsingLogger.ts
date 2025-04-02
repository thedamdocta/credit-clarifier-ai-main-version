
// Simple class for logging parsing activities

class ParsingLogger {
  private logs: any[] = [];
  private parsingStartTime: number = 0;
  private reportId: string = '';
  private textLength: number = 0;
  private bureau: string = '';
  private errorsCount: number = 0;
  private currentReport: any = null;

  startParsing() {
    this.parsingStartTime = Date.now();
    this.reportId = `report-${Math.random().toString(36).substring(2, 9)}`;
    this.logs = [];
    this.errorsCount = 0;
    this.currentReport = null;
    
    this.logs.push({
      timestamp: Date.now(),
      stage: 'start',
      details: { reportId: this.reportId }
    });
    
    return this.reportId;
  }

  logTextExtraction(textLength: number) {
    this.textLength = textLength;
    this.logs.push({
      timestamp: Date.now(),
      stage: 'text-extraction',
      details: { chars: textLength }
    });
  }

  logBureauIdentification(bureau: string, method: 'traditional' | 'ai') {
    this.bureau = bureau;
    this.logs.push({
      timestamp: Date.now(),
      stage: 'bureau-identification',
      details: { bureau, method }
    });
  }

  logPersonalInfoExtraction(success: boolean, details?: any) {
    this.logs.push({
      timestamp: Date.now(),
      stage: 'personal-info-extraction',
      success,
      details
    });
  }

  logSummaryExtraction(success: boolean, details?: any) {
    this.logs.push({
      timestamp: Date.now(),
      stage: 'report-summary',
      success,
      details
    });
  }

  logAccountsExtraction(count: number, details?: any) {
    this.logs.push({
      timestamp: Date.now(),
      stage: 'accounts-extraction',
      details: { count, ...(details || {}) }
    });
  }
  
  logAccountSummariesExtraction(accountSummaries: any[]) {
    this.logs.push({
      timestamp: Date.now(),
      stage: 'account-summaries-extraction',
      details: { 
        count: accountSummaries.length,
        summaries: accountSummaries 
      }
    });
    
    // Update the current report with account summaries if it exists
    if (this.currentReport) {
      this.currentReport.accountSummaries = accountSummaries;
      
      // Log the updated report
      this.logs.push({
        timestamp: Date.now(),
        stage: 'report-update',
        report: this.currentReport
      });
    }
  }

  logCreditScoresExtraction(count: number) {
    this.logs.push({
      timestamp: Date.now(),
      stage: 'credit-scores-extraction',
      details: { count }
    });
  }

  logError(stage: string, error: any) {
    this.errorsCount++;
    this.logs.push({
      timestamp: Date.now(),
      stage: 'error',
      details: { stage },
      error: error?.message || String(error)
    });
  }
  
  // Track the current report being processed
  trackReport(report: any) {
    this.currentReport = report;
    this.logs.push({
      timestamp: Date.now(),
      stage: 'report-tracking',
      report
    });
  }
  
  // Add the logEvent method directly to the class
  logEvent(message: string, details?: any) {
    this.logs.push({
      timestamp: Date.now(),
      stage: 'general',
      message,
      details
    });
  }

  completeParsing() {
    const duration = Date.now() - this.parsingStartTime;
    this.logs.push({
      timestamp: Date.now(),
      stage: 'complete',
      details: { durationMs: duration }
    });
  }

  getLogs() {
    return this.logs;
  }

  // Added method to get events (same as getLogs but renamed for compatibility)
  getEvents() {
    return this.logs;
  }

  // Added method to clear events
  clearEvents() {
    this.logs = [];
    return true;
  }

  getSummary() {
    return {
      reportId: this.reportId,
      textLength: this.textLength,
      bureau: this.bureau,
      durationMs: Date.now() - this.parsingStartTime,
      errors: this.errorsCount
    };
  }
}

// Create a singleton instance
export const parsingLogger = new ParsingLogger();
