# FlexiCLI Monitoring System Documentation

## Overview

The FlexiCLI Monitoring System provides comprehensive real-time visibility into all aspects of the pipeline, memory management, and agent processes. Built with React MUI (dark theme) and Express/Socket.io backend, it offers a professional-grade monitoring solution with extensive metrics, flow visualization, and testing capabilities.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Monitoring Dashboard                      │
│                    (React MUI Dark Theme)                    │
├─────────────────────────────────────────────────────────────┤
│                         Socket.io                            │
├─────────────────────────────────────────────────────────────┤
│                    Monitoring Server                         │
│                     (Express + API)                          │
├─────────────────────────────────────────────────────────────┤
│                    Metrics Collector                         │
├─────────────────────────────────────────────────────────────┤
│  Memory Manager │ Orchestrator │ Planner │ Executor │ Tools  │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

1. **Real-Time Metrics**
   - Token usage tracking with visual breakdowns
   - Memory layer status and utilization
   - Tool execution statistics
   - Retrieval performance metrics

2. **Pipeline Flow Visualization**
   - Interactive flow diagram using ReactFlow
   - Real-time status updates (idle/processing/completed/error)
   - Visual representation of data flow between components

3. **Session Management**
   - Complete session history with DataGrid
   - Crash recovery tracking
   - Token usage per session
   - Snapshot management

4. **Event Logging**
   - Comprehensive event stream
   - Categorized by type (pipeline/memory/tool/session/error)
   - Real-time updates via WebSocket

5. **System Health Monitoring**
   - Memory usage tracking
   - Disk usage (DB/cache/logs)
   - API health status (DeepSeek/Embeddings)
   - Error tracking with severity levels

## Installation & Setup

### Prerequisites

```bash
# Install dependencies
npm install

# Build TypeScript
npx tsc

# Build React UI
cd monitoring-ui
npm run build
cd ..
```

### Environment Configuration

Ensure your `.env` file includes:

```env
# Existing DeepSeek config
API_KEY=your_api_key
ENDPOINT=https://your-endpoint.ai.azure.com/models
MODEL=DeepSeek-R1-0528

# Embeddings config
EMBEDDING_API_KEY=your_key
EMBEDDING_API_ENDPOINT=https://your-endpoint.openai.azure.com/
EMBEDDING_API_DEPLOYMENT=text-embedding-3-large
```

## Usage

### Starting the Monitoring Server

```typescript
import { MonitoringServer } from './monitoring/server';

// Start monitoring server
const monitor = new MonitoringServer(4000);
monitor.start();

// Access at http://localhost:4000
```

### Integrating with Your Pipeline

```typescript
import { MetricsCollector } from './monitoring/metrics-collector';
import { MemoryManager } from './memory/memory-manager';

// In your orchestrator
class EnhancedOrchestrator extends Orchestrator {
  private collector: MetricsCollector;
  
  constructor(config: Config) {
    super(config);
    this.collector = new MetricsCollector(this.prisma);
    
    // Hook into events
    this.on('planning-start', (data) => {
      this.collector.startPipelineStage({
        id: `plan-${Date.now()}`,
        name: 'Planning',
        type: 'planner',
        input: data
      });
    });
    
    // Track token usage
    this.on('prompt-built', (prompt) => {
      this.collector.recordTokenUsage(prompt.tokenMetrics);
    });
  }
}
```

### Accessing the Dashboard

1. Start the monitoring server
2. Navigate to `http://localhost:4000`
3. Dashboard tabs:
   - **Overview**: Token usage, system health, tool stats
   - **Memory**: Layer status and utilization
   - **Pipeline**: Interactive flow visualization
   - **Sessions**: Historical session data
   - **Events**: Real-time event log

