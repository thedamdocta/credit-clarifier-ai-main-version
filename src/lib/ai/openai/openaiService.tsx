import React, { useState } from 'react';
import { AccountSummary } from '@/lib/types/creditReport';

// OpenAI API for credit report OCR and extraction
export const extractTableWithOpenAI = async (imageUrl: string): Promise<AccountSummary[] | null> => {
  try {
    // Check if we have an API key configured
    const apiKey = localStorage.getItem('openai_api_key');
    
    if (!apiKey) {
      console.log('No OpenAI API key found in local storage');
      return null;
    }
    
    console.log('Using OpenAI for table extraction');
    
    // Convert data URL to blob if needed
    let imageBlob: Blob;
    
    if (imageUrl.startsWith('data:')) {
      // Convert data URL to blob
      const response = await fetch(imageUrl);
      imageBlob = await response.blob();
    } else {
      // Fetch image from URL
      const response = await fetch(imageUrl);
      imageBlob = await response.blob();
    }
    
    // Read blob as base64 
    const base64Image = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(imageBlob);
    });
    
    // Call OpenAI API with the image
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting credit account summary tables from credit reports.
Extract the exact data from the credit accounts table in the image. The table contains rows for different account types
(Revolving, Mortgage, Installment, Other, and Total) and columns for Open, With Balance, Total Balance, Available,
Credit Limit, Debt-to-Credit, and Payment. Return ONLY a JSON array of objects with the extracted data following this format:
[
  {
    "accountType": "Revolving",
    "open": "value", // number as string
    "withBalance": "value", // number as string
    "totalBalance": "$value", // currency as string with $ prefix
    "available": "$value", // currency as string with $ prefix
    "creditLimit": "$value", // currency as string with $ prefix
    "debtToCredit": "value%", // percentage as string with % suffix
    "payment": "$value" // currency as string with $ prefix
  },
  // ...more rows for other account types
]
If you can't extract a specific value, set it to null. Be extremely precise with the extraction.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              },
              'Extract the credit accounts summary table data from this credit report image. Return a properly formatted JSON array.'
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Extract the JSON from the response content
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('No content in OpenAI response');
      return null;
    }
    
    // Extract JSON object from the response
    let extractedJson: AccountSummary[] = [];
    try {
      // Handle possible markdown formatting in the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                        content.match(/```\n([\s\S]*?)\n```/) || 
                        [null, content];
                        
      const jsonText = jsonMatch?.[1] || content;
      extractedJson = JSON.parse(jsonText);
      
      // Validate the extracted data
      if (!Array.isArray(extractedJson)) {
        throw new Error('Extracted data is not an array');
      }
      
      console.log('Successfully extracted table data with OpenAI:', extractedJson);
      return extractedJson;
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      console.log('Raw response:', content);
      return null;
    }
  } catch (error) {
    console.error('Error in OpenAI table extraction:', error);
    return null;
  }
};

// Component for managing OpenAI API key
export const OpenAIConfigForm: React.FC = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [saved, setSaved] = useState(false);
  
  const handleSave = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };
  
  return (
    <div className="p-4 border rounded-md mb-4">
      <h3 className="font-medium mb-2">OpenAI API Configuration</h3>
      <p className="text-sm mb-2">Add your OpenAI API key to enable advanced table extraction</p>
      <div className="flex gap-2">
        <input 
          type="password" 
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..." 
        />
        <button 
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
      {saved && <p className="text-green-600 text-xs mt-1">API key saved!</p>}
    </div>
  );
};

// Check if we can use OpenAI extraction
export const canUseOpenAI = (): boolean => {
  const apiKey = localStorage.getItem('openai_api_key');
  return !!apiKey && apiKey.startsWith('sk-');
};
