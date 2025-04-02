
import React, { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, Info, Cpu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isModelLoading, getModelLoadingDuration, resetModelLoadingState } from "@/lib/ai/modelPipelines";
import { toast } from "sonner";

interface LogEntry {
  message: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning' | 'progress';
}

interface ExtractionProcessLogProps {
  isVisible: boolean;
}

const ExtractionProcessLog: React.FC<ExtractionProcessLogProps> = ({ isVisible }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [currentOperation, setCurrentOperation] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [modelLoadingTime, setModelLoadingTime] = useState<number | null>(null);
  const [modelLoadingProgress, setModelLoadingProgress] = useState(0);
  const [modelLoadingTimeout, setModelLoadingTimeout] = useState(false);

  // Check if model is loading and update UI accordingly
  useEffect(() => {
    if (!isVisible) return;
    
    let interval: NodeJS.Timeout;
    
    if (isModelLoading()) {
      setModelLoadingTime(Date.now());
      
      interval = setInterval(() => {
        const duration = getModelLoadingDuration();
        
        // Calculate a visual progress that maxes out at 90%
        // since we don't know the actual progress
        const visualProgress = Math.min(90, duration * 1.5);
        setModelLoadingProgress(visualProgress);
        
        // After 45 seconds, show timeout warning
        if (duration > 45 && !modelLoadingTimeout) {
          setModelLoadingTimeout(true);
          setLogs(prevLogs => [
            ...prevLogs,
            {
              message: "Model loading is taking longer than expected. You may need to refresh the page if it doesn't complete soon.",
              timestamp: new Date(),
              type: 'warning'
            }
          ]);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isVisible, modelLoadingTimeout]);

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
          if (type === 'info' || type === 'success') {
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
            } else if (message.includes('Loading NER model') || message.includes('Loading text classification model')) {
              // Start tracking model loading time
              if (modelLoadingTime === null) {
                setModelLoadingTime(Date.now());
              }
              setCurrentOperation('Loading AI models for data extraction...');
              
              // Add a progress log entry to show this might take time
              setLogs(prevLogs => [
                ...prevLogs,
                {
                  message: "AI model loading can take 30-60 seconds on first run...",
                  timestamp: new Date(),
                  type: 'progress'
                }
              ]);
            }
          } else if (type === 'error') {
            setHasError(true);
            
            // Add more specific error handling
            if (message.includes('timed out') && message.includes('model')) {
              setCurrentOperation('Model loading timed out');
              setModelLoadingTimeout(true);
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
            message.includes('model') ||
            message.includes('loading') ||
            message.includes('timeout') ||
            message.includes('Error') ||
            message.includes('timed out')) {
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
        'PDF successfully processed',
        'model loaded in'
      ];
      
      // Check model loading progress
      const modelLoadingInterval = setInterval(() => {
        if (modelLoadingTime !== null) {
          const elapsedSeconds = Math.floor((Date.now() - modelLoadingTime) / 1000);
          
          if (elapsedSeconds === 20) {
            setLogs(prevLogs => [
              ...prevLogs,
              {
                message: "Still loading AI models... this can take time on first run",
                timestamp: new Date(),
                type: 'progress'
              }
            ]);
          } else if (elapsedSeconds === 40) {
            setLogs(prevLogs => [
              ...prevLogs,
              {
                message: "AI model loading is taking longer than expected. Please be patient...",
                timestamp: new Date(),
                type: 'warning'
              }
            ]);
          } else if (elapsedSeconds === 60) {
            setLogs(prevLogs => [
              ...prevLogs,
              {
                message: "If processing doesn't complete soon, you may need to refresh and try again with a smaller PDF",
                timestamp: new Date(),
                type: 'warning'
              }
            ]);
            
            // At this point, we should consider it a timeout
            setModelLoadingTimeout(true);
          }
        }
      }, 1000);
      
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
        clearInterval(modelLoadingInterval);
        setIsSubscribed(false);
      };
    }
  }, [isVisible, isSubscribed, modelLoadingTime]);

  // Function to handle retry when model loading times out
  const handleRetryModelLoading = () => {
    // Reset model loading state
    resetModelLoadingState();
    
    // Reset our component state
    setModelLoadingTime(null);
    setModelLoadingProgress(0);
    setModelLoadingTimeout(false);
    setHasError(false);
    
    // Add a log entry
    setLogs(prevLogs => [
      ...prevLogs,
      {
        message: "Retrying model loading...",
        timestamp: new Date(),
        type: 'info'
      }
    ]);
    
    // Show toast
    toast.info("Retrying AI model loading. Please wait...");
    
    // Set current operation
    setCurrentOperation('Retrying AI model loading...');
  };

  if (!isVisible) return null;

  return (
    <Card className={`border-t-4 ${hasError ? 'border-t-red-500 bg-red-50/50' : 'border-t-blue-500 bg-blue-50/50'} mt-4`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            {currentOperation && (
              <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-full border shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-blue-800">{currentOperation}</span>
              </div>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {logs.length} events
            </Badge>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? '−' : '+'}
            </Button>
          </div>
        </div>
        
        {isExpanded && (
          <>
            {modelLoadingTime !== null && (
              <div className="mb-2 text-sm bg-yellow-50 border border-yellow-200 rounded p-2 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-yellow-600" />
                  <span>
                    AI model loading in progress. This can take 30-60 seconds on first run. 
                    {modelLoadingTimeout && " Loading is taking longer than expected."}
                  </span>
                </div>
                
                <div className="w-full">
                  <Progress value={modelLoadingProgress} className="h-2 mb-1" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0s</span>
                    <span>30s</span>
                    <span>60s</span>
                  </div>
                </div>
                
                {modelLoadingTimeout && (
                  <div className="mt-1">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="bg-white"
                      onClick={handleRetryModelLoading}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry Model Loading
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            <ScrollArea className="h-[200px] w-full rounded border p-2 bg-white">
              <div className="space-y-0.5">
                {logs.map((log, index) => (
                  <div 
                    key={index} 
                    className={`text-xs py-1 border-l-2 pl-2 ${
                      log.type === 'error' ? 'border-red-500 text-red-600 bg-red-50' :
                      log.type === 'success' ? 'border-green-500 text-green-600 bg-green-50' :
                      log.type === 'warning' ? 'border-yellow-500 text-yellow-600 bg-yellow-50' :
                      log.type === 'progress' ? 'border-purple-500 text-purple-600 bg-purple-50' :
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
                         log.type === 'progress' ? <Cpu className="h-3 w-3 text-purple-500" /> :
                         <Info className="h-3 w-3 text-blue-500" />}
                      </span>
                      <span className="flex-1 break-all">{log.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ExtractionProcessLog;
