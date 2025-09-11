import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
import { Tooltip } from './ui/tooltip';
import { Grid, List, Search } from 'lucide-react';
import { Tool, ToolCategory } from '../types/monitoring';

const TOOLS_DATA: Tool[] = [
  { name: 'Bash', status: 'active', executions: 89, description: 'Shell command execution' },
  { name: 'Read', status: 'active', executions: 156, description: 'File system read operations' },
  { name: 'Write', status: 'active', executions: 67, description: 'File system write operations' },
  { name: 'Edit', status: 'active', executions: 43, description: 'File content modification' },
  { name: 'WebSearch', status: 'active', executions: 23, description: 'Web search capabilities' },
  { name: 'WebFetch', status: 'active', executions: 18, description: 'HTTP content retrieval' },
  { name: 'Grep', status: 'active', executions: 34, description: 'Pattern matching search' },
  { name: 'Glob', status: 'active', executions: 29, description: 'File pattern matching' }
];

const TOOL_CATEGORIES: ToolCategory[] = [
  { category: 'File Operations', tools: 4, healthy: 4, issues: 0 },
  { category: 'Web Operations', tools: 2, healthy: 2, issues: 0 },
  { category: 'Search Tools', tools: 2, healthy: 2, issues: 0 },
  { category: 'System Tools', tools: 1, healthy: 1, issues: 0 }
];

const USAGE_STATS = [
  { name: 'Read', usage: 34 },
  { name: 'Bash', usage: 19 },
  { name: 'Write', usage: 15 },
  { name: 'Grep', usage: 8 }
];

