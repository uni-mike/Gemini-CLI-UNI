/**
 * Auto-refresh hook for dashboard data
 * Provides configurable polling with pause/resume capabilities
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export interface AutoRefreshConfig {
  interval?: number; // milliseconds
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

export function useAutoRefresh<T>(
  fetchFunction: () => Promise<T>,
  config: AutoRefreshConfig = {}
) {
  const {
    interval = 5000, // Default 5 seconds
    enabled = true,
    onError,
    onSuccess
  } = config;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(enabled);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  
  // Fetch data function
  const fetchData = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchFunction();
      
      if (mountedRef.current) {
        setData(result);
        setLastUpdate(new Date());
        setLoading(false);
        onSuccess?.();
      }
    } catch (err) {
      if (mountedRef.current) {
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        setLoading(false);
        onError?.(error);
      }
    }
  }, [fetchFunction, onError, onSuccess]);
  
  // Manual refresh function
  const refresh = useCallback(() => {
    return fetchData();
  }, [fetchData]);
  
  // Toggle auto-refresh
  const toggleAutoRefresh = useCallback(() => {
    setIsRefreshing(prev => !prev);
  }, []);
  
  // Pause auto-refresh
  const pause = useCallback(() => {
    setIsRefreshing(false);
  }, []);
  
  // Resume auto-refresh
  const resume = useCallback(() => {
    setIsRefreshing(true);
  }, []);
  
  // Set up auto-refresh interval
  useEffect(() => {
    if (isRefreshing && enabled) {
      // Initial fetch
      fetchData();
      
      // Set up interval
      intervalRef.current = setInterval(() => {
        fetchData();
      }, interval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    } else {
      // Clear interval if disabled
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [isRefreshing, enabled, interval, fetchData]);
  
  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  return {
    data,
    loading,
    error,
    lastUpdate,
    isRefreshing,
    refresh,
    toggleAutoRefresh,
    pause,
    resume
  };
}

/**
 * Hook for auto-refreshing multiple endpoints
 */
export function useMultiAutoRefresh<T extends Record<string, any>>(
  endpoints: Record<keyof T, () => Promise<T[keyof T]>>,
  config: AutoRefreshConfig = {}
) {
  const [data, setData] = useState<Partial<T>>({});
  const [loading, setLoading] = useState<Record<keyof T, boolean>>({} as any);
  const [errors, setErrors] = useState<Record<keyof T, Error | null>>({} as any);
  
  const fetchAll = useCallback(async () => {
    const results: Partial<T> = {};
    const loadingState: Record<keyof T, boolean> = {} as any;
    const errorState: Record<keyof T, Error | null> = {} as any;
    
    // Set all to loading
    Object.keys(endpoints).forEach(key => {
      loadingState[key as keyof T] = true;
    });
    setLoading(loadingState);
    
    // Fetch all endpoints in parallel
    const promises = Object.entries(endpoints).map(async ([key, fetchFn]) => {
      try {
        const result = await (fetchFn as Function)();
        results[key as keyof T] = result;
        errorState[key as keyof T] = null;
      } catch (err) {
        errorState[key as keyof T] = err instanceof Error ? err : new Error('Unknown error');
      } finally {
        loadingState[key as keyof T] = false;
      }
    });
    
    await Promise.all(promises);
    
    setData(results);
    setLoading(loadingState);
    setErrors(errorState);
    
    return results;
  }, [endpoints]);
  
  const refresh = useAutoRefresh(fetchAll, config);
  
  return {
    ...refresh,
    data: { ...data, ...refresh.data } as T,
    loading,
    errors
  };
}

/**
 * Hook for dashboard-specific auto-refresh
 */
export function useDashboardAutoRefresh(apiBaseUrl: string = 'http://localhost:4000') {
  const endpoints = {
    overview: () => fetch(`${apiBaseUrl}/api/overview`).then(r => r.json()),
    sessions: () => fetch(`${apiBaseUrl}/api/sessions`).then(r => r.json()),
    tools: () => fetch(`${apiBaseUrl}/api/tools`).then(r => r.json()),
    memory: () => fetch(`${apiBaseUrl}/api/memory`).then(r => r.json()),
    pipeline: () => fetch(`${apiBaseUrl}/api/pipeline`).then(r => r.json()),
    metrics: () => fetch(`${apiBaseUrl}/api/metrics`).then(r => r.json()),
    events: () => fetch(`${apiBaseUrl}/api/events?limit=20`).then(r => r.json())
  };
  
  return useMultiAutoRefresh(endpoints, {
    interval: 3000, // 3 seconds for dashboard
    enabled: true
  });
}