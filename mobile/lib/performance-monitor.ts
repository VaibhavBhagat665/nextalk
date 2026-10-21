/**
 * Performance Monitoring Utility for Mobile App
 * 
 * Measures:
 * - FPS (Frames Per Second) during scroll
 * - Frame drops and jank detection
 * - Render time for components
 * - Memory usage
 * 
 * Usage:
 * - Import and use PerformanceMonitor in screens
 * - Wrap components with React Profiler
 * - Call measureScrollPerformance() during scroll tests
 */

import { InteractionManager, PerformanceObserver } from 'react-native';

export interface PerformanceMetrics {
  fps: number;
  avgFrameTime: number;
  frameDrops: number;
  jankFrames: number;
  totalFrames: number;
  duration: number;
  timestamp: number;
}

export interface RenderMetrics {
  componentName: string;
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  phase: 'mount' | 'update';
}

class PerformanceMonitor {
  private frameTimestamps: number[] = [];
  private isMonitoring = false;
  private startTime = 0;
  private renderMetrics: RenderMetrics[] = [];
  
  // Target 60 FPS = 16.67ms per frame
  private readonly TARGET_FRAME_TIME = 16.67;
  // Frames taking > 2x target are considered "jank"
  private readonly JANK_THRESHOLD = this.TARGET_FRAME_TIME * 2;

  /**
   * Start monitoring frame performance
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.frameTimestamps = [];
    this.startTime = performance.now();
    this.scheduleFrame();

    console.log('[PerformanceMonitor] Started monitoring');
  }

  /**
   * Stop monitoring and return metrics
   */
  stopMonitoring(): PerformanceMetrics {
    if (!this.isMonitoring) {
      throw new Error('Not currently monitoring');
    }

    this.isMonitoring = false;
    const endTime = performance.now();
    const duration = endTime - this.startTime;

    const metrics = this.calculateMetrics(duration);
    
    // Reset state
    this.frameTimestamps = [];
    this.startTime = 0;

    console.log('[PerformanceMonitor] Stopped monitoring', metrics);
    
    return metrics;
  }

  /**
   * Schedule next frame measurement
   */
  private scheduleFrame(): void {
    if (!this.isMonitoring) return;

    requestAnimationFrame((timestamp) => {
      this.frameTimestamps.push(timestamp);
      this.scheduleFrame();
    });
  }

  /**
   * Calculate performance metrics from frame timestamps
   */
  private calculateMetrics(duration: number): PerformanceMetrics {
    const totalFrames = this.frameTimestamps.length;
    
    if (totalFrames < 2) {
      return {
        fps: 0,
        avgFrameTime: 0,
        frameDrops: 0,
        jankFrames: 0,
        totalFrames: 0,
        duration,
        timestamp: Date.now(),
      };
    }

    // Calculate frame times (delta between consecutive frames)
    const frameTimes: number[] = [];
    for (let i = 1; i < totalFrames; i++) {
      frameTimes.push(this.frameTimestamps[i] - this.frameTimestamps[i - 1]);
    }

    // Calculate average frame time
    const avgFrameTime = frameTimes.reduce((sum, t) => sum + t, 0) / frameTimes.length;

    // Calculate FPS
    const fps = 1000 / avgFrameTime;

    // Count frame drops (frames that took longer than target)
    const frameDrops = frameTimes.filter(t => t > this.TARGET_FRAME_TIME).length;

    // Count jank frames (frames that took > 2x target)
    const jankFrames = frameTimes.filter(t => t > this.JANK_THRESHOLD).length;

    return {
      fps: Math.round(fps * 10) / 10,
      avgFrameTime: Math.round(avgFrameTime * 100) / 100,
      frameDrops,
      jankFrames,
      totalFrames: totalFrames - 1, // Actual frame count is n-1
      duration: Math.round(duration),
      timestamp: Date.now(),
    };
  }

