
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface TableImageViewProps {
  imageUrl: string | null;
  isProcessing: boolean;
}

const TableImageView: React.FC<TableImageViewProps> = ({ imageUrl, isProcessing }) => {
  return (
    <div className="relative border rounded-lg overflow-hidden bg-gray-50 min-h-[200px]">
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 z-10">
          <div className="bg-white p-4 rounded-lg shadow-lg flex flex-col items-center">
            <Skeleton className="h-6 w-6 rounded-full animate-pulse mb-2" />
            <p className="text-sm">Processing image...</p>
          </div>
        </div>
      )}
      
      {imageUrl ? (
        <div className="relative w-full flex justify-center">
          <img 
            src={imageUrl} 
            alt="Credit account table from report"
            className={cn(
              "max-w-full object-contain h-auto max-h-[500px] rounded", 
              isProcessing && "opacity-60"
            )}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 min-h-[200px]">
          <Skeleton className="h-12 w-12 rounded mb-4" />
          <p className="text-gray-500 text-center">
            No image available. Select a PDF page to view its content.
          </p>
        </div>
      )}
    </div>
  );
};

export default TableImageView;
