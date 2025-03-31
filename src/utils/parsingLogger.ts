
/**
 * Utility for tracking and logging the credit report parsing process
 */

type ParsingStage = 
  | 'started' 
  | 'text-extracted' 
  | 'bureau-identified' 
  | 'summary-extracted' 
  | 'personal-info-extracted'
  | 'accounts-extracted'
  | 'credit-scores-extracted'
  | 'completed'
  | 'error';

interface ParsingLogEntry {
  timestamp: Date;
  stage: ParsingStage;
  fileSize?: number;
  textLength?: number;
  bureau?: string;
  extractionMethod?: 'ai' | 'traditional';
  duration?: number;
  success?: boolean;
  error?: string;
  details?: Record<string, any>;
}

class ParsingLogger {
  private logs: ParsingLogEntry[] = [];
  private startTime: number = 0;
  private currentReport: string = '';
  
  startParsing(fileSize?: number) {
    this.logs = [];
    this.startTime = performance.now();
    this.currentReport = Date.now().toString();
    
    this.addLog('started', { fileSize });
    return this.currentReport;
  }
  
  logTextExtraction(textLength: number) {
    this.addLog('text-extracted', { textLength });
  }
  
  logBureauIdentification(bureau: string, method: 'ai' | 'traditional') {
    this.addLog('bureau-identified', { bureau, extractionMethod: method });
  }
  
  logSummaryExtraction(success: boolean, details?: Record<string, any>) {
    this.addLog('summary-extracted', { success, details });
  }
  
  logPersonalInfoExtraction(success: boolean, details?: Record<string, any>) {
    this.addLog('personal-info-extracted', { success, details });
  }
  
  logAccountsExtraction(count: number, details?: Record<string, any>) {
    this.addLog('accounts-extracted', { count, details });
  }
  
  logCreditScoresExtraction(count: number, details?: Record<string, any>) {
    this.addLog('credit-scores-extracted', { count, details });
  }
  
  completeParsing() {
    const duration = performance.now() - this.startTime;
    this.addLog('completed', { duration });
    console.log(`Parsing completed in ${duration.toFixed(2)}ms`);
    console.table(this.getSummary());
    return this.logs;
  }
  
  logError(stage: string, error: any) {
    this.addLog('error', { 
      stage, 
      error: error?.message || String(error)
    });
    console.error(`Parsing error at stage ${stage}:`, error);
  }
  
  private addLog(stage: ParsingStage, details?: Record<string, any>) {
    this.logs.push({
      timestamp: new Date(),
      stage,
      ...details
    });
    
    // Also log to console for real-time debugging
    console.log(`[ParsingLog ${this.currentReport}] ${stage}`, details);
  }
  
  getLogs() {
    return [...this.logs];
  }
  
  getSummary() {
    const endTime = this.logs.find(log => log.stage === 'completed')?.timestamp || new Date();
    const startTime = this.logs.find(log => log.stage === 'started')?.timestamp || new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    const errors = this.logs.filter(log => log.stage === 'error');
    const textLength = this.logs.find(log => log.stage === 'text-extracted')?.textLength || 0;
    const bureau = this.logs.find(log => log.stage === 'bureau-identified')?.bureau;
    
    return {
      reportId: this.currentReport,
      startTime,
      endTime,
      durationMs: duration,
      textLength,
      bureau,
      errors: errors.length,
      successful: errors.length === 0
    };
  }
}

// Singleton instance
export const parsingLogger = new ParsingLogger();
