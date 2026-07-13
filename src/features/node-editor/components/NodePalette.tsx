import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Upload, FileText, FileSearch, Brain, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { nodeRegistry } from '../core/registry';
import { usePipelineStore } from '../store/pipelineStore';
import { PipelineNode, NodeData } from '../core/types';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, any> = {
  input: Upload,
  processing: FileText,
  ai: Brain,
  transform: FileSearch,
  output: Eye,
  control: FileSearch,
};

const categoryLabels: Record<string, string> = {
  input: 'Input',
  processing: 'Processing',
  ai: 'AI / LLM',
  transform: 'Transform',
  output: 'Output',
  control: 'Control Flow',
};

export function NodePalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['input', 'processing', 'ai', 'output'])
  );

  const { nodes, setNodes } = usePipelineStore();

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const addNode = (nodeType: string) => {
    const executor = nodeRegistry.getExecutor(nodeType);
    const config: Record<string, any> = {};

    // Set default values from schema
    const schema = executor.getConfigSchema();
    schema.fields.forEach((field) => {
      config[field.key] = field.defaultValue;
    });

    const nodeData: NodeData = {
      label: executor.label,
      type: executor.type,
      category: executor.category,
      config,
      inputs: executor.getInputPorts(config),
      outputs: executor.getOutputPorts(config),
      status: 'idle',
    };

    const newNode: PipelineNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'custom',
      position: {
        x: Math.random() * 400 + 100,
        y: Math.random() * 400 + 100,
      },
      data: nodeData,
    };

    setNodes([...nodes, newNode]);
  };

  const categories = nodeRegistry.getCategories();

  // Filter executors by search query
  const getFilteredExecutors = (category: string) => {
    const executors = nodeRegistry.getExecutorsByCategory(category);
    if (!searchQuery) {
      return executors;
    }
    return executors.filter(
      (executor) =>
        executor.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        executor.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">Node Palette</h3>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-2">
          {categories.map((category) => {
            const Icon = categoryIcons[category] || FileText;
            const filteredExecutors = getFilteredExecutors(category);

            if (filteredExecutors.length === 0 && searchQuery) {
              return null;
            }

            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="mb-2">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-accent rounded-md transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">
                    {categoryLabels[category] || category}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {filteredExecutors.length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {filteredExecutors.map((executor) => (
                      <button
                        key={executor.type}
                        onClick={() => addNode(executor.type)}
                        className={cn(
                          'w-full text-left p-2 rounded-md hover:bg-accent transition-colors',
                          'border border-transparent hover:border-border'
                        )}
                      >
                        <div className="text-sm font-medium">{executor.label}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {executor.description}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
