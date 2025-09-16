import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { MemoryData } from '../types/monitoring';
import { formatNumber, formatPercentage } from '../utils/formatting';

interface MemoryProps {
  data: MemoryData;
}

export const Memory: React.FC<MemoryProps> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Memory Usage Bar Chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Memory Usage by Type</CardTitle>
              <CardDescription className="text-slate-400">
                Horizontal bar chart showing chunk distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(data.chunkTypes).map(([type, count]) => (
                  <div key={type} className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">{type}</span>
                      <span className="text-sm text-slate-400">{formatNumber(count)} chunks</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-500"
                        style={{ 
                          width: `${formatPercentage(count, Math.max(...Object.values(data.chunkTypes)))}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Memory Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Memory Statistics</CardTitle>
            <CardDescription className="text-slate-400">Current memory utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Stored Items</span>
                <span className="font-mono">{formatNumber(data.totalChunks)}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Memory Layers</span>
                <span className="font-mono">{formatNumber(data.activeChunks)}</span>
              </div>
              <div className="flex justify-between">
                <span>Agent Memory Usage</span>
                <span className="font-mono">{data.memoryUsage}%</span>
              </div>
              <div className="flex justify-between">
                <span>Database Size</span>
                <span className="font-mono">{data.storageSize} MB</span>
              </div>
            </div>
            <div className="pt-4">
              <div className="text-sm text-slate-400 mb-2">Memory Usage</div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data.memoryUsage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};