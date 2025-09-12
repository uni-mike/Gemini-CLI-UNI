import React from 'react';
import { X } from 'lucide-react';

interface Tool {
  name: string;
  icon: React.ComponentType<any>;
  count: number;
  color: string;
}

interface ToolModalProps {
  tool: Tool;
  onClose: () => void;
}

const ToolModal: React.FC<ToolModalProps> = ({ tool, onClose }) => {
  const [executions, setExecutions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchExecutions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tools/${tool.name}/executions`);
        const data = await response.json();
        
        if (data.error) {
          // API returned an error (expected when no data exists)
          setExecutions([]);
          setError(null);
        } else {
          setExecutions(data.executions || []);
          setError(null);
        }
      } catch (err) {
        console.error('Failed to fetch tool executions:', err);
        setExecutions([]);
        setError('Failed to load execution data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchExecutions();
  }, [tool.name]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <tool.icon size={20} style={{ color: tool.color }} />
            <span>{tool.name} Tool Details</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="tool-stats">
            <div className="stat-item">
              <div className="stat-value">{tool.count}</div>
              <div className="stat-label">Total Executions</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{loading ? '...' : executions.length}</div>
              <div className="stat-label">Recent Logs</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{loading ? '...' : executions.filter(e => e.status === 'success').length}</div>
              <div className="stat-label">Successful</div>
            </div>
          </div>

          <div className="execution-history">
            <h4>Recent Executions</h4>
            <div className="execution-list">
              {loading ? (
                <div className="text-center py-4 text-slate-400">Loading executions...</div>
              ) : error ? (
                <div className="text-center py-4 text-red-400">{error}</div>
              ) : executions.length === 0 ? (
                <div className="text-center py-4 text-slate-400">No executions available</div>
              ) : (
                executions.map(execution => (
                  <div key={execution.id} className={`execution-item ${execution.status}`}>
                    <div className="execution-command">{execution.command || `${tool.name} execution`}</div>
                    <div className="execution-timestamp">{execution.timestamp}</div>
                    <div className={`execution-status ${execution.status}`}>
                      {execution.status.toUpperCase()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolModal;