import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NodeData } from '../core/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';

export const CustomNode = memo(({ data, selected, id }: NodeProps<NodeData>) => {
  const getStatusColor = () => {
    // Show red border if node is marked as disconnected
    if (data.isDisconnected) {
      return 'border-red-500 border-dashed bg-red-50/30';
    }

    switch (data.status) {
      case 'success':
        return 'border-green-500 bg-green-50';
      case 'error':
        return 'border-red-500 bg-red-50';
      case 'running':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-300 bg-white';
    }
  };

  const getStatusIcon = () => {
    switch (data.status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCategoryColor = () => {
    switch (data.category) {
      case 'input':
        return 'bg-purple-100 text-purple-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'ai':
        return 'bg-green-100 text-green-800';
      case 'transform':
        return 'bg-yellow-100 text-yellow-800';
      case 'output':
        return 'bg-orange-100 text-orange-800';
      case 'control':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border-2 shadow-md min-w-[180px] transition-all',
        getStatusColor(),
        selected && 'ring-2 ring-blue-400 ring-offset-2'
      )}
    >
      {/* Input Handles */}
      {data.inputs.map((input, index) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          style={{
            top: `${((index + 1) * 100) / (data.inputs.length + 1)}%`,
            background: '#4B5563',
          }}
          className="w-3 h-3"
        />
      ))}

      {/* Node Header */}
      <div className="p-2 border-b bg-white/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            {getStatusIcon()}
            <div className="font-semibold text-sm truncate">{data.label}</div>
          </div>
          <div className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getCategoryColor())}>
            {data.category}
          </div>
        </div>
      </div>

      {/* Node Body */}
      <div className="p-2">
        <div className="text-xs text-gray-600 mb-1">Type: {data.type}</div>

        {/* Show disconnected warning */}
        {data.isDisconnected && (
          <div className="text-xs text-red-600 bg-red-50 p-1 rounded mt-1 border border-red-200">
            ⚠ Not connected to pipeline
          </div>
        )}

        {/* Show error if any */}
        {data.error && (
          <div className="text-xs text-red-600 bg-red-50 p-1 rounded mt-1 border border-red-200">
            {data.error}
          </div>
        )}

        {/* Show result preview if success */}
        {data.status === 'success' && data.result && (
          <div className="text-xs text-green-700 mt-1">
            ✓ Complete
          </div>
        )}
      </div>

      {/* Output Handles */}
      {data.outputs.map((output, index) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          style={{
            top: `${((index + 1) * 100) / (data.outputs.length + 1)}%`,
            background: '#4B5563',
          }}
          className="w-3 h-3"
        />
      ))}
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
