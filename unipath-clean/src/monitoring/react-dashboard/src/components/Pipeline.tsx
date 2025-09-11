import React, { useCallback } from 'react';
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
} from 'reactflow';
import 'reactflow/dist/style.css';
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

// Compact UNIPATH Node Component with Unicode Icons
const UnipathNode = ({ data, selected }: any) => {
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

  return (
    <div className="group relative">
      {/* Comprehensive Tooltip */}
      <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 min-w-max shadow-xl border border-gray-700 pointer-events-none">
        <div className="font-bold text-purple-300 mb-1">{data.title}</div>
        <div className="opacity-90 mb-2">{data.description}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Metric:</span>
            <span className="text-green-400 font-mono">{data.metric}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Status:</span>
            <span className="text-blue-400">{data.status}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Layer:</span>
            <span className="text-purple-400">{data.layer}</span>
          </div>
          {data.role && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Role:</span>
              <span className="text-cyan-400">{data.role}</span>
            </div>
          )}
          {data.throughput && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Throughput:</span>
              <span className="text-yellow-400">{data.throughput}</span>
            </div>
          )}
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>

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
  // EXACT PIXEL-PERFECT MATCH TO YOUR REFERENCE SCREENSHOT
  const unipathNodes: Node[] = [
    // TOP CENTER - DeepSeek LLM (exactly as shown)
    {
      id: 'deepseek',
      type: 'unipath',
      position: { x: 504, y: 85 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'deepseek',
        title: 'DeepSeek LLM',
        description: 'R1-0528 Model',
        metric: '234K tokens/min',
        status: 'Active',
        layer: 'AI',
        bgColor: 'bg-green-700'
      },
    },

    // MAIN HORIZONTAL ROW - perfectly aligned
    {
      id: 'orchestrator',
      type: 'unipath',
      position: { x: 78, y: 175 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'orchestrator',
        title: 'Orchestrator',
        description: 'Core Trio Leader',
        metric: '1,247 req/min',
        status: 'Active',
        layer: 'Input',
        bgColor: 'bg-blue-700'
      },
    },
    {
      id: 'planner',
      type: 'unipath',
      position: { x: 306, y: 175 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'planner',
        title: 'Planner',
        description: 'Task Decomposition',
        metric: '89 plans/min',
        status: 'Active',
        layer: 'Planning',
        bgColor: 'bg-purple-700'
      },
    },
    {
      id: 'executor',
      type: 'unipath',
      position: { x: 928, y: 175 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'executor',
        title: 'Executor',
        description: 'Task Runner',
        metric: '873 tasks/min',
        status: 'Active',
        layer: 'Execution',
        bgColor: 'bg-red-700'
      },
    },
    {
      id: 'monitoring',
      type: 'unipath',
      position: { x: 1164, y: 175 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'monitoring',
        title: 'Monitoring',
        description: 'Real-time Metrics',
        metric: '345 results/min',
        status: 'Active',
        layer: 'Output',
        bgColor: 'bg-indigo-700'
      },
    },

    // TOOLS REGISTRY - top right
    {
      id: 'tools-registry',
      type: 'unipath',
      position: { x: 1186, y: 315 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'tools-registry',
        title: 'Tools Registry',
        description: 'Auto-discovery',
        metric: '234 tool calls/min',
        status: 'Active',
        layer: 'Tools',
        bgColor: 'bg-slate-700'
      },
    },

    // EPHEMERAL - positioned exactly as in reference
    {
      id: 'ephemeral',
      type: 'unipath',
      position: { x: 728, y: 275 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'ephemeral',
        title: 'Ephemeral',
        description: 'Short-term Memory',
        metric: '4,892 / 5,000',
        status: 'Near Full',
        layer: 'Memory',
        bgColor: 'bg-orange-700'
      },
    },

    // MEMORY MANAGER - center position
    {
      id: 'memory-manager',
      type: 'unipath',
      position: { x: 534, y: 375 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'memory-manager',
        title: 'Memory Manager',
        description: 'Context Orchestration',
        metric: '59K budget total',
        status: 'Active',
        layer: 'Memory',
        bgColor: 'bg-cyan-700'
      },
    },
    
    // RETRIEVAL - positioned as in reference
    {
      id: 'retrieval',
      type: 'unipath',
      position: { x: 734, y: 375 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'retrieval',
        title: 'Retrieval',
        description: 'Long-term Memory',
        metric: '38,456 / 40,000',
        status: 'Near Full',
        layer: 'Memory',
        bgColor: 'bg-teal-700'
      },
    },

    // GIT CONTEXT - positioned as in reference
    {
      id: 'git-context',
      type: 'unipath',
      position: { x: 734, y: 485 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'git-context',
        title: 'Git Context',
        description: 'Repository Memory',
        metric: '156 commits',
        status: 'Active',
        layer: 'Memory',
        bgColor: 'bg-emerald-700'
      },
    },

    // EMBEDDINGS - below Git Context as requested
    {
      id: 'embeddings',
      type: 'unipath',
      position: { x: 734, y: 585 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { 
        nodeType: 'embeddings',
        title: 'Embeddings',
        description: 'Vector Processing',
        metric: '1.2M vectors/min',
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
      type: 'bezier',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#8b5cf6', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#8b5cf6' },
      label: 'Task Request (1247)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    {
      id: 'e2',
      source: 'planner',
      target: 'deepseek',
      type: 'bezier',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#16a34a', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#16a34a' },
      label: 'Reasoning (89)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    {
      id: 'e3',
      source: 'planner',
      target: 'memory-manager',
      type: 'bezier',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#06b6d4', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#06b6d4' },
      label: 'Context Requests (89)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Memory Manager → Memory Layers
    {
      id: 'e4',
      source: 'memory-manager',
      target: 'ephemeral',
      type: 'bezier',
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
      type: 'bezier',
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
      type: 'bezier',
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
      type: 'bezier',
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
      type: 'bezier',
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
      type: 'bezier',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#3b82f6', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#3b82f6' },
      label: 'Execution Plan (873)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Executor → Tools
    {
      id: 'e10',
      source: 'executor',
      target: 'tools-registry',
      type: 'bezier',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#dc2626', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#dc2626' },
      label: 'Tool Calls (234)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Final Output → Monitoring
    {
      id: 'e11',
      source: 'executor',
      target: 'monitoring',
      type: 'bezier',
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: { stroke: '#ea580c', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed', color: '#ea580c' },
      label: 'Results (345)',
      labelStyle: { fontSize: 9, fontWeight: '600', fill: '#ffffff' },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.8, rx: 4 }
    },
    
    // Memory Manager → Embeddings
    {
      id: 'e12',
      source: 'memory-manager',
      target: 'embeddings',
      type: 'bezier',
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
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        proOptions={{ hideAttribution: true }}
        className="bg-slate-950"
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        zoomOnDoubleClick={false}
        panOnDrag={true}
        selectNodesOnDrag={false}
        defaultViewport={{ x: 50, y: 50, zoom: 0.75 }}
        minZoom={0.4}
        maxZoom={1.5}
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
  );
};