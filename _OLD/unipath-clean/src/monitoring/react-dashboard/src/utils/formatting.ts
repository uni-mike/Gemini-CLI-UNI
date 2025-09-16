export const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const formatNumber = (num: number): number => {
  return Math.round(num);
};

export const formatPercentage = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.min((value / total) * 100, 100);
};

export const formatExecutionRate = (executions: number, timeWindow: number = 60): string => {
  return (executions / timeWindow).toFixed(1);
};