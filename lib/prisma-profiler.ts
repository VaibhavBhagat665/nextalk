/**
 * Prisma Query Profiler
 * 
 * Enables query logging and performance measurement for Prisma queries
 */

import { PrismaClient } from '@prisma/client';

export interface QueryLog {
  query: string;
  params: string;
  duration: number;
  timestamp: Date;
}

class PrismaProfiler {
  private queryLogs: QueryLog[] = [];
  private readonly maxLogs = 1000;

  /**
   * Track a query execution
   */
  track(query: string, params: string, duration: number): void {
    this.queryLogs.push({
      query,
      params,
      duration,
      timestamp: new Date(),
    });

    // Trim old logs
    if (this.queryLogs.length > this.maxLogs) {
      this.queryLogs.shift();
    }

    // Log slow queries (>100ms)
    if (duration > 100) {
      console.warn(`🐌 Slow query (${duration}ms):`, query.substring(0, 100));
    }
  }

  /**
   * Get query statistics
   */
  getStats() {
    if (this.queryLogs.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: 0,
        queries: [],
      };
    }

    const durations = this.queryLogs.map(log => log.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, val) => acc + val, 0);
    const avg = sum / durations.length;

    const slowQueries = this.queryLogs.filter(log => log.duration > 100);

    return {
      totalQueries: this.queryLogs.length,
      averageDuration: Math.round(avg * 100) / 100,
      p50: durations[Math.floor(durations.length * 0.5)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)],
      slowQueries: slowQueries.length,
      slowestQueries: slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map(log => ({
          query: log.query.substring(0, 100) + '...',
          duration: log.duration,
          timestamp: log.timestamp,
        })),
    };
  }

  /**
   * Clear logs
   */
  clear(): void {
    this.queryLogs = [];
  }

  /**
   * Get all logs
   */
  getAllLogs(): QueryLog[] {
    return [...this.queryLogs];
  }
}

// Global profiler instance
export const profiler = new PrismaProfiler();

/**
 * Create a Prisma client with query logging enabled
 */
export function createProfiledPrismaClient(): PrismaClient {
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  });

  // @ts-ignore
  prisma.$on('query', (e: any) => {
    profiler.track(e.query, e.params, e.duration);
  });

  return prisma;
}

/**
 * Get profiler statistics
 */
export function getProfilerStats() {
  return profiler.getStats();
}

/**
 * Clear profiler logs
 */
export function clearProfilerLogs() {
  profiler.clear();
}
