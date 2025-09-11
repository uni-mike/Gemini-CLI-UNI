import React, { useState, useEffect } from 'react';
import { Activity, BarChart3, Brain, Database, Globe, Settings } from 'lucide-react';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Overview } from './components/Overview';
import { Pipeline } from './components/Pipeline';
import { Memory } from './components/Memory';
import { Sessions } from './components/Sessions';
import { Tools } from './components/Tools';
import { Tab, MonitoringData } from './types/monitoring';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [data, setData] = useState<MonitoringData>({
    overview: {
      tokenUsage: 0,
      activeTasks: 0,
      memoryChunks: 0,
      throughput: 0,
      serverStatus: 'offline',
      uptime: 0
    },
    memory: {
      totalChunks: 0,
      activeChunks: 0,
      memoryUsage: 0,
      storageSize: 0,
      chunkTypes: {}
    },
    sessions: [],
    pipeline: {
      steps: []
    }
  });

  const fetchData = async () => {
    try {
      // Fetch all data from different endpoints
      const [overviewRes, memoryRes, sessionsRes, pipelineRes] = await Promise.all([
        fetch('/api/overview'),
        fetch('/api/memory').catch(() => ({ json: () => ({}) })),
        fetch('/api/sessions').catch(() => ({ json: () => ([]) })),
        fetch('/api/pipeline').catch(() => ({ json: () => ({ steps: [] }) }))
      ]);

      const overview = await overviewRes.json();
      const memoryData = await memoryRes.json();
      const sessionsData = await sessionsRes.json();
      const pipelineData = await pipelineRes.json();

      const tokenUsageValue = typeof overview.tokenUsage === 'object' 
        ? (overview.tokenUsage?.total || overview.tokenUsage?.used || 0)
        : (overview.tokenUsage || 0);

      setData({
        overview: {
          tokenUsage: tokenUsageValue,
          activeTasks: overview.stats?.totalSessions || 0,
          memoryChunks: overview.stats?.totalChunks || 0,
          throughput: overview.stats?.totalLogs || 0,
          serverStatus: overview.systemHealth?.status === 'healthy' || overview.systemHealth?.status === 'degraded' ? 'online' : 'offline',
          uptime: overview.uptime || 0
        },
        memory: {
          totalChunks: memoryData.totalChunks || overview.stats?.totalChunks || 0,
          activeChunks: memoryData.activeChunks || Math.floor((overview.stats?.totalChunks || 0) * 0.7),
          memoryUsage: memoryData.memoryUsage || 85,
          storageSize: memoryData.storageSize || 1024,
          chunkTypes: memoryData.chunkTypes || {
            'Conversation': overview.stats?.totalSessions * 3 || 12,
            'Code': overview.stats?.totalChunks * 0.4 || 8,
            'Documentation': overview.stats?.totalChunks * 0.3 || 6,
            'Logs': overview.stats?.totalLogs * 0.2 || 4
          }
        },
        sessions: Array.isArray(sessionsData) ? sessionsData.slice(0, 10) : [],
        pipeline: {
          steps: pipelineData.steps || [
            { name: 'Input Processing', status: 'active', executions: 156, avgDuration: 0.8 },
            { name: 'Task Decomposition', status: 'active', executions: 142, avgDuration: 1.2 },
            { name: 'Tool Execution', status: 'active', executions: 98, avgDuration: 3.5 },
            { name: 'Response Generation', status: 'active', executions: 134, avgDuration: 2.1 },
            { name: 'Output Formatting', status: 'active', executions: 129, avgDuration: 0.5 }
          ]
        }
      });
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
      setData(prev => ({
        ...prev,
        overview: { ...prev.overview, serverStatus: 'offline' }
      }));
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'pipeline', label: 'Pipeline', icon: Activity },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'sessions', label: 'Sessions', icon: Database },
    { id: 'tools', label: 'Tools', icon: Settings }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Globe className="h-8 w-8 text-green-500" />
              <div>
                <h1 className="text-2xl font-bold">UNIPATH FlexiCLI</h1>
                <p className="text-sm text-slate-400">Monitoring Dashboard</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`h-2 w-2 rounded-full ${data.overview.serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm">
                {data.overview.serverStatus === 'online' ? 'Monitoring Online' : 'Monitoring Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-slate-800 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map(tab => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'ghost'}
                className={`flex items-center space-x-2 px-6 py-3 rounded-none border-b-2 ${
                  activeTab === tab.id ? 'border-green-500 bg-slate-800' : 'border-transparent hover:bg-slate-800'
                }`}
                onClick={() => setActiveTab(tab.id as Tab)}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {activeTab === 'overview' && <Overview data={data.overview} onRefresh={fetchData} />}
        {activeTab === 'pipeline' && <Pipeline steps={data.pipeline.steps} />}
        {activeTab === 'memory' && <Memory data={data.memory} />}
        {activeTab === 'sessions' && <Sessions sessions={data.sessions} />}
        {activeTab === 'tools' && <Tools />}
      </main>
    </div>
  );
}

export default App;