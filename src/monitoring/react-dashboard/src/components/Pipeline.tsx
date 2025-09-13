import React, { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Handle,
  Position,
  getBezierPath,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { createPortal } from 'react-dom';
import { Badge } from './ui/badge';
// Professional React Icons
import { 
  FaBullseye,
  FaBrain, 
  FaMicrochip,
  FaDatabase,
  FaClock,
  FaSearch,
  FaCodeBranch,
  FaCog,
  FaTools,
  FaEye,
  FaVectorSquare
} from 'react-icons/fa';
import { PipelineStep } from '../types/monitoring';

interface PipelineProps {
  steps: PipelineStep[];
}

// Global tooltip state for escaping container boundaries
const tooltipState = {
  show: false,
  data: null as any,
  position: { x: 0, y: 0 }
};

// Tooltip Portal Component - Renders at document body level
const TooltipPortal = () => {
  const [tooltip, setTooltip] = useState(tooltipState);

  useEffect(() => {
    const updateTooltip = () => setTooltip({...tooltipState});
    
    // Custom event listeners for tooltip updates
    document.addEventListener('tooltip-show', updateTooltip);
    document.addEventListener('tooltip-hide', updateTooltip);
    document.addEventListener('tooltip-move', updateTooltip);
    
    return () => {
      document.removeEventListener('tooltip-show', updateTooltip);
      document.removeEventListener('tooltip-hide', updateTooltip);
      document.removeEventListener('tooltip-move', updateTooltip);
    };
  }, []);

  if (!tooltip.show || !tooltip.data) return null;

  return createPortal(
    <div 
      className="fixed bg-gray-900 text-white text-sm rounded-lg px-3 py-2 min-w-max shadow-xl border border-gray-700 pointer-events-none transition-opacity duration-200 z-[9999]"
      style={{ 
        left: tooltip.position.x,
        top: tooltip.position.y,
        transform: 'translate(-50%, -105%)',
      }}
    >
      <div className="font-bold text-purple-300 mb-1">{tooltip.data.title}</div>
      <div className="opacity-90 mb-2">{tooltip.data.description}</div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Metric:</span>
          <span className="text-green-400 font-mono">{tooltip.data.metric}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Status:</span>
          <span className="text-blue-400">{tooltip.data.status}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Layer:</span>
          <span className="text-purple-400">{tooltip.data.layer}</span>
        </div>
        {tooltip.data.role && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Role:</span>
            <span className="text-cyan-400">{tooltip.data.role}</span>
          </div>
        )}
        {tooltip.data.throughput && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Throughput:</span>
            <span className="text-yellow-400">{tooltip.data.throughput}</span>
          </div>
        )}
      </div>
      {/* Tooltip arrow */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
    </div>,
    document.body
  );
};

