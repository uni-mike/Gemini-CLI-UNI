import React, { useState, useEffect } from 'react';
import { Activity, BarChart3, Brain, Database, Globe, Settings, ChevronDown } from 'lucide-react';
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
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
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
      // DIRECTLY CALL BACKEND ON PORT 4000 - BYPASS VITE PROXY
      const BACKEND_URL = 'http://localhost:4000';

      // Fetch all data from different endpoints
      const [overviewRes, memoryRes, sessionsRes, pipelineRes, agentsRes, projectsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/overview`).catch(err => { console.error('Overview fetch error:', err); return { ok: false }; }),
        fetch(`${BACKEND_URL}/api/memory`).catch(err => { console.error('Memory fetch error:', err); return { ok: false }; }),
        fetch(`${BACKEND_URL}/api/sessions`).catch(err => { console.error('Sessions fetch error:', err); return { ok: false }; }),
        fetch(`${BACKEND_URL}/api/pipeline`).catch(err => { console.error('Pipeline fetch error:', err); return { ok: false }; }),
        fetch(`${BACKEND_URL}/api/agents`).catch(err => { console.error('Agents fetch error:', err); return { ok: false }; }),
        fetch(`${BACKEND_URL}/api/projects`).catch(err => { console.error('Projects fetch error:', err); return { ok: false }; })
      ]);

      const overview = overviewRes.ok ? await overviewRes.json() : {};
      const memoryData = memoryRes.ok ? await memoryRes.json() : {};
      const sessionsData = sessionsRes.ok ? await sessionsRes.json() : [];
      const pipelineData = pipelineRes.ok ? await pipelineRes.json() : { steps: [] };
      const agentsData = agentsRes.ok ? await agentsRes.json() : [];
      const projectsData = projectsRes.ok ? await projectsRes.json() : [];

      // Update available agents and set primary as selected if none selected
      setAvailableAgents(agentsData);
      if (!selectedAgent && agentsData.length > 0) {
        const primary = agentsData.find(agent => agent.isPrimary) || agentsData[0];
        setSelectedAgent(primary);
      }

      // Update available projects and set active as selected if none selected
      setAvailableProjects(projectsData);
      if (!selectedProject && projectsData.length > 0) {
        const active = projectsData.find(project => project.status === 'active') || projectsData[0];
        setSelectedProject(active);
      }

      const tokenUsageValue = typeof overview.tokenUsage === 'object' 
        ? (overview.tokenUsage?.total || overview.tokenUsage?.used || 0)
        : (overview.tokenUsage || 0);

      const serverStatus = overview.tokenUsage > 0 || overview.activeTasks >= 0 ? 'online' : 'offline';

      setData({
        overview: {
          tokenUsage: tokenUsageValue,
          activeTasks: overview.activeTasks || 0,
          memoryChunks: memoryData.layers?.reduce((sum, layer) => sum + (layer.chunks || 0), 0) || 0,
          throughput: overview.completedTasks || 0,
          serverStatus: serverStatus,
          uptime: overview.systemHealth?.uptime || process.uptime() || 0
        },
        memory: {
          totalChunks: memoryData.layers?.reduce((sum, layer) => sum + (layer.chunks || layer.entries || (layer.context?.length || 0)), 0) || overview.stats?.totalChunks || 0,
          activeChunks: memoryData.layers?.filter(layer => layer.status === 'active').length || 0,
          memoryUsage: Math.round(overview.systemHealth?.memoryUsage?.percentage || 50),
          storageSize: overview.systemHealth?.diskUsage?.dbSize ? Math.round(overview.systemHealth.diskUsage.dbSize / 1024) : 0,
          chunkTypes: memoryData.layers?.reduce((types, layer) => {
            types[layer.name] = layer.chunks || layer.entries || (layer.context?.length || 0) || 0;
            return types;
          }, {}) || {}
        },
        sessions: Array.isArray(sessionsData) ? sessionsData.slice(0, 10) : [],
        pipeline: {
          steps: pipelineData.nodes ? pipelineData.nodes.map(node => ({
            name: node.id,
            status: node.data?.status || 'idle',
            executions: node.data?.count || 0,
            avgDuration: node.data?.avgDuration || 0,
            metrics: {
              count: node.data?.count || 0,
              executions: node.data?.count || 0,
              total: pipelineData.stats?.totalTokens || 9400,
              chunks: pipelineData.stats?.memoryChunks || 18,
              commits: pipelineData.stats?.gitCommits || 447
            }
          })) : []
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
    const interval = setInterval(fetchData, 10000); // Back to original 10 seconds
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
            <div className="flex items-center space-x-4">
              {/* Project Display */}
              {availableProjects.length === 1 && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-slate-400">Project:</span>
                  <span className="font-medium">{availableProjects[0].name}</span>
                </div>
              )}
              {/* Project Selector - Only show if multiple projects */}
              {availableProjects.length > 1 && (
                <div className="relative">
                  <button 
                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                    className="flex items-center space-x-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-medium">
                      {selectedProject ? selectedProject.name : 'No Project'}
                      {selectedProject?.status === 'active' && <span className="ml-1 text-green-400">●</span>}
                    </span>
                    {availableProjects.length > 1 && (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {availableProjects.length > 1 && showProjectDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                      {availableProjects.map(project => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSelectedProject(project);
                            setShowProjectDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                            selectedProject?.id === project.id ? 'bg-slate-700' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium">{project.name}</div>
                            <div className="text-slate-400">{project.type} • {project.status}</div>
                          </div>
                          {project.status === 'active' && <span className="text-green-400">● Active</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Agent Display - Show current agent status */}
              {availableAgents.length === 0 && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-slate-400">Agent:</span>
                  <span className="text-yellow-400">No agents connected</span>
                </div>
              )}
              {availableAgents.length === 1 && (
                <div className="flex items-center space-x-2 text-sm">
                  <span className="text-slate-400">Agent:</span>
                  <span className="font-medium">
                    {availableAgents[0].projectName}
                    {availableAgents[0].isPrimary && <span className="ml-1 text-green-400">●</span>}
                  </span>
                </div>
              )}
              {/* Agent Switcher - Show dropdown if multiple agents */}
              {availableAgents.length > 1 && (
                <div className="relative">
                  <button 
                    onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                    className="flex items-center space-x-2 bg-slate-800 rounded-lg px-3 py-2 border border-slate-700 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <span className="text-sm font-medium">
                      {selectedAgent ? `${selectedAgent.projectName} (PID ${selectedAgent.pid})` : 'No Agent'}
                      {selectedAgent?.isPrimary && <span className="ml-1 text-green-400">●</span>}
                    </span>
                    {availableAgents.length > 1 && (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </button>
                  {availableAgents.length > 1 && showAgentDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-50">
                      {availableAgents.map(agent => (
                        <button
                          key={agent.pid}
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowAgentDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg flex items-center justify-between ${
                            selectedAgent?.pid === agent.pid ? 'bg-slate-700' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium">{agent.projectName}</div>
                            <div className="text-slate-400">PID {agent.pid} • {Math.round(agent.memory.rss / 1024 / 1024)}MB</div>
                          </div>
                          {agent.isPrimary && <span className="text-green-400">● Primary</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={`h-2 w-2 rounded-full ${data.overview.serverStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm">
                  {data.overview.serverStatus === 'online' ? 'Monitoring Online' : 'Monitoring Offline'}
                </span>
              </div>
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