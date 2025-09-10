import React, { useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Tooltip } from '@mui/material';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';

const nodeColor = (node: Node) => {
  switch (node.data.status) {
    case 'processing':
      return '#ffa726';
    case 'completed':
      return '#66bb6a';
    case 'error':
      return '#f44336';
    default:
      return '#64748b';
  }
};

const PipelineFlow: React.FC = () => {
  const { socket } = useSocket();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial pipeline structure
    const loadPipeline = async () => {
      try {
        const response = await axios.get('http://localhost:4000/api/pipeline');
        setNodes(response.data.nodes);
        setEdges(response.data.edges);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load pipeline:', error);
        setLoading(false);
      }
    };

    loadPipeline();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for pipeline updates
    socket.on('metrics:pipelineStageStart', (stage: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === stage.id) {
            return {
              ...node,
              data: {
                ...node.data,
                status: 'processing',
                metrics: stage,
              },
            };
          }
          return node;
        })
      );
    });

    socket.on('metrics:pipelineStageComplete', (stage: any) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === stage.id) {
            return {
              ...node,
              data: {
                ...node.data,
                status: stage.error ? 'error' : 'completed',
                metrics: stage,
              },
            };
          }
          return node;
        })
      );
    });

    return () => {
      socket.off('metrics:pipelineStageStart');
      socket.off('metrics:pipelineStageComplete');
    };
  }, [socket]);

  if (loading) {
    return <Box>Loading pipeline...</Box>;
  }

  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
      >
        <Background color="#aaa" gap={16} />
        <MiniMap 
          nodeColor={nodeColor}
          style={{
            backgroundColor: '#1e293b',
          }}
        />
        <Controls />
      </ReactFlow>
    </Box>
  );
};

export default PipelineFlow;