  /**
   * Record React Profiler metrics
   */
  recordRender(
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ): void {
    this.renderMetrics.push({
      componentName: id,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
      phase,
    });

    // Keep only last 100 renders to avoid memory issues
    if (this.renderMetrics.length > 100) {
      this.renderMetrics.shift();
    }
  }

  /**
   * Get render metrics
   */
  getRenderMetrics(): RenderMetrics[] {
    return [...this.renderMetrics];
  }

  /**
   * Clear render metrics
   */
  clearRenderMetrics(): void {
    this.renderMetrics = [];
  }

  /**
   * Get slow renders (> 16ms)
   */
  getSlowRenders(threshold: number = 16): RenderMetrics[] {
    return this.renderMetrics.filter(m => m.actualDuration > threshold);
  }

  /**
   * Helper to measure scroll performance
   * 
   * Usage:
   * const metrics = await performanceMonitor.measureScrollPerformance(async () => {
   *   // Perform scroll actions
   *   await scrollToEnd();
   *   await scrollToTop();
   * });
   */
  async measureScrollPerformance(
    scrollAction: () => Promise<void>
  ): Promise<PerformanceMetrics> {
    // Wait for any pending interactions
    await new Promise(resolve => InteractionManager.runAfterInteractions(resolve));

    // Start monitoring
    this.startMonitoring();

    // Wait a bit for monitor to stabilize
    await new Promise(resolve => setTimeout(resolve, 100));

    // Execute scroll action
    await scrollAction();

    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Stop and return metrics
    return this.stopMonitoring();
  }

  /**
   * Format metrics for logging
   */
  formatMetrics(metrics: PerformanceMetrics): string {
    const fps60Check = metrics.fps >= 60 ? '✅' : '❌';
    const jankCheck = metrics.jankFrames === 0 ? '✅' : '⚠️';

    return `
📊 Scroll Performance Metrics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fps60Check} FPS: ${metrics.fps.toFixed(1)} (target: 60)
⏱️  Avg Frame Time: ${metrics.avgFrameTime.toFixed(2)}ms (target: <16.67ms)
${jankCheck} Jank Frames: ${metrics.jankFrames}/${metrics.totalFrames} (${((metrics.jankFrames / metrics.totalFrames) * 100).toFixed(1)}%)
📉 Frame Drops: ${metrics.frameDrops}/${metrics.totalFrames} (${((metrics.frameDrops / metrics.totalFrames) * 100).toFixed(1)}%)
📦 Total Frames: ${metrics.totalFrames}
⏲️  Duration: ${metrics.duration}ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Performance Status: ${metrics.fps >= 60 && metrics.jankFrames === 0 ? '🎉 EXCELLENT' : metrics.fps >= 50 ? '✅ GOOD' : metrics.fps >= 40 ? '⚠️ FAIR' : '❌ POOR'}
`.trim();
  }

  /**
   * Check if performance meets 60 FPS target
   */
  meetsPerformanceTarget(metrics: PerformanceMetrics): boolean {
    return metrics.fps >= 60 && metrics.jankFrames === 0;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React Profiler callback helper
 * 
 * Usage:
 * <Profiler id="ChatScreen" onRender={createProfilerCallback()}>
 *   <YourComponent />
 * </Profiler>
 */
export function createProfilerCallback() {
  return (
    id: string,
    phase: 'mount' | 'update',
    actualDuration: number,
    baseDuration: number,
    startTime: number,
    commitTime: number
  ) => {
    performanceMonitor.recordRender(
      id,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime
    );

    // Log slow renders in development
    if (__DEV__ && actualDuration > 16) {
      console.warn(
        `[Profiler] Slow render: ${id} (${phase}) took ${actualDuration.toFixed(2)}ms`
      );
    }
  };
}

/**
 * Memory monitoring utilities
 */
export async function getMemoryUsage(): Promise<number | null> {
  try {
    // React Native doesn't have a direct memory API
    // This would require native modules to implement properly
    // For now, return null and rely on native profiling tools
    return null;
  } catch (error) {
    console.error('[PerformanceMonitor] Error getting memory usage:', error);
    return null;
  }
}
