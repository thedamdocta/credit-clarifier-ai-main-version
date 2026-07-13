
import { CreditReport } from '../types/creditReport';
import { identifyBureauWithAI } from './entityExtraction';
import { extractPersonalInfoWithAI } from './personalInfoExtraction';
import { extractEntities } from './textAnalysis';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

// AI-first approach for credit report parsing
export const parseWithAI = async (text: string): Promise<Partial<CreditReport>> => {
  try {
    devDiagnostics.log("Beginning AI-first parsing of credit report...");
    
    // Identify the credit bureau
    const bureau = await identifyBureauWithAI(text);
    devDiagnostics.log(`AI identified bureau: ${bureau}`);
    
    // Extract report date (using regex as dates are better handled this way)
    const datePatterns = [
      /report date:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /date issued:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /as of:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/
    ];
    
    let reportDate = new Date().toLocaleDateString();
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        reportDate = match[1];
        break;
      }
    }
    
    // Extract personal information using AI
    const personalInfo = await extractPersonalInfoWithAI(text);
    devDiagnostics.log("AI extracted personal info");
    
    // Return partial report with AI-extracted information
    return {
      bureau,
      reportDate,
      personalInfo,
      rawText: text
    };
  } catch (error) {
    devDiagnostics.error("Error in AI-first parsing:", error);
    return {
      bureau: 'Unknown',
      reportDate: new Date().toLocaleDateString(),
      personalInfo: {
        name: 'Not Found',
        addresses: ['Not Found']
      },
      rawText: text
    };
  }
};

// Enhance credit report parsing with AI
export const enhanceCreditReportWithAI = async (text: string, partialReport: any) => {
  try {
    // Extract entities with AI
    const entities = await extractEntities(text);
    
    // Analyze sections for better classification
    const enhancedReport = { ...partialReport };
    
    // Improve personal information extraction
    if (enhancedReport.personalInfo) {
      // Look for potential name entities
      const personEntities = entities.filter(e => e.entity === 'B-PER' || e.entity === 'I-PER');
      if (personEntities.length > 0) {
        // Extract full name by finding consecutive person entities
        let fullName = '';
        let currentGroup = [];
        
        for (let i = 0; i < personEntities.length; i++) {
          const current = personEntities[i];
          if (current.entity === 'B-PER') {
            if (currentGroup.length > 0) {
              const name = currentGroup.map(e => e.word).join(' ');
              if (name.split(' ').length >= 2) {
                fullName = name;
                break;
              }
            }
            currentGroup = [current];
          } else if (current.entity === 'I-PER') {
            currentGroup.push(current);
          }
        }
        
        if (fullName && fullName.length > 2) {
          enhancedReport.personalInfo.name = fullName;
        }
      }
    }
    
    return enhancedReport;
  } catch (error) {
    devDiagnostics.error('Error enhancing credit report with AI:', error);
    return partialReport;
  }
};
