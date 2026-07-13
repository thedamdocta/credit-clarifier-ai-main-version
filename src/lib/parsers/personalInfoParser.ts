import { PersonalInfo } from "../types/creditReport";
import { extractSSNWithAI } from "../ai";
import { devDiagnostics } from "@/lib/security/devDiagnostics";

export const extractPersonalInfo = async (text: string): Promise<PersonalInfo> => {
  let name = '';
  const nameMatch = text.match(/name:?\s*([A-Za-z\s\.,]+)/i);
  if (nameMatch && nameMatch[1]) {
    name = nameMatch[1].trim();
  }
  
  const addresses: string[] = [];
  
  const addressBlocks = text.match(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*([A-Za-z0-9\s\.,#\-]+(?:\n[A-Za-z0-9\s\.,#\-]+)*)/ig);
  
  if (addressBlocks) {
    addressBlocks.forEach(block => {
      const addressLine = block.replace(/(?:address|residence|location)(?:es)?:?(?:\s*\w+)?:?\s*/i, '').trim();
      if (addressLine && addressLine.length > 5) {
        addresses.push(addressLine);
      }
    });
  }
  
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
  
  let ssn: string | undefined;
  try {
    ssn = await extractSSNWithAI(text);
  } catch (error) {
    devDiagnostics.error("Error extracting SSN with AI:", error);
    const ssnMatch = text.match(/ssn:?\s*(?:xxx-xx-|[*]{5}|[*]{3}-[*]{2}-)(\d{4})/i);
    if (ssnMatch && ssnMatch[1]) {
      ssn = `XXX-XX-${ssnMatch[1]}`;
    }
  }
  
  let dob: string | undefined;
  const dobMatch = text.match(/(?:date of birth|dob|birth date):?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dobMatch && dobMatch[1]) {
    dob = dobMatch[1];
  }
  
  let employmentHistory: string | undefined;
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
  
  return {
    name: name || 'Not Found',
    addresses: addresses.length ? addresses : ['Not Found'],
    ssn,
    dob,
    employmentHistory
  };
};
