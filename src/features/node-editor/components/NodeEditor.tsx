import { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  useNodesState,
  useEdgesState,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { usePipelineStore } from '../store/pipelineStore';
import { usePipelineExecution } from '../hooks/usePipelineExecution';
import { registerDefaultNodes } from '../nodes';
import { PipelineNode, PipelineEdge } from '../core/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Play, Square, Save, PanelLeft, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { CustomNode } from './CustomNode';
import { NodePalette } from './NodePalette';
import { PropertiesPanel } from './PropertiesPanel';
import { cn } from '@/lib/utils';

registerDefaultNodes();

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export function NodeEditor({ className }: { className?: string }) {
  const store = usePipelineStore();
  const hydratingNodesRef = useRef(false);
  const hydratingEdgesRef = useRef(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

  if (!store || !store.setNodes) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Initializing node editor...</p>
      </div>
    );
  }

  const {
    currentPipeline,
    nodes: storeNodes,
    edges: storeEdges,
    isExecuting,
    executionResult,
    selectedNodeId,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    setSelectedNode,
    createDefaultPipeline,
    saveCurrentPipeline,
  } = store;

  const { executePipeline, abortExecution } = usePipelineExecution();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const nodesWithDisconnectedFlag = storeNodes.map((node) => {
      const hasIncoming = storeEdges.some((edge) => edge.target === node.id);
      const hasOutgoing = storeEdges.some((edge) => edge.source === node.id);
      const isInput = node.data.category === 'input';
      const isOutput = node.data.category === 'output';
      const isDisconnected = (!isInput && !hasIncoming) || (!isOutput && !hasOutgoing);

      return {
        ...node,
        data: {
          ...node.data,
          isDisconnected,
        },
      };
    });

    hydratingNodesRef.current = true;
    setNodes(nodesWithDisconnectedFlag);
  }, [storeNodes, storeEdges, setNodes]);

  useEffect(() => {
    hydratingEdgesRef.current = true;
    setEdges(storeEdges);
  }, [storeEdges, setEdges]);

  useEffect(() => {
    if (hydratingNodesRef.current) {
      hydratingNodesRef.current = false;
      return;
    }

    setStoreNodes(nodes as PipelineNode[]);
  }, [nodes, setStoreNodes]);

  useEffect(() => {
    if (hydratingEdgesRef.current) {
      hydratingEdgesRef.current = false;
      return;
    }

    setStoreEdges(edges as PipelineEdge[]);
  }, [edges, setStoreEdges]);

  useEffect(() => {
    if (!currentPipeline) {
      createDefaultPipeline('Complete Backend Architecture (42 Nodes)');
    }
  }, [currentPipeline, createDefaultPipeline]);

  useEffect(() => {
    if (selectedNodeId) {
      setIsInspectorOpen(true);
    }
  }, [selectedNodeId]);

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge = {
        ...connection,
        id: `edge_${Date.now()}`,
      } as Edge;

      const updatedEdges = addEdge(newEdge, edges);
      setEdges(updatedEdges);
      setStoreEdges(updatedEdges as PipelineEdge[]);
    },
    [edges, setEdges, setStoreEdges]
  );

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode]
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleNodesChange = useCallback(
    (changes: any) => {
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: any) => {
      onEdgesChange(changes);
    },
    [onEdgesChange]
  );

  const handleExecute = async () => {
    try {
      await executePipeline();
      toast.success('Pipeline executed successfully!');
    } catch (error: any) {
      toast.error(`Pipeline execution failed: ${error.message}`);
    }
  };

  const handleSave = () => {
    try {
      saveCurrentPipeline();
      toast.success('Pipeline saved!');
    } catch (error: any) {
      toast.error(`Failed to save pipeline: ${error.message}`);
    }
  };

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) as PipelineNode | undefined;

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col bg-background", className)}>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-black/20 bg-background lg:flex lg:flex-col">
          <NodePalette />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="border-b border-black/20 bg-background">
            <div className="flex flex-col gap-4 px-4 py-4 lg:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-slate-500">
                    Developer Workspace
                  </p>
                  <div className="space-y-1">
                    <h3 className="font-display text-2xl tracking-[-0.04em] text-slate-950">
                      {currentPipeline?.name ?? 'Pipeline Canvas'}
                    </h3>
                    <p className="max-w-3xl text-sm text-slate-600">
                      The node library stays available, but the inspector is opened only when needed so the canvas remains the primary surface.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => setIsPaletteOpen(true)}
                    variant="outline"
                    size="sm"
                    className="lg:hidden"
                  >
                    <PanelLeft className="mr-2 h-4 w-4" />
                    Node Library
                  </Button>

                  <Button
                    onClick={() => setIsInspectorOpen(true)}
                    variant="outline"
                    size="sm"
                  >
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    {selectedNode ? 'Edit Node' : 'Inspector'}
                  </Button>

                  <Button
                    onClick={handleExecute}
                    disabled={isExecuting || nodes.length === 0}
                    size="sm"
                  >
                    {isExecuting ? (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Execute
                      </>
                    )}
                  </Button>

                  {isExecuting && (
                    <Button onClick={abortExecution} variant="destructive" size="sm">
                      <Square className="mr-2 h-4 w-4" />
                      Abort
                    </Button>
                  )}

                  <Button onClick={handleSave} variant="outline" size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-0 gap-y-2 border-t border-black/10 pt-3 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-slate-500">
                <span className="pr-4">{nodes.length} Nodes</span>
                <span className="border-l border-black/10 px-4">{edges.length} Connections</span>
                <span className="border-l border-black/10 px-4">
                  {selectedNode ? `Selected: ${selectedNode.data.label}` : 'Select a node to edit its properties'}
                </span>
                {executionResult ? (
                  executionResult.success ? (
                    <span className="border-l border-black/10 px-4 text-emerald-700">
                      Last Run: Success ({executionResult.executionTime}ms)
                    </span>
                  ) : (
                    <span className="border-l border-black/10 px-4 text-red-700">Last Run: Failed</span>
                  )
                ) : (
                  <span className="border-l border-black/10 px-4">Execution idle</span>
                )}
              </div>
            </div>
          </div>

          <div className="min-h-[640px] flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={onPaneClick}
              nodeTypes={nodeTypes}
              fitView
              minZoom={0.1}
              maxZoom={2}
            >
              <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>
        </div>
      </div>

      <Sheet open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
        <SheetContent side="left" className="w-[min(92vw,380px)] p-0 sm:max-w-none">
          <SheetHeader className="border-b border-black/10 px-6 py-5">
            <SheetTitle className="font-display text-2xl tracking-[-0.04em] text-slate-950">Node Library</SheetTitle>
            <SheetDescription className="text-slate-600">
              Browse, search, and add pipeline nodes without taking permanent space from the canvas.
            </SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100%-88px)] min-h-0">
            <NodePalette />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={isInspectorOpen} onOpenChange={setIsInspectorOpen}>
        <SheetContent side="right" className="w-[min(96vw,430px)] p-0 sm:max-w-[430px]">
          <SheetHeader className="border-b border-black/10 px-6 py-5">
            <SheetTitle className="font-display text-2xl tracking-[-0.04em] text-slate-950">
              {selectedNode ? selectedNode.data.label : 'Node Inspector'}
            </SheetTitle>
            <SheetDescription className="text-slate-600">
              Configure node inputs, behavior, and implementation details without shrinking the workflow canvas.
            </SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100%-88px)] overflow-y-auto">
            <PropertiesPanel />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
