import { PersonalInfo } from "../types/creditReport";
import { parsingLogger } from "@/utils/parsingLogger";

export const extractPersonalInfo = async (text: string): Promise<PersonalInfo> => {
  // Initialize default personal info object
  const personalInfo: PersonalInfo = {
    name: "Not Found",
    addresses: [],
    phoneNumbers: [],
    employmentHistory: []
  };

  try {
    // Extract name
    const namePatterns = [
      /name(?:\s*:)?\s*([A-Z][A-Za-z\s.-]+)/i,
      /consumer(?:\s*:)?\s*([A-Z][A-Za-z\s.-]+)/i,
      /prepared for(?:\s*:)?\s*([A-Z][A-Za-z\s.-]+)/i,
    ];

    for (const pattern of namePatterns) {
      const nameMatch = text.match(pattern);
      if (nameMatch && nameMatch[1]) {
        personalInfo.name = nameMatch[1].trim();
        console.log("Found name:", personalInfo.name);
        break;
      }
    }

    // Extract address(es)
    const addressPatterns = [
      /current address(?:\s*:)?\s*([A-Za-z0-9\s.,]+(?:ST|AVE|RD|DR|LN|BLVD|CT|CIR|TER|PKWY|WAY)[,\s]*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
      /(?:address|residence)(?:\s*:)?\s*([A-Za-z0-9\s.,]+(?:ST|AVE|RD|DR|LN|BLVD|CT|CIR|TER|PKWY|WAY)[,\s]*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
      /([A-Za-z0-9\s.,]+(?:STREET|AVENUE|ROAD|DRIVE|LANE|BOULEVARD|COURT|CIRCLE|TERRACE|PARKWAY|WAY)[,\s]*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i,
    ];

    const addresses: string[] = [];
    addressPatterns.forEach(pattern => {
      const matches = text.matchAll(new RegExp(pattern, 'gi'));
      for (const match of matches) {
        if (match[1]) {
          const address = match[1]
            .replace(/\s+/g, ' ')
            .trim();
          
          // Check for duplicates before adding
          if (address && !addresses.includes(address)) {
            addresses.push(address);
          }
        }
      }
    });

    if (addresses.length > 0) {
      personalInfo.addresses = addresses;
      console.log("Found addresses:", addresses);
    } else {
      // Always provide an array even if empty
      personalInfo.addresses = ["Address not found"];
    }

    // Extract SSN
    const ssnPattern = /SSN(?:\s*:)?\s*(\d{3}-\d{2}-\d{4}|\*{3}-\*{2}-\d{4})/i;
    const ssnMatch = text.match(ssnPattern);
    if (ssnMatch && ssnMatch[1]) {
      personalInfo.ssn = ssnMatch[1].trim();
      console.log("Found SSN (masked):", personalInfo.ssn);
    }

    // Extract date of birth
    const dobPatterns = [
      /(?:date of birth|DOB|birth date)(?:\s*:)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
      /born(?:\s*:)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    ];

    for (const pattern of dobPatterns) {
      const dobMatch = text.match(pattern);
      if (dobMatch && dobMatch[1]) {
        personalInfo.dob = dobMatch[1].trim();
        console.log("Found DOB:", personalInfo.dob);
        break;
      }
    }

    // Extract phone numbers
    const phonePattern = /(?:phone|telephone|mobile|cell)(?:\s*:)?\s*(\(\d{3}\)\s*\d{3}-\d{4}|\d{3}-\d{3}-\d{4})/i;
    const phoneMatches = text.matchAll(new RegExp(phonePattern, 'gi'));
    
    const phoneNumbers: string[] = [];
    for (const match of phoneMatches) {
      if (match[1]) {
        const phone = match[1].trim();
        if (!phoneNumbers.includes(phone)) {
          phoneNumbers.push(phone);
        }
      }
    }
    
    if (phoneNumbers.length > 0) {
      personalInfo.phoneNumbers = phoneNumbers;
      console.log("Found phone numbers:", phoneNumbers);
    }

    // Extract employment history
    const employmentPattern = /(?:employer|employment)(?:\s*:)?\s*([A-Za-z0-9\s.,&]+)/i;
    const employmentMatches = text.matchAll(new RegExp(employmentPattern, 'gi'));
    
    const employmentHistory: string[] = [];
    for (const match of employmentMatches) {
      if (match[1]) {
        const employer = match[1].trim();
        if (employer.length > 3 && !employmentHistory.includes(employer)) {
          employmentHistory.push(employer);
        }
      }
    }
    
    if (employmentHistory.length > 0) {
      personalInfo.employmentHistory = employmentHistory;
      console.log("Found employment history:", employmentHistory);
    }

    // Log the extraction results
    parsingLogger.logEvent("Personal info extraction complete", {
      nameFound: personalInfo.name !== "Not Found",
      addressCount: personalInfo.addresses.length,
      hasSSN: !!personalInfo.ssn,
      hasDOB: !!personalInfo.dob,
      phoneCount: personalInfo.phoneNumbers?.length || 0,
      employmentCount: personalInfo.employmentHistory?.length || 0
    });

    return personalInfo;
  } catch (error) {
    console.error("Error extracting personal info:", error);
    parsingLogger.logEvent("Error extracting personal info", { error: String(error) });
    
    // Return minimal valid structure on error
    return {
      name: "Not Found",
      addresses: ["Address not found"]
    };
  }
};
