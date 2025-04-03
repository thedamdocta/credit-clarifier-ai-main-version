
import React from 'react';

interface TableImageDisplayProps {
  imageUrl: string | null;
  showDebugInfo: boolean;
}

const TableImageDisplay: React.FC<TableImageDisplayProps> = ({ imageUrl, showDebugInfo }) => {
  if (!showDebugInfo || !imageUrl) {
    return null;
  }

  return (
    <div className="mb-6 bg-slate-50 border border-slate-200 rounded-md p-4">
      <h3 className="text-sm font-medium mb-2">Extracted Table Image:</h3>
      <div className="flex justify-center">
        <img 
          src={imageUrl} 
          alt="Extracted credit accounts table" 
          className="max-w-full max-h-[300px] rounded border border-slate-300 shadow-sm"
          onError={(e) => {
            console.error('Error loading table image');
            (e.target as HTMLImageElement).style.display = 'none';
            const errorDiv = document.createElement('div');
            errorDiv.className = 'text-sm text-red-500 p-2';
            errorDiv.innerText = 'Error loading extracted table image';
            (e.target as HTMLImageElement).parentNode?.appendChild(errorDiv);
          }}
        />
      </div>
      <p className="text-xs text-slate-500 mt-2">This is the raw table image extracted from your credit report.</p>
    </div>
  );
};

export default TableImageDisplay;
