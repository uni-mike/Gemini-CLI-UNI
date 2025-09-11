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
  // Mock execution data - in real app this would come from API
  const executions = [
    { id: 1, timestamp: '2025-01-10 14:30:15', command: `${tool.name} execution`, status: 'success' },
    { id: 2, timestamp: '2025-01-10 14:25:32', command: `${tool.name} operation`, status: 'success' },
    { id: 3, timestamp: '2025-01-10 14:20:48', command: `${tool.name} task`, status: 'warning' },
    { id: 4, timestamp: '2025-01-10 14:15:21', command: `${tool.name} process`, status: 'success' },
    { id: 5, timestamp: '2025-01-10 14:10:07', command: `${tool.name} action`, status: 'success' },
  ];

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
              <div className="stat-value">{executions.length}</div>
              <div className="stat-label">Recent Logs</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{executions.filter(e => e.status === 'success').length}</div>
              <div className="stat-label">Successful</div>
            </div>
          </div>

          <div className="execution-history">
            <h4>Recent Executions</h4>
            <div className="execution-list">
              {executions.map(execution => (
                <div key={execution.id} className={`execution-item ${execution.status}`}>
                  <div className="execution-command">{execution.command}</div>
                  <div className="execution-timestamp">{execution.timestamp}</div>
                  <div className={`execution-status ${execution.status}`}>
                    {execution.status.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToolModal;