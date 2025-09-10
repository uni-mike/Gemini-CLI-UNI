import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import axios from 'axios';

interface MetricsContextType {
  metrics: any;
  events: any[];
  loading: boolean;
  error: string | null;
  refreshMetrics: () => void;
}

const MetricsContext = createContext<MetricsContextType>({
  metrics: {},
  events: [],
  loading: true,
  error: null,
  refreshMetrics: () => {},
});

export const useMetrics = () => useContext(MetricsContext);

export const MetricsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const [metrics, setMetrics] = useState<any>({});
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMetrics = async () => {
    try {
      const [metricsRes, eventsRes] = await Promise.all([
        axios.get('http://localhost:4000/api/metrics'),
        axios.get('http://localhost:4000/api/events?limit=100'),
      ]);
      
      setMetrics(metricsRes.data);
      setEvents(eventsRes.data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshMetrics();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time updates
    const handlers: { [key: string]: (data: any) => void } = {
      'metrics:tokenUpdate': (data) => {
        setMetrics((prev: any) => ({ ...prev, currentTokenUsage: data }));
      },
      'metrics:memoryLayerUpdate': (data) => {
        setMetrics((prev: any) => {
          const layers = prev.memoryLayers || new Map();
          layers.set(data.name, data);
          return { ...prev, memoryLayers: layers };
        });
      },
      'metrics:sessionUpdate': (data) => {
        setMetrics((prev: any) => ({ ...prev, currentSession: data }));
      },
      'metrics:healthUpdate': (data) => {
        setMetrics((prev: any) => ({ ...prev, systemHealth: data }));
      },
      'metrics:event': (data) => {
        setEvents((prev) => [data, ...prev].slice(0, 100));
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket]);

  return (
    <MetricsContext.Provider value={{ metrics, events, loading, error, refreshMetrics }}>
      {children}
    </MetricsContext.Provider>
  );
};