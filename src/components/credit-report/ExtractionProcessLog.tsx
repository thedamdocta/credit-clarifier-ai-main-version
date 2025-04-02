
import React, { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ExtractionProcessLogProps {
  isVisible: boolean;
}

const ExtractionProcessLog: React.FC<ExtractionProcessLogProps> = ({ isVisible }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string>('');

  useEffect(() => {
    if (isVisible && !isSubscribed) {
      setIsSubscribed(true);
      
      // Add initial logs
      setLogs([
        { 
          message: "Starting extraction process...", 
          timestamp: new Date(), 
          type: 'info' 
        }
      ]);
      
      // Setup a listener for console messages to capture processing events
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;
      
      const logCapture = (message: any, type: 'info' | 'success' | 'error' | 'warning') => {
        if (typeof message === 'string') {
          setLogs(prevLogs => [
            ...prevLogs, 
            { 
              message: String(message), 
              timestamp: new Date(), 
              type 
            }
          ].slice(-100)); // Keep only the last 100 logs for performance
          
          // Update current operation based on specific keywords
          if (type === 'info') {
            if (message.includes('Processing PDF document')) {
              setCurrentOperation('Initializing PDF processing...');
            } else if (message.includes('PDF loaded with')) {
              setCurrentOperation('PDF document loaded successfully');
            } else if (message.includes('Extracting images')) {
              setCurrentOperation('Extracting images from PDF...');
            } else if (message.includes('text extraction')) {
              setCurrentOperation('Extracting text from PDF...');
            } else if (message.includes('Parsing PDF content')) {
              setCurrentOperation('Analyzing credit report data...');
            } else if (message.includes('Bureau identified')) {
              setCurrentOperation('Credit bureau identified');
            } else if (message.includes('AI-first parsing')) {
              setCurrentOperation('Processing with AI models...');
            } else if (message.includes('Loading NER model')) {
              setCurrentOperation('Setting up AI models for data extraction...');
            }
          }
        }
      };
      
      console.log = (...args) => {
        originalConsoleLog(...args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        
        // Filter only relevant extraction messages to avoid overwhelming the user
        if (message.includes('extract') || 
            message.includes('process') || 
            message.includes('table') || 
            message.includes('account') || 
            message.includes('PDF') ||
            message.includes('image') ||
            message.includes('text') ||
            message.includes('AI') ||
            message.includes('parsing') ||
            message.includes('bureau') ||
            message.includes('model')) {
          logCapture(message, 'info');
        }
      };
      
      console.error = (...args) => {
        originalConsoleError(...args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        logCapture(`Error: ${message}`, 'error');
      };
      
      console.warn = (...args) => {
        originalConsoleWarn(...args);
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ');
        logCapture(`Warning: ${message}`, 'warning');
      };
      
      // Events we know should trigger success messages
      const successEvents = [
        'Successfully extracted image',
        'Identified bureau',
        'Successfully extracted',
        'Table detected',
        'Found account summaries',
        'text extraction complete',
        'PDF loaded with',
        'bureau identified',
        'Extracted text from PDF',
        'PDF successfully processed'
      ];
      
      // Check regularly for success events
      const checkSuccessInterval = setInterval(() => {
        setLogs(prevLogs => {
          const lastLog = prevLogs[prevLogs.length - 1];
          if (lastLog && successEvents.some(event => lastLog.message.toLowerCase().includes(event.toLowerCase()))) {
            return [
              ...prevLogs,
              {
                message: `✓ ${lastLog.message.substring(0, 50)}... completed`,
                timestamp: new Date(),
                type: 'success'
              }
            ];
          }
          return prevLogs;
        });
      }, 1500);
      
      return () => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
        clearInterval(checkSuccessInterval);
        setIsSubscribed(false);
      };
    }
  }, [isVisible, isSubscribed]);

  if (!isVisible) return null;

  return (
    <Card className="border-t-4 border-t-blue-500 bg-blue-50/50 mt-4">
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {currentOperation && (
              <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-full border shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-blue-800">{currentOperation}</span>
              </div>
            )}
          </h3>
          <Badge variant="outline" className="text-xs">
            {logs.length} events
          </Badge>
        </div>
        
        <ScrollArea className="h-[200px] w-full rounded border p-2 bg-white">
          <div className="space-y-0.5">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`text-xs py-1 border-l-2 pl-2 ${
                  log.type === 'error' ? 'border-red-500 text-red-600 bg-red-50' :
                  log.type === 'success' ? 'border-green-500 text-green-600 bg-green-50' :
                  log.type === 'warning' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' :
                  'border-blue-500 bg-blue-50/50'
                }`}
              >
                <div className="flex items-start">
                  <span className="text-slate-500 mr-2 min-w-[60px] text-[10px]">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                  <span className="mr-1.5">
                    {log.type === 'error' ? <AlertCircle className="h-3 w-3 text-red-500" /> : 
                     log.type === 'success' ? <CheckCircle className="h-3 w-3 text-green-500" /> :
                     log.type === 'warning' ? <AlertCircle className="h-3 w-3 text-yellow-500" /> :
                     <Info className="h-3 w-3 text-blue-500" />}
                  </span>
                  <span className="flex-1 break-all">{log.message}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </Card>
  );
};

export default ExtractionProcessLog;