export const Tools: React.FC = () => {
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const totalToolCalls = TOOLS_DATA.reduce((sum, tool) => sum + tool.executions, 0);

  const handleToolClick = (tool: Tool) => {
    setSelectedTool(tool);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTool(null);
  };

  // Generate mock execution data for the selected tool
  const generateExecutionData = (tool: Tool) => {
    const allExecutions = Array.from({ length: 50 }, (_, i) => ({
      id: `exec-${i + 1}`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      status: Math.random() > 0.1 ? 'success' : 'error',
      duration: Math.random() * 5000 + 100,
      parameters: tool.name === 'Bash' ? `command: ls -la /path/to/directory/with/long/path/structure/dir${i}` :
                   tool.name === 'Read' ? `file: /very/long/path/to/some/deeply/nested/file${i}.txt` :
                   tool.name === 'WebSearch' ? `query: TypeScript best practices and advanced patterns for modern development ${i}` :
                   `input: sample_data_with_longer_content_${i}`,
      output: tool.name === 'Bash' ? `drwxr-xr-x 5 user staff 160 Dec 10 14:30 .\ndrwxr-xr-x 12 user staff 384 Dec 9 16:45 ..\n-rw-r--r-- 1 user staff 1024 Dec 10 14:30 file${i}.txt` :
              tool.name === 'Read' ? `File content successfully read (${Math.floor(Math.random() * 10000)} bytes). Content includes multiple lines of text with various data structures and configurations.` :
              `Operation completed successfully with detailed output information and status ${i}`
    }));

    // Filter by status
    const filteredByStatus = statusFilter === 'all' ? allExecutions : 
      allExecutions.filter(exec => exec.status === statusFilter);

    // Filter by search query
    const filteredBySearch = searchQuery ? 
      filteredByStatus.filter(exec => 
        exec.parameters.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exec.output.toLowerCase().includes(searchQuery.toLowerCase()) ||
        exec.id.toLowerCase().includes(searchQuery.toLowerCase())
      ) : filteredByStatus;

    return filteredBySearch;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Available Tools */}
        <Card>
          <CardHeader>
            <CardTitle>Available Tools</CardTitle>
            <CardDescription className="text-slate-400">
              UNIPATH CLI tool inventory and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {TOOLS_DATA.map((tool) => (
                <div 
                  key={tool.name} 
                  className="flex items-center justify-between p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
                  onClick={() => handleToolClick(tool)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      tool.status === 'active' ? 'bg-green-500' : 'bg-slate-500'
                    }`} />
                    <div>
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-sm text-slate-400">{tool.description}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-green-400">{tool.executions}</div>
                    <div className="text-xs text-slate-500">executions</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tool Usage Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Tool Usage Metrics</CardTitle>
            <CardDescription className="text-slate-400">Performance and utilization data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Total Tool Calls</span>
                <span className="font-mono text-green-500">{totalToolCalls}</span>
              </div>
              <div className="flex justify-between">
                <span>Success Rate</span>
                <span className="font-mono text-green-500">98.7%</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Response Time</span>
                <span className="font-mono text-blue-400">1.2s</span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate</span>
                <span className="font-mono text-red-400">1.3%</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-700">
              <h4 className="font-medium mb-3">Most Used Tools</h4>
              <div className="space-y-2">
                {USAGE_STATS.map((tool) => (
                  <div key={tool.name} className="flex items-center justify-between">
                    <span className="text-sm">{tool.name}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-slate-700 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full"
                          style={{ width: `${tool.usage}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-8">{tool.usage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tool Health Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle>Tool Health Monitor</CardTitle>
          <CardDescription className="text-slate-400">
            Real-time status and performance monitoring
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {TOOL_CATEGORIES.map((category) => (
              <div key={category.category} className="bg-slate-800 rounded-lg p-4">
                <h4 className="font-medium mb-2">{category.category}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span className="font-mono">{category.tools}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Healthy:</span>
                    <span className="font-mono text-green-400">{category.healthy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Issues:</span>
                    <span className="font-mono text-red-400">{category.issues}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tool Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={`${selectedTool?.name} Tool Executions`}
        size="wide"
      >
        {selectedTool && (
          <div className="space-y-6">
            {/* Tool Overview */}
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-slate-400">Total Executions</div>
                  <div className="text-xl font-bold text-green-500">{selectedTool.executions}</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Success Rate</div>
                  <div className="text-xl font-bold text-green-500">94.2%</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Avg Duration</div>
                  <div className="text-xl font-bold text-blue-400">1.8s</div>
                </div>
                <div>
                  <div className="text-sm text-slate-400">Status</div>
                  <Badge className={selectedTool.status === 'active' ? 'bg-green-600' : 'bg-slate-600'}>
                    {selectedTool.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Execution History */}
            <div>
              <div className="flex flex-col space-y-4 mb-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Recent Executions</h3>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-slate-400">View:</span>
                    <button
                      onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
                      className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors flex items-center space-x-2"
                    >
                      {viewMode === 'table' ? (
                        <>
                          <Grid className="h-4 w-4" />
                          <span className="text-sm font-medium">Table View</span>
                        </>
                      ) : (
                        <>
                          <List className="h-4 w-4" />
                          <span className="text-sm font-medium">Card View</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search executions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'error')}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm min-w-24"
                  >
                    <option value="all">All Status</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>

              {viewMode === 'table' ? (
                <div className="max-h-96 overflow-y-auto overflow-x-hidden w-full">
                  {/* Header */}
                  <div className="sticky top-0 bg-slate-900 border-b border-slate-700 grid grid-cols-6 gap-3 p-3 font-medium text-slate-400 text-sm min-w-0"
                       style={{gridTemplateColumns: '12% 10% 16% 10% 26% 26%'}}>
                    <div className="truncate">ID</div>
                    <div className="truncate">Status</div>
                    <div className="truncate">Timestamp</div>
                    <div className="truncate">Duration</div>
                    <div className="truncate">Input</div>
                    <div className="truncate">Output</div>
                  </div>
                  
                  {/* Data Rows */}
                  <div className="space-y-0 w-full min-w-0">
                    {generateExecutionData(selectedTool).map((execution) => (
                      <div key={execution.id} 
                           className="grid grid-cols-6 gap-3 p-3 border-b border-slate-800 hover:bg-slate-800/30 text-sm items-center min-w-0 w-full"
                           style={{gridTemplateColumns: '12% 10% 16% 10% 26% 26%'}}>
                        <div className="font-mono text-xs truncate min-w-0">{execution.id}</div>
                        <div className="min-w-0 truncate">
                          <Badge className={execution.status === 'success' ? 'bg-green-600' : 'bg-red-600'}>
                            {execution.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400 truncate min-w-0">
                          {new Date(execution.timestamp).toLocaleString()}
                        </div>
                        <div className="text-blue-400 font-mono text-xs truncate min-w-0">
                          {execution.duration.toFixed(0)}ms
                        </div>
                        <Tooltip content={execution.parameters} className="text-green-400 font-mono text-xs block">
                          <div 
                            className="cursor-help" 
                            style={{
                              width: '100%',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block'
                            }}
                          >
                            {execution.parameters}
                          </div>
                        </Tooltip>
                        <Tooltip content={execution.output} className="text-slate-300 font-mono text-xs block">
                          <div 
                            className="cursor-help" 
                            style={{
                              width: '100%',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block'
                            }}
                          >
                            {execution.output}
                          </div>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                  {generateExecutionData(selectedTool).map((execution) => (
                    <div key={execution.id} className="bg-slate-800 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-sm">{execution.id}</span>
                        <Badge className={execution.status === 'success' ? 'bg-green-600' : 'bg-red-600'}>
                          {execution.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(execution.timestamp).toLocaleString()}
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400">Duration: </span>
                        <span className="text-blue-400 font-mono">{execution.duration.toFixed(0)}ms</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400">Input: </span>
                        <Tooltip content={execution.parameters}>
                          <span className="text-green-400 font-mono text-xs cursor-help">
                            {execution.parameters && execution.parameters.length > 80 ? `${execution.parameters.substring(0, 80)}...` : execution.parameters}
                          </span>
                        </Tooltip>
                      </div>
                      <div className="text-sm">
                        <span className="text-slate-400">Output: </span>
                        <Tooltip content={execution.output}>
                          <span className="text-slate-300 font-mono text-xs cursor-help block">
                            {execution.output && execution.output.length > 80 ? `${execution.output.substring(0, 80)}...` : execution.output}
                          </span>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};