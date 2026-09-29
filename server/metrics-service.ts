/**
 * Metrics Aggregation Service
 * 
 * Provides metrics in both JSON and Prometheus formats
 */

import { getLatencyMetrics } from "./latency-tracker";

export interface SystemMetrics {
  timestamp: string;
  connections: number;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

/**
 * Get system metrics
 */
export function getSystemMetrics(connections: number): SystemMetrics {
  const mem = process.memoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    connections,
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024), // MB
      rss: Math.round(mem.rss / 1024 / 1024), // MB
    },
  };
}

/**
 * Format metrics in Prometheus exposition format
 */
export function formatPrometheusMetrics(connections: number): string {
  const latency = getLatencyMetrics();
  const system = getSystemMetrics(connections);
  const timestamp = Date.now();

  return `
# HELP socketio_connections Current number of Socket.io connections
# TYPE socketio_connections gauge
socketio_connections ${connections} ${timestamp}

# HELP socketio_message_latency_seconds Message delivery latency
# TYPE socketio_message_latency_seconds summary
socketio_message_latency_seconds{quantile="0.5",window="1m"} ${latency.oneMinute.p50 / 1000} ${timestamp}
socketio_message_latency_seconds{quantile="0.95",window="1m"} ${latency.oneMinute.p95 / 1000} ${timestamp}
socketio_message_latency_seconds{quantile="0.99",window="1m"} ${latency.oneMinute.p99 / 1000} ${timestamp}
socketio_message_latency_seconds{quantile="0.5",window="5m"} ${latency.fiveMinutes.p50 / 1000} ${timestamp}
socketio_message_latency_seconds{quantile="0.95",window="5m"} ${latency.fiveMinutes.p95 / 1000} ${timestamp}
socketio_message_latency_seconds{quantile="0.99",window="5m"} ${latency.fiveMinutes.p99 / 1000} ${timestamp}

# HELP socketio_message_count Total messages tracked
# TYPE socketio_message_count counter
socketio_message_count{window="1m"} ${latency.oneMinute.count} ${timestamp}
socketio_message_count{window="5m"} ${latency.fiveMinutes.count} ${timestamp}
socketio_message_count{window="1h"} ${latency.oneHour.count} ${timestamp}

# HELP nodejs_memory_heap_used_bytes Node.js heap memory used
# TYPE nodejs_memory_heap_used_bytes gauge
nodejs_memory_heap_used_bytes ${system.memory.heapUsed * 1024 * 1024} ${timestamp}

# HELP nodejs_memory_heap_total_bytes Node.js total heap memory
# TYPE nodejs_memory_heap_total_bytes gauge
nodejs_memory_heap_total_bytes ${system.memory.heapTotal * 1024 * 1024} ${timestamp}

# HELP process_uptime_seconds Process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds ${system.uptime} ${timestamp}
`.trim();
}

/**
 * Get all metrics in JSON format
 */
export function getAllMetrics(connections: number) {
  return {
    system: getSystemMetrics(connections),
    latency: getLatencyMetrics(),
  };
}
