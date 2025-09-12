import React from 'react';
import { Activity, BarChart3, Brain, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MonitoringData } from '../types/monitoring';
import { formatUptime } from '../utils/formatting';

interface OverviewProps {
  data: MonitoringData['overview'];
  onRefresh: () => void;
}

export const Overview: React.FC<OverviewProps> = ({ data, onRefresh }) => {
  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Usage</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {data.tokenUsage.toLocaleString()}
            </div>
            <p className="text-xs text-slate-400">Total consumed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
            <BarChart3 className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {data.activeTasks || 0}
            </div>
            <p className="text-xs text-slate-400">Currently running</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Chunks</CardTitle>
            <Brain className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {data.memoryChunks || 0}
            </div>
            <p className="text-xs text-slate-400">Stored in memory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Globe className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {formatUptime(data.uptime || 0)}
            </div>
            <p className="text-xs text-slate-400">System online</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system health and performance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Monitoring Server</span>
              <Badge className={`${data.serverStatus === 'online' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {data.serverStatus}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Total Sessions</span>
              <span className="font-mono">{data.activeTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Throughput</span>
              <span className="font-mono">{data.throughput} ops</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage monitoring and system operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full" onClick={onRefresh}>
              Refresh Data
            </Button>
            <Button variant="outline" className="w-full">
              Export Logs
            </Button>
            <Button variant="outline" className="w-full">
              System Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};