## API Reference

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/metrics` | GET | All current metrics |
| `/api/events` | GET | Recent events (limit param) |
| `/api/sessions` | GET | Session history |
| `/api/sessions/:id` | GET | Session details |
| `/api/chunks` | GET | Memory chunks |
| `/api/knowledge` | GET | Knowledge entries |
| `/api/commits` | GET | Git commits |
| `/api/logs` | GET | Execution logs |
| `/api/pipeline` | GET | Pipeline structure |
| `/api/metrics/clear` | POST | Clear metrics |

### WebSocket Events

**Client → Server:**
- `metrics:request` - Request specific metrics

**Server → Client:**
- `metrics:initial` - Initial metrics dump
- `metrics:tokenUpdate` - Token usage update
- `metrics:memoryLayerUpdate` - Memory layer change
- `metrics:sessionUpdate` - Session status change
- `metrics:pipelineStageStart` - Pipeline stage started
- `metrics:pipelineStageComplete` - Pipeline stage completed
- `metrics:toolStart` - Tool execution started
- `metrics:toolComplete` - Tool execution completed
- `metrics:retrievalComplete` - Retrieval finished
- `metrics:healthUpdate` - System health update
- `metrics:event` - New event

## Dashboard Components

### Token Usage Chart
- Pie charts for input/output distribution
- Progress bars with color-coded thresholds
- Real-time updates
- Mode indicator

### Pipeline Flow
- Interactive node-based visualization
- Color-coded status (gray=idle, orange=processing, green=completed, red=error)
- Mini-map for navigation
- Zoom/pan controls

### Memory Layers
- Card-based layout for each layer
- Token usage progress bars
- Status indicators
- Item counts and last access time

### System Health
- Overall status indicator
- Memory usage with progress bar
- Disk usage breakdown
- API health chips
- Recent error count

### Tool Statistics
- Stacked bar chart (success/failed)
- Average duration tracking
- Execution counts

### Retrieval Metrics
- Line charts for chunks and similarity
- Statistical chips (queries, avg chunks, similarity, duration)
- Historical trend visualization

### Session History
- DataGrid with sorting/filtering
- Status icons
- Duration calculation
- Token usage display
- Snapshot counts

### Event Log
- Chronological event list
- Type-based icons and color coding
- Expandable details
- Timestamp precision

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run monitoring tests specifically
npm test monitoring.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Coverage

The test suite covers:

1. **Token Budget Management**
   - Limit enforcement
   - Token counting
   - Content trimming
   - Usage tracking
   - Mode-specific limits

2. **Metrics Collection**
   - Token usage recording
   - Pipeline stage tracking
   - Tool execution monitoring
   - Event history
   - System health

3. **API Endpoints**
   - Health checks
   - Metrics retrieval
   - Event queries
   - Session data

4. **WebSocket Communication**
   - Connection establishment
   - Real-time updates
   - Event broadcasting

5. **Memory Management Integration**
   - Prompt building
   - Knowledge storage
   - Token reporting

6. **Error Handling**
   - Database errors
   - API failures
   - Fallback mechanisms

7. **Performance**
   - High-frequency updates
   - Query efficiency
   - Response times

## Performance Considerations

### Optimization Strategies

1. **Data Throttling**
   - Events limited to 1000 most recent
   - Token history limited to 100 points
   - Retrieval history limited to 50 entries

2. **Efficient Updates**
   - WebSocket for real-time data
   - Batch updates where possible
   - React memo for component optimization

3. **Database Performance**
   - Indexed queries
   - Limited result sets
   - Pagination for large datasets

### Monitoring Overhead

- CPU: < 2% during normal operation
- Memory: ~50MB for server, ~100MB for UI
- Network: < 10KB/s average bandwidth

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check server is running on correct port
   - Verify no firewall blocking
   - Check CORS configuration

2. **No Metrics Showing**
   - Ensure MetricsCollector is initialized
   - Verify events are being emitted
   - Check WebSocket connection

3. **High Memory Usage**
   - Clear old events: `/api/metrics/clear`
   - Reduce event retention limits
   - Clean old sessions

4. **Slow Performance**
   - Reduce chart update frequency
   - Limit displayed data points
   - Use production React build

## Advanced Configuration

### Custom Metrics

```typescript
// Add custom metric type
collector.on('customMetric', (data) => {
  this.metrics.set('custom', data);
  this.emit('metrics:custom', data);
});

// Record custom metric
collector.emit('customMetric', {
  type: 'performance',
  value: 123,
  timestamp: new Date()
});
```

### Custom Visualizations

```tsx
// Add custom chart component
const CustomChart: React.FC = () => {
  const { metrics } = useMetrics();
  const customData = metrics.custom;
  
  return (
    <ResponsiveContainer>
      {/* Your custom visualization */}
    </ResponsiveContainer>
  );
};
```

### Export Capabilities

```typescript
// Export metrics to JSON
app.get('/api/export', (req, res) => {
  const data = collector.getAllMetrics();
  res.setHeader('Content-Disposition', 'attachment; filename=metrics.json');
  res.json(data);
});
```

## Security Considerations

1. **Authentication**: Add auth middleware for production
2. **Rate Limiting**: Implement request throttling
3. **Data Sanitization**: Sanitize all user inputs
4. **HTTPS**: Use SSL/TLS in production
5. **CORS**: Configure appropriate origins

## Future Enhancements

- [ ] Metric persistence to time-series DB
- [ ] Alert system with thresholds
- [ ] Performance profiling tools
- [ ] Distributed tracing support
- [ ] Custom dashboard layouts
- [ ] Export to Grafana/Prometheus
- [ ] Mobile-responsive design
- [ ] Dark/light theme toggle
- [ ] Multi-project support
- [ ] User authentication/authorization

## Support

For issues or questions:
1. Check the Event Log for errors
2. Review System Health status
3. Enable DEBUG mode for verbose logging
4. File issues with monitoring snapshots

## License

Part of the FlexiCLI project. See main LICENSE file.