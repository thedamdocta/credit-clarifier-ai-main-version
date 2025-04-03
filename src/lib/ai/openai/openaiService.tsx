
import React, { useState } from 'react';
import { AccountSummary } from '@/lib/types/creditReport';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Shield, Eye, EyeOff } from 'lucide-react';

// OpenAI API for credit report OCR and extraction
export const extractTableWithOpenAI = async (imageUrl: string): Promise<AccountSummary[] | null> => {
  try {
    console.log('Starting OpenAI extraction attempt for image:', imageUrl);
    
    // First check for user-provided API key
    let apiKey = localStorage.getItem('openai_api_key');
    
    // If no user key, fall back to hardcoded key
    if (!apiKey) {
      console.log('No user API key found, using hardcoded key');
      apiKey = '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';
    }
    
    if (!apiKey || !apiKey.startsWith('sk-')) {
      console.log('No valid OpenAI API key available');
      return null;
    }
    
    console.log('Using OpenAI for table extraction');
    
    // Convert data URL to blob if needed
    let imageBlob: Blob;
    
    try {
      // For regular URLs, use fetch with cache control
      const response = await fetch(imageUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      imageBlob = await response.blob();
      console.log('Successfully fetched image as blob');
    } catch (error) {
      console.error('Error fetching image:', error);
      toast.error('Failed to process the image. Check your network connection and try again.');
      return null;
    }
    
    // Read blob as base64 
    let base64Image: string;
    try {
      base64Image = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          if (result) {
            resolve(result);
          } else {
            reject(new Error('FileReader returned empty result'));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read image as base64'));
        reader.readAsDataURL(imageBlob);
      });
      
      console.log('Successfully converted image to base64');
    } catch (error) {
      console.error('Error reading image as base64:', error);
      toast.error('Failed to process the image data. Please try again.');
      return null;
    }
    
    // Call OpenAI API with the image
    try {
      console.log('Making OpenAI API call for image extraction...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
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
If you can't extract a specific value, set it to null. Be extremely precise with the extraction.
If you see empty cells or missing values, set them to null in the JSON.`
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
                'Extract the credit accounts summary table data from this credit report image. Return a properly formatted JSON array following the specified format. If you can\'t find a value, use null.'
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 1000
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error: ${response.status}`, errorText);
        toast.error(`AI service error (${response.status}). Please try again later.`);
        return null;
      }

      const data = await response.json();
      
      // Extract the JSON from the response content
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error('No content in OpenAI response');
        toast.error('Failed to extract table data. Please try again.');
        return null;
      }
      
      console.log('Received OpenAI response:', content);
      
      // Extract JSON object from the response
      try {
        // Handle possible markdown formatting in the response
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || 
                          content.match(/```\n([\s\S]*?)\n```/) || 
                          [null, content];
                          
        const jsonText = jsonMatch?.[1] || content;
        console.log('Extracted JSON text:', jsonText);
        
        const extractedJson = JSON.parse(jsonText);
        
        // Validate the extracted data
        if (!Array.isArray(extractedJson)) {
          throw new Error('Extracted data is not an array');
        }
        
        // Ensure all values are in the correct format AND include all required AccountSummary properties
        const formattedData: AccountSummary[] = extractedJson.map(item => {
          // Ensure currency values have $ prefix
          const ensureCurrencyFormat = (value: string | null) => {
            if (!value) return null;
            return value.startsWith('$') ? value : `$${value}`;
          };
          
          // Ensure percentage values have % suffix
          const ensurePercentageFormat = (value: string | null) => {
            if (!value) return null;
            return value.endsWith('%') ? value : `${value}%`;
          };
          
          return {
            accountType: item.accountType || null,
            totalAccounts: null, // Required property
            open: item.open || null,
            closed: null, // Required property
            balance: null, // Required property 
            withBalance: item.withBalance || null,
            totalBalance: ensureCurrencyFormat(item.totalBalance),
            available: ensureCurrencyFormat(item.available),
            creditLimit: ensureCurrencyFormat(item.creditLimit),
            debtToCredit: ensurePercentageFormat(item.debtToCredit),
            payment: ensureCurrencyFormat(item.payment),
          };
        });
        
        console.log('Successfully extracted table data with OpenAI:', formattedData);
        
        // Check if we actually got any real data
        const hasRealData = formattedData.some(item => 
          (item.open && item.open !== '0') || 
          (item.totalBalance && item.totalBalance !== '$0')
        );
        
        if (!hasRealData) {
          console.log('No real data extracted, returning empty data');
          // We're returning an empty but properly structured array
          return formattedData;
        }
        
        return formattedData;
      } catch (error) {
        console.error('Error parsing OpenAI response:', error);
        console.log('Raw response:', content);
        toast.error('Failed to parse the AI response. Please try again.');
        return null;
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`OpenAI API error: ${errorMessage}. Please check your network connection and try again.`);
      return null;
    }
  } catch (error) {
    console.error('Error in OpenAI table extraction:', error);
    toast.error('An unexpected error occurred. Please try again.');
    return null;
  }
};

// Component for managing OpenAI API key
export const OpenAIConfigForm: React.FC = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [saved, setSaved] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  const handleSave = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setSaved(true);
    toast.success("OpenAI API key saved successfully");
    setTimeout(() => setSaved(false), 3000);
  };
  
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex gap-2 items-center">
        <Input 
          type={showApiKey ? "text" : "password"}
          className="flex h-8 text-xs"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..." 
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setShowApiKey(!showApiKey)}
        >
          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button 
          variant="default" 
          size="sm"
          className="h-8"
          onClick={handleSave}
        >
          Save Key
        </Button>
      </div>
      {saved && <p className="text-green-600 text-xs">API key saved!</p>}
      <div className="flex items-center text-xs text-muted-foreground">
        <Shield className="h-3 w-3 mr-1 text-green-600" />
        <span>
          {canUseOpenAI() 
            ? "AI-powered extraction is enabled" 
            : "For best results, provide an OpenAI API key"}
        </span>
      </div>
    </div>
  );
};

// Check if we can use OpenAI extraction
export const canUseOpenAI = (): boolean => {
  const apiKey = localStorage.getItem('openai_api_key');
  const hasUserKey = !!apiKey && apiKey.startsWith('sk-');
  const hasHardcodedKey = true; // Always use the hardcoded key
  
  return hasUserKey || hasHardcodedKey;
};
