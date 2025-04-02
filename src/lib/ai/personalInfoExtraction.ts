
import { extractEntities, NEREntity } from './textAnalysis';
import { extractSSNWithAI } from './entityExtraction';
import { PersonalInfo } from '../types/creditReport';
import { shouldSkipAI } from './modelPipelines';

// AI-first approach to extract personal information
export const extractPersonalInfoWithAI = async (text: string): Promise<PersonalInfo> => {
  try {
    console.log("Starting personal info extraction");
    const startTime = performance.now();
    
    // Try simple regex first for faster processing
    let name = '';
    const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].trim();
      console.log("Name extracted using regex");
    }
    
    // Extract addresses with regex first
    const addresses: string[] = extractAddressesWithRegex(text);
    
    // Extract SSN using either regex or AI
    const ssn = await extractSSNWithAI(text);
    
    // Extract DOB with regex (AI models are typically not good at date formats)
    let dob: string | undefined;
    const dobMatch = text.match(/(?:date of birth|dob|birth date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (dobMatch && dobMatch[1]) {
      dob = dobMatch[1];
      console.log("DOB extracted using regex");
    }
    
    // Extract employment information with regex
    let employmentHistory: string | undefined = extractEmploymentWithRegex(text);
    
    // Only use AI if simple methods failed and AI is not disabled
    if ((!name || addresses.length === 0) && !shouldSkipAI()) {
      console.log("Using AI to extract missing personal info");
      
      // Extract entities with AI
      const entities = await extractEntities(text);
      
      // If name wasn't found with regex, try AI
      if (!name) {
        name = extractNameFromEntities(entities);
      }
      
      // If addresses weren't found with regex, try AI
      if (addresses.length === 0) {
        const aiAddresses = extractAddressesFromEntities(entities, text);
        addresses.push(...aiAddresses);
      }
      
      // If employment wasn't found with regex, try AI
      if (!employmentHistory) {
        employmentHistory = extractEmploymentFromEntities(entities, text);
      }
    }
    
    const endTime = performance.now();
    console.log(`Personal info extraction completed in ${Math.round(endTime - startTime)}ms`);
    
    return {
      name: name || 'Not Found',
      addresses: addresses.length ? addresses : ['Not Found'],
      ssn,
      dob,
      employmentHistory
    };
  } catch (error) {
    console.error('Error extracting personal info with AI:', error);
    
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

// Helper function to extract addresses with regex
function extractAddressesWithRegex(text: string): string[] {
  const addresses: string[] = [];
  
  // Extract address blocks
  const addressBlocks = text.match(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*([A-Za-z0-9\s\.,#\-]+(?:\n[A-Za-z0-9\s\.,#\-]+)*)/ig);
  
  if (addressBlocks) {
    addressBlocks.forEach(block => {
      const addressLine = block.replace(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*/i, '').trim();
      if (addressLine && addressLine.length > 5) {
        addresses.push(addressLine);
      }
    });
  }
  
  // Use additional patterns for addresses
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
  
  return addresses;
}

// Helper function to extract employment info with regex
function extractEmploymentWithRegex(text: string): string | undefined {
  const employmentPatterns = [
    /(?:employer|employment):?\s*([^\.]+)/i,
    /(?:employer|employment)\s*history:?\s*([^\.]+)/i,
    /(?:reported|current)\s*employer:?\s*([^\.]+)/i
  ];
  
  for (const pattern of employmentPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return undefined;
}

// Helper functions for AI-based extraction
function extractNameFromEntities(entities: NEREntity[]): string {
  // Look for person entities
  const personEntities = entities.filter(e => e.entity === 'B-PER' || e.entity === 'I-PER');
  
  if (personEntities.length > 0) {
    // Extract full name by finding consecutive person entities
    let currentGroup: NEREntity[] = [];
    let bestName = '';
    let bestNameScore = 0;
    
    for (let i = 0; i < personEntities.length; i++) {
      const current = personEntities[i];
      if (current.entity === 'B-PER') {
        if (currentGroup.length > 0) {
          const name = currentGroup.map(e => e.word).join(' ');
          const nameScore = name.split(' ').length; // Simple scoring - more name parts = better
          
          if (nameScore > bestNameScore) {
            bestName = name;
            bestNameScore = nameScore;
          }
        }
        currentGroup = [current];
      } else if (current.entity === 'I-PER') {
        currentGroup.push(current);
      }
    }
    
    // Process the last group
    if (currentGroup.length > 0) {
      const name = currentGroup.map(e => e.word).join(' ');
      const nameScore = name.split(' ').length;
      
      if (nameScore > bestNameScore) {
        bestName = name;
      }
    }
    
    if (bestName && bestName.length > 2) {
      return bestName;
    }
  }
  
  return 'Not Found';
}

function extractAddressesFromEntities(entities: NEREntity[], text: string): string[] {
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
  
  return addresses;
}

function extractEmploymentFromEntities(entities: NEREntity[], text: string): string | undefined {
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
        return line.trim();
      }
    }
  }
  
  return undefined;
}

// Helper function for name extraction
export const extractNameWithAI = async (text: string): Promise<string> => {
  try {
    // Try regex extraction first (faster)
    const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
    if (nameMatch && nameMatch[1] && nameMatch[1].trim().length > 0) {
      console.log("Name extracted using regex");
      return nameMatch[1].trim();
    }
    
    // Skip AI processing if we've had previous failures
    if (shouldSkipAI()) {
      console.log("Skipping AI-based name extraction due to previous AI failures");
      return 'Not Found';
    }
    
    console.log("Attempting AI-based name extraction");
    const entities = await extractEntities(text);
    
    return extractNameFromEntities(entities);
  } catch (error) {
    console.error('Error extracting name with AI:', error);
    return 'Not Found';
  }
};
