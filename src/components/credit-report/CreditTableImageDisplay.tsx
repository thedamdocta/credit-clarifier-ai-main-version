
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface CreditTableImageDisplayProps {
  imageUrl: string | null;
  isProcessing?: boolean;
}

const CreditTableImageDisplay: React.FC<CreditTableImageDisplayProps> = ({ 
  imageUrl, 
  isProcessing = false 
}) => {
  if (isProcessing) {
    return (
      <Card className="mb-4 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Processing PDF Image</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 bg-gray-50">
            <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!imageUrl) {
    return (
      <Card className="mb-4 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-sm font-medium">No Table Image Available</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40 bg-gray-50">
            <p className="text-gray-500">Upload a PDF to view the credit table image</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-4 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Credit Table Image</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="w-full overflow-hidden">
          <img 
            src={imageUrl} 
            alt="Credit account table" 
            className="w-full object-contain border-t border-gray-100 max-h-[400px]" 
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default CreditTableImageDisplay;
