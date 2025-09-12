import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { SessionData } from '../types/monitoring';

interface SessionsProps {
  sessions: SessionData[];
}

export const Sessions: React.FC<SessionsProps> = ({ sessions }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription className="text-slate-400">
            Latest monitoring sessions and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left p-3 font-medium text-slate-400">Session ID</th>
                    <th className="text-left p-3 font-medium text-slate-400">Status</th>
                    <th className="text-left p-3 font-medium text-slate-400">Created</th>
                    <th className="text-left p-3 font-medium text-slate-400">Tokens</th>
                    <th className="text-left p-3 font-medium text-slate-400">Chunks</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, index) => (
                    <tr key={session.id || index} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="p-3 font-mono text-sm">
                        {session.id?.substring(0, 8) || `session-${index}`}
                      </td>
                      <td className="p-3">
                        <Badge className={`${
                          session.status === 'active' ? 'bg-green-600 text-white' : 
                          session.status === 'completed' ? 'bg-blue-600 text-white' : 'bg-slate-600 text-white'
                        }`}>
                          {session.status || 'active'}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-slate-400">
                        {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Recently'}
                      </td>
                      <td className="p-3 font-mono text-sm">
                        {session.tokensUsed || 0}
                      </td>
                      <td className="p-3 font-mono text-sm">
                        {session.chunksCreated || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <p>No sessions found</p>
              <p className="text-sm mt-2">Sessions will appear here when the system is active</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};