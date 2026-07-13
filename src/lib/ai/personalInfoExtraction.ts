import { extractEntities } from './textAnalysis';
import { extractSSNWithAI } from './entityExtraction';
import { PersonalInfo } from '../types/creditReport';
import { devDiagnostics } from "@/lib/security/devDiagnostics";

// AI-first approach to extract personal information
export const extractPersonalInfoWithAI = async (text: string): Promise<PersonalInfo> => {
  try {
    // Extract entities with AI
    const entities = await extractEntities(text);
    
    // Extract name with AI
    const name = await extractNameWithAI(text);
    
    // Extract addresses
    const addresses: string[] = [];
    
    // Look for location entities
    const locEntities = entities.filter(e => e.entity === 'B-LOC' || e.entity === 'I-LOC');
    
    // Group consecutive location entities
    let currentAddress: string[] = [];
    for (let i = 0; i < locEntities.length; i++) {
      if (locEntities[i].entity === 'B-LOC') {
        if (currentAddress.length > 0) {
          addresses.push(currentAddress.join(' '));
          currentAddress = [];
        }
        currentAddress.push(locEntities[i].word);
      } else if (locEntities[i].entity === 'I-LOC') {
        currentAddress.push(locEntities[i].word);
      }
    }
    
    if (currentAddress.length > 0) {
      addresses.push(currentAddress.join(' '));
    }
    
    // Fall back to regex for addresses if none found
    if (addresses.length === 0) {
      const addressPatterns = [
        /(\d+\s+[A-Za-z]+\s+(?:ST|STREET|AVE|AVENUE|BLVD|BOULEVARD|RD|ROAD|DR|DRIVE|LN|LANE|CT|COURT|CIR|CIRCLE|WAY|TER|TERRACE|PL|PLACE)\.?\s+(?:[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?|[A-Za-z\s]+))/ig,
        /(?:CURRENT|FORMER)\s+(?:[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+)?(\d+\s+[A-Za-z\s\.]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/ig
      ];
      
      for (const pattern of addressPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].trim().length > 8) {
            const addr = match[0].trim();
            if (!addresses.some(a => a.includes(addr))) {
              addresses.push(addr);
            }
          }
        }
      }
    }
    
    // Extract SSN using AI
    const ssn = await extractSSNWithAI(text);
    
    // Extract DOB with regex (AI models are typically not good at date formats)
    let dob: string | undefined;
    const dobMatch = text.match(/(?:date of birth|dob|birth date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dobMatch && dobMatch[1]) {
      dob = dobMatch[1];
    }
    
    // Extract employment information
    let employmentHistory: string | undefined;
    
    // Look for employment-related entities
    const employmentEntities = entities.filter(e => {
      const word = e.word.toLowerCase();
      return word.includes('employ') || word.includes('work') || word.includes('job');
    });
    
    if (employmentEntities.length > 0) {
      // Find sentences containing these entities
      const textLines = text.split(/[\r\n.]+/);
      for (const line of textLines) {
        if (employmentEntities.some(e => line.toLowerCase().includes(e.word.toLowerCase()))) {
          employmentHistory = line.trim();
          break;
        }
      }
    }
    
    // Fall back to regex for employment info if none found
    if (!employmentHistory) {
      const employmentPatterns = [
        /(?:employer|employment):?\s*([^\.]+)/i,
        /(?:employer|employment)\s*history:?\s*([^\.]+)/i,
        /(?:reported|current)\s*employer:?\s*([^\.]+)/i
      ];
      
      for (const pattern of employmentPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          employmentHistory = match[1].trim();
          break;
        }
      }
    }
    
    return {
      name: name || 'Not Found',
      addresses: addresses.length ? addresses : ['Not Found'],
      ssn,
      dob,
      employmentHistory
    };
  } catch (error) {
    devDiagnostics.error('Error extracting personal info with AI:', error);
    
    // Fall back to basic extraction
    const name = text.match(/name:?\s*([A-Za-z\s\.,]+)/i)?.[1]?.trim() || 'Not Found';
    
    return {
      name,
      addresses: ['Not Found'],
      ssn: undefined,
      dob: undefined,
      employmentHistory: undefined
    };
  }
};

// Helper function for name extraction
export const extractNameWithAI = async (text: string): Promise<string> => {
  try {
    const entities = await extractEntities(text);
    
    // Look for person entities
    const personEntities = entities.filter(e => e.entity === 'B-PER' || e.entity === 'I-PER');
    
    if (personEntities.length > 0) {
      // Extract full name by finding consecutive person entities
      let fullName = '';
      let currentGroup: any[] = [];
      
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
        return fullName;
      }
    }
    
    // Fall back to regex-based name extraction
    const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
    if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 0) {
      return nameMatch[1].trim();
    }
    
    return 'Not Found';
  } catch (error) {
    devDiagnostics.error('Error extracting name with AI:', error);
    return 'Not Found';
  }
};