// Compact UNIPATH Node Component with Unicode Icons
const UnipathNode = ({ data, selected }: any) => {
  const nodeRef = useRef<HTMLDivElement>(null);

  // Professional React Icon mapping
  const getIconComponent = () => {
    const iconMap = {
      'orchestrator': FaBullseye,
      'planner': FaBrain, 
      'deepseek': FaMicrochip,
      'embeddings': FaVectorSquare,
      'memory-manager': FaDatabase,
      'ephemeral': FaClock,
      'retrieval': FaSearch,
      'git-context': FaCodeBranch,
      'executor': FaCog,
      'tools-registry': FaTools,
      'monitoring': FaEye
    };
    
    return iconMap[data.nodeType as keyof typeof iconMap] || FaDatabase;
  };

  const IconComponent = getIconComponent();

  // Status color mapping
  const getStatusColor = () => {
    switch (data.status) {
      case 'Active': return 'bg-green-400';
      case 'Near Full': return 'bg-yellow-400';
      case 'Warning': return 'bg-orange-400';
      case 'Error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const handleMouseEnter = () => {
    if (nodeRef.current) {
      const rect = nodeRef.current.getBoundingClientRect();
      const tooltipX = rect.left + rect.width / 2;
      const tooltipY = rect.top - 5;
      
      tooltipState.show = true;
      tooltipState.data = data;
      tooltipState.position = { x: tooltipX, y: tooltipY };
      
      document.dispatchEvent(new CustomEvent('tooltip-show'));
    }
  };

  const handleMouseLeave = () => {
    tooltipState.show = false;
    tooltipState.data = null;
    document.dispatchEvent(new CustomEvent('tooltip-hide'));
  };

  const handleMouseMove = () => {
    if (nodeRef.current && tooltipState.show) {
      const rect = nodeRef.current.getBoundingClientRect();
      const tooltipX = rect.left + rect.width / 2;
      const tooltipY = rect.top - 5;
      
      tooltipState.position = { x: tooltipX, y: tooltipY };
      document.dispatchEvent(new CustomEvent('tooltip-move'));
    }
  };

  return (
    <div 
      ref={nodeRef}
      className="group relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Better Node Layout */}
      <div 
        className={`
          relative px-4 py-3 rounded-xl border-2 w-32 h-24
          transition-all duration-200 cursor-pointer group
          ${data.bgColor || 'bg-slate-800'} 
          ${selected 
            ? 'border-purple-400 shadow-lg shadow-purple-400/25 scale-105' 
            : 'border-slate-600 hover:border-purple-300 hover:scale-102'
          }
          text-white shadow-lg
        `}
      >
        {/* Connection Handles */}
        <Handle 
          type="target" 
          position={Position.Left} 
          className="w-3 h-3 bg-purple-500 border border-purple-300 opacity-0 group-hover:opacity-100" 
        />
        <Handle 
          type="source" 
          position={Position.Right} 
          className="w-3 h-3 bg-purple-500 border border-purple-300 opacity-0 group-hover:opacity-100" 
        />
        
        {/* Node Content */}
        <div className="flex flex-col items-center text-center h-full justify-between">
          {/* Professional Icon */}
          <IconComponent className="text-lg text-white" />
          
          {/* Title */}
          <div className="text-xs font-semibold leading-tight">
            {data.title}
          </div>
          
          {/* Metric */}
          <div className="text-[9px] font-mono bg-black bg-opacity-30 rounded px-1 py-0.5 text-green-200 leading-tight">
            {data.metric}
          </div>
          
          {/* Status Indicator */}
          <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`}></div>
        </div>
      </div>
    </div>
  );
};

// Custom component types
const nodeTypes = {
  unipath: UnipathNode,
};

export const Pipeline: React.FC<PipelineProps> = ({ steps }) => {
  // Get actual stats from the first step's metrics (contains pipeline stats)
  const statsStep = steps?.[0];
  const tokenUsage = statsStep?.metrics?.total || 0;
  const memoryChunks = statsStep?.metrics?.chunks || 0;
  const gitCommits = statsStep?.metrics?.commits || 0;

  // Get step counts from the actual steps data
  const getStepCount = (nodeId: string) => {
    const step = steps?.find(s => s.name === nodeId);
    return step?.executions || 0;
  };

  // EXACT PIXEL-PERFECT MATCH TO YOUR REFERENCE SCREENSHOT
  const unipathNodes: Node[] = [
    // TOP CENTER - DeepSeek LLM (aligned with memory manager)
    {
      id: 'deepseek',
      type: 'unipath',
      position: { x: 540, y: 80 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'deepseek',
        title: 'DeepSeek LLM',
        description: 'R1-0528 Model',
        metric: `${getStepCount('llm')} calls`,
        status: 'Active',
        layer: 'AI',
        bgColor: 'bg-green-700'
      },
    },

    // MAIN HORIZONTAL ROW - perfect spacing and alignment
    {
      id: 'orchestrator',
      type: 'unipath',
      position: { x: 75, y: 155 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'orchestrator',
        title: 'Orchestrator',
        description: 'Core Trio Leader',
        metric: `${getStepCount('orchestrator')} requests`,
        status: 'Active',
        layer: 'Input',
        bgColor: 'bg-blue-700'
      },
    },
    {
      id: 'planner',
      type: 'unipath',
      position: { x: 305, y: 155 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'planner',
        title: 'Planner',
        description: 'Task Decomposition',
        metric: `${getStepCount('planner')} plans`,
        status: 'Active',
        layer: 'Planning',
        bgColor: 'bg-purple-700'
      },
    },
    {
      id: 'executor',
      type: 'unipath',
      position: { x: 935, y: 155 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'executor',
        title: 'Executor',
        description: 'Task Runner',
        metric: `${getStepCount('input')} inputs`,
        status: 'Active',
        layer: 'Execution',
        bgColor: 'bg-red-700'
      },
    },
    {
      id: 'monitoring',
      type: 'unipath',
      position: { x: 1165, y: 155 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'monitoring',
        title: 'Monitoring',
        description: 'Real-time Metrics',
        metric: `${getStepCount('output')} outputs`,
        status: 'Active',
        layer: 'Output',
        bgColor: 'bg-indigo-700'
      },
    },

    // TOOLS REGISTRY - exactly aligned with monitoring
    {
      id: 'tools-registry',
      type: 'unipath',
      position: { x: 1165, y: 315 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'tools-registry',
        title: 'Tools Registry',
        description: 'Auto-discovery',
        metric: `${getStepCount('tools')} calls`,
        status: 'Active',
        layer: 'Tools',
        bgColor: 'bg-slate-700'
      },
    },

    // EPHEMERAL - evenly spaced column
    {
      id: 'ephemeral',
      type: 'unipath',
      position: { x: 740, y: 275 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'ephemeral',
        title: 'Ephemeral',
        description: 'Short-term Memory',
        metric: `${Math.min(tokenUsage, 5000)} / 5K`,
        status: 'Near Full',
        layer: 'Memory',
        bgColor: 'bg-orange-700'
      },
    },

    // MEMORY MANAGER - center position 
    {
      id: 'memory-manager',
      type: 'unipath',
      position: { x: 540, y: 375 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'memory-manager',
        title: 'Memory Manager',
        description: 'Context Orchestration',
        metric: `${Math.round(tokenUsage / 1000)}K / 59K`,
        status: 'Active',
        layer: 'Memory',
        bgColor: 'bg-cyan-700'
      },
    },
    
    // RETRIEVAL - evenly spaced column (100px gap from ephemeral)
    {
      id: 'retrieval',
      type: 'unipath',
      position: { x: 740, y: 375 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'retrieval',
        title: 'Retrieval',
        description: 'Long-term Memory',
        metric: `${Math.min(memoryChunks * 500, 40000)} / 40K`,
        status: 'Near Full',
        layer: 'Memory',
        bgColor: 'bg-teal-700'
      },
    },

    // GIT CONTEXT - evenly spaced column (100px gap from retrieval)
    {
      id: 'git-context',
      type: 'unipath',
      position: { x: 740, y: 475 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'git-context',
        title: 'Git Context',
        description: 'Repository Memory',
        metric: `${gitCommits} commits`,
        status: 'Active',
        layer: 'Memory',
        bgColor: 'bg-emerald-700'
      },
    },

    // EMBEDDINGS - evenly spaced column (100px gap from git context)
    {
      id: 'embeddings',
      type: 'unipath',
      position: { x: 740, y: 575 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'embeddings',
        title: 'Embeddings',
        description: 'Vector Processing',
        metric: `${getStepCount('embeddings')} vectors`,
        status: 'Active',
        layer: 'AI',
        bgColor: 'bg-lime-700'
      },
    },
  ];

  const unipathEdges: Edge[] = [
    // Main Flow
    {
      id: 'e1',
      source: 'orchestrator',
      target: 'planner',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#8b5cf6', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#8b5cf6' },
      label: `Task Request (${getStepCount('orchestrator')})`,
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    {
      id: 'e2',
      source: 'planner',
      target: 'deepseek',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#16a34a', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#16a34a' },
      label: `Reasoning (${getStepCount('planner')})`,
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    {
      id: 'e3',
      source: 'planner',
      target: 'memory-manager',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#06b6d4' },
      label: `Context (${getStepCount('memory')})`,
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Memory Manager → Memory Layers
    {
      id: 'e4',
      source: 'memory-manager',
      target: 'ephemeral',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#0891b2', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#0891b2' },
      label: '5K Budget',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    {
      id: 'e5',
      source: 'memory-manager',
      target: 'retrieval',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#0d9488', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#0d9488' },
      label: '40K Budget',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    {
      id: 'e6',
      source: 'memory-manager',
      target: 'git-context',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#059669', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#059669' },
      label: 'Git Data',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Memory → Executor
    {
      id: 'e7',
      source: 'ephemeral',
      target: 'executor',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#0891b2', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#0891b2' },
      label: 'Context',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    {
      id: 'e8',
      source: 'retrieval',
      target: 'executor',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#0d9488', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#0d9488' },
      label: 'Retrieved Data',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Planning → Executor (direct plan flow)
    {
      id: 'e9',
      source: 'planner',
      target: 'executor',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#3b82f6' },
      label: 'Execution Plan (0)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Executor → Tools
    {
      id: 'e10',
      source: 'executor',
      target: 'tools-registry',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#dc2626', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#dc2626' },
      label: `Tool Calls (${getStepCount('tools')})`,
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Final Output → Monitoring
    {
      id: 'e11',
      source: 'executor',
      target: 'monitoring',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#ea580c', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#ea580c' },
      label: `Results (${getStepCount('executor')})`,
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Memory Manager → Embeddings
    {
      id: 'e12',
      source: 'memory-manager',
      target: 'embeddings',
      type: 'default',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#84cc16', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#84cc16' },
      label: 'Vector Data',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(unipathNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(unipathEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <>
      {/* Global Tooltip Portal - Escapes all container boundaries */}
      <TooltipPortal />
      
      <div className="h-[700px] bg-slate-950 rounded-lg border border-slate-800">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{ padding: 0.05, includeHiddenNodes: false }}
          proOptions={{ hideAttribution: true }}
          className="bg-slate-950"
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          zoomOnDoubleClick={false}
          panOnDrag={true}
          selectNodesOnDrag={false}
          defaultViewport={{ x: 20, y: 20, zoom: 1.0 }}
          minZoom={0.5}
          maxZoom={2.0}
        >
          <Background 
            variant="dots" 
            gap={20} 
            size={1} 
            color="#475569" 
            className="opacity-30"
          />
        </ReactFlow>
      </div>
    </>
  );
};