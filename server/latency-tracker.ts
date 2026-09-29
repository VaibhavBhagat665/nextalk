/**
 * Latency Tracking Middleware for Socket.io
 * 
 * Tracks end-to-end message delivery latency by:
 * 1. Client adds timestamp on send
 * 2. Server receives and notes receipt time
 * 3. Server calculates latency and aggregates metrics
 */

import { Socket } from "socket.io";

export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  timestamp: Date;
  min: number;
  max: number;
  mean: number;
}

interface LatencySample {
  latency: number;
  timestamp: number;
}

class LatencyTracker {
  private samples: LatencySample[] = [];
  private readonly maxSamples = 10000; // Keep last 10k samples
  private readonly windowMs = 60000; // 1 minute rolling window

  /**
   * Track a message latency sample
   */
  track(clientTimestamp: number): void {
    const serverTimestamp = Date.now();
    const latency = serverTimestamp - clientTimestamp;

    // Sanity check: ignore negative or absurdly high latencies (clock drift)
    if (latency < 0 || latency > 30000) {
      console.warn(`Suspicious latency: ${latency}ms`);
      return;
    }

    this.samples.push({ latency, timestamp: serverTimestamp });

    // Trim old samples
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  /**
   * Get samples within the specified time window
   */
  private getSamplesInWindow(windowMs: number): number[] {
    const now = Date.now();
    const cutoff = now - windowMs;

    return this.samples
      .filter(s => s.timestamp >= cutoff)
      .map(s => s.latency)
      .sort((a, b) => a - b);
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Aggregate metrics for the specified time window
   */
  aggregateMetrics(windowMs: number = this.windowMs): LatencyMetrics {
    const samples = this.getSamplesInWindow(windowMs);

    if (samples.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
        timestamp: new Date(),
        min: 0,
        max: 0,
        mean: 0,
      };
    }

    const sum = samples.reduce((acc, val) => acc + val, 0);
    const mean = sum / samples.length;

    return {
      p50: this.percentile(samples, 50),
      p95: this.percentile(samples, 95),
      p99: this.percentile(samples, 99),
      count: samples.length,
      timestamp: new Date(),
      min: samples[0],
      max: samples[samples.length - 1],
      mean: Math.round(mean * 100) / 100,
    };
  }

  /**
   * Get all metrics for different time windows
   */
  getAllMetrics() {
    return {
      oneMinute: this.aggregateMetrics(60000),
      fiveMinutes: this.aggregateMetrics(300000),
      oneHour: this.aggregateMetrics(3600000),
    };
  }
}

// Global tracker instance
export const latencyTracker = new LatencyTracker();

/**
 * Socket.io middleware to track message latency
 */
export function latencyMiddleware(socket: Socket, next: (err?: Error) => void) {
  // Intercept message:send events to track latency
  const originalEmit = socket.emit.bind(socket);
  
  socket.on("message:send", (data: any) => {
    if (data.clientTimestamp && typeof data.clientTimestamp === "number") {
      latencyTracker.track(data.clientTimestamp);
    }
  });

  next();
}

/**
 * Get current latency metrics
 */
export function getLatencyMetrics(): ReturnType<typeof latencyTracker.getAllMetrics> {
  return latencyTracker.getAllMetrics();
}
