/**
 * PIPELINE COMPONENT - WORKING IMPLEMENTATION
 *
 * ⚠️ WARNING: This component has been carefully fixed to work with React Flow and API data.
 * DO NOT MODIFY the following critical parts:
 * 1. useNodesState and useEdgesState must start with empty arrays []
 * 2. useEffect must have NO dependencies (empty array [])
 * 3. setNodes and setEdges must be called directly in the fetch callback
 * 4. DO NOT add intermediate state variables for nodes/edges
 * 5. DO NOT add dependencies to the useEffect
 *
 * Breaking any of these rules will cause:
 * - Infinite render loops
 * - Empty charts
 * - API fetch failures
 * - React Flow errors
 *
 * Last working: 2025-09-14 - Shows 9 nodes from API correctly
 */

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
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
  // IMPORTANT: DO NOT CHANGE THIS INITIALIZATION - nodes/edges must start empty
  // DO NOT add default values or the chart will break!
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // CRITICAL: This useEffect MUST run only ONCE on mount - DO NOT add dependencies!
  // Adding dependencies will cause infinite loops and break the chart rendering
  useEffect(() => {
    const fetchPipelineData = async () => {
      try {
        // WORKING: This fetches real data from the backend API with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        // DIRECTLY CALL BACKEND ON PORT 4000 - BYPASS VITE PROXY
        const response = await fetch('http://localhost:4000/api/pipeline', {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        console.log('Pipeline API data:', data);

        // IMPORTANT: Transform and set nodes directly - DO NOT use intermediate state
        // The nodes MUST be set directly in this useEffect to avoid re-render issues
        if (data.nodes) {
          const transformedNodes = data.nodes.map((node: any) => ({
            id: node.id,
            type: 'unipath',
            position: node.position,
            data: {
              nodeType: node.id,
              title: node.data.label,
              description: `${node.type} node`,
              metric: `${node.data.count} calls`,
              status: node.data.status === 'processing' ? 'Active' : node.data.status,
              layer: node.type === 'input' ? 'Input' : node.type === 'output' ? 'Output' : 'Processing',
              bgColor: node.type === 'input' ? 'bg-blue-700' :
                        node.type === 'output' ? 'bg-indigo-700' :
                        node.id === 'orchestrator' ? 'bg-purple-700' :
                        node.id === 'planner' ? 'bg-green-700' :
                        node.id === 'memory' ? 'bg-cyan-700' :
                        node.id === 'executor' ? 'bg-red-700' :
                        node.id === 'tools' ? 'bg-slate-700' :
                        node.id === 'llm' ? 'bg-orange-700' :
                        node.id === 'embeddings' ? 'bg-lime-700' :
                        'bg-gray-700'
            }
          }));
          console.log('Setting nodes:', transformedNodes);
          // WORKING: Direct setNodes call - DO NOT wrap in useEffect or add conditions
          setNodes(transformedNodes);
        }

        // IMPORTANT: Transform and set edges directly - same as nodes
        // DO NOT use intermediate state or dependencies
        if (data.edges) {
          const transformedEdges = data.edges.map((edge: any) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: 'default',
            animated: edge.animated || false,
            style: edge.style || { stroke: '#8b5cf6', strokeWidth: 2 },
            markerEnd: { type: 'arrowclosed', color: '#8b5cf6' }
          }));
          // WORKING: Direct setEdges call - DO NOT wrap in useEffect or add conditions
          setEdges(transformedEdges);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error('Pipeline fetch timeout after 5 seconds');
        } else {
          console.error('Error fetching pipeline data:', error);
        }
      }
    };

    fetchPipelineData();
  }, []); // CRITICAL: Empty dependency array - NEVER add dependencies here!

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