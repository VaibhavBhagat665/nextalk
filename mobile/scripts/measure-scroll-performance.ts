/**
 * Scroll Performance Measurement Script
 * 
 * This script provides utilities to measure scroll performance in the mobile app.
 * It's designed to be run during development/testing to ensure 60 FPS scroll performance.
 * 
 * Requirements: 7.14 - Mobile Performance Measurement
 * Task: 65.2 - Measure scroll performance
 * 
 * Usage:
 * 1. Import this in your test file or development environment
 * 2. Call runScrollPerformanceTest() with a reference to your FlashList
 * 3. Review the output metrics
 */

import { performanceMonitor, type PerformanceMetrics } from '../lib/performance-monitor';
import type { FlashList } from '@shopify/flash-list';

export interface ScrollTestConfig {
  // Number of scroll cycles to perform
  cycles?: number;
  // Duration of each scroll in ms
  scrollDuration?: number;
  // Delay between scrolls in ms
  delayBetweenScrolls?: number;
  // Whether to scroll to specific positions or random
  randomScroll?: boolean;
}

export interface ScrollTestResult {
  metrics: PerformanceMetrics[];
  averageMetrics: PerformanceMetrics;
  passed: boolean;
  summary: string;
}

/**
 * Run comprehensive scroll performance test
 */
export async function runScrollPerformanceTest(
  flashListRef: React.RefObject<FlashList<any>>,
  config: ScrollTestConfig = {}
): Promise<ScrollTestResult> {
  const {
    cycles = 5,
    scrollDuration = 1000,
    delayBetweenScrolls = 500,
    randomScroll = false,
  } = config;

  console.log('🚀 Starting scroll performance test...');
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}`);

  const allMetrics: PerformanceMetrics[] = [];

  // Test 1: Scroll to end
  console.log('\n📍 Test 1: Scroll to end');
  const scrollToEndMetrics = await performanceMonitor.measureScrollPerformance(async () => {
    flashListRef.current?.scrollToEnd({ animated: true });
    await new Promise(resolve => setTimeout(resolve, scrollDuration));
  });
  allMetrics.push(scrollToEndMetrics);
  console.log(performanceMonitor.formatMetrics(scrollToEndMetrics));

  await new Promise(resolve => setTimeout(resolve, delayBetweenScrolls));

  // Test 2: Scroll to top
  console.log('\n📍 Test 2: Scroll to top');
  const scrollToTopMetrics = await performanceMonitor.measureScrollPerformance(async () => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
    await new Promise(resolve => setTimeout(resolve, scrollDuration));
  });
  allMetrics.push(scrollToTopMetrics);
  console.log(performanceMonitor.formatMetrics(scrollToTopMetrics));

  await new Promise(resolve => setTimeout(resolve, delayBetweenScrolls));

  // Test 3-N: Additional cycles
  for (let i = 0; i < cycles - 2; i++) {
    console.log(`\n📍 Test ${i + 3}: Random scroll cycle ${i + 1}`);
    
    const metrics = await performanceMonitor.measureScrollPerformance(async () => {
      if (randomScroll) {
        // Random scroll position
        const randomOffset = Math.random() * 10000;
        flashListRef.current?.scrollToOffset({ offset: randomOffset, animated: true });
      } else {
        // Alternate between top and bottom
        if (i % 2 === 0) {
          flashListRef.current?.scrollToEnd({ animated: true });
        } else {
          flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
      }
      await new Promise(resolve => setTimeout(resolve, scrollDuration));
    });
    
    allMetrics.push(metrics);
    console.log(performanceMonitor.formatMetrics(metrics));

    if (i < cycles - 3) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenScrolls));
    }
  }

  // Calculate average metrics
  const averageMetrics = calculateAverageMetrics(allMetrics);

  // Determine if test passed (60 FPS target)
  const passed = performanceMonitor.meetsPerformanceTarget(averageMetrics);

  // Generate summary
  const summary = generateTestSummary(allMetrics, averageMetrics, passed);

  console.log('\n' + summary);

  return {
    metrics: allMetrics,
    averageMetrics,
    passed,
    summary,
  };
}

/**
 * Calculate average metrics across multiple test runs
 */
function calculateAverageMetrics(metrics: PerformanceMetrics[]): PerformanceMetrics {
  if (metrics.length === 0) {
    throw new Error('No metrics to average');
  }

  const sum = metrics.reduce(
    (acc, m) => ({
      fps: acc.fps + m.fps,
      avgFrameTime: acc.avgFrameTime + m.avgFrameTime,
      frameDrops: acc.frameDrops + m.frameDrops,
      jankFrames: acc.jankFrames + m.jankFrames,
      totalFrames: acc.totalFrames + m.totalFrames,
      duration: acc.duration + m.duration,
      timestamp: acc.timestamp,
    }),
    {
      fps: 0,
      avgFrameTime: 0,
      frameDrops: 0,
      jankFrames: 0,
      totalFrames: 0,
      duration: 0,
      timestamp: Date.now(),
    }
  );

  const count = metrics.length;

  return {
    fps: Math.round((sum.fps / count) * 10) / 10,
    avgFrameTime: Math.round((sum.avgFrameTime / count) * 100) / 100,
    frameDrops: Math.round(sum.frameDrops / count),
    jankFrames: Math.round(sum.jankFrames / count),
    totalFrames: Math.round(sum.totalFrames / count),
    duration: Math.round(sum.duration / count),
    timestamp: Date.now(),
  };
}

/**
 * Generate test summary report
 */
function generateTestSummary(
  allMetrics: PerformanceMetrics[],
  averageMetrics: PerformanceMetrics,
  passed: boolean
): string {
  const minFps = Math.min(...allMetrics.map(m => m.fps));
  const maxFps = Math.max(...allMetrics.map(m => m.fps));
  const totalJankFrames = allMetrics.reduce((sum, m) => sum + m.jankFrames, 0);
  const totalFrames = allMetrics.reduce((sum, m) => sum + m.totalFrames, 0);
  const jankPercentage = ((totalJankFrames / totalFrames) * 100).toFixed(2);

  const statusEmoji = passed ? '✅' : '❌';
  const fpsEmoji = averageMetrics.fps >= 60 ? '🎯' : averageMetrics.fps >= 50 ? '⚠️' : '🔴';

  return `
╔═══════════════════════════════════════════════════════╗
║          SCROLL PERFORMANCE TEST SUMMARY              ║
╚═══════════════════════════════════════════════════════╝

${statusEmoji} Overall Status: ${passed ? 'PASSED' : 'FAILED'}

📊 Aggregate Metrics (${allMetrics.length} test runs):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${fpsEmoji} Average FPS: ${averageMetrics.fps.toFixed(1)}
   Min FPS: ${minFps.toFixed(1)}
   Max FPS: ${maxFps.toFixed(1)}

⏱️  Average Frame Time: ${averageMetrics.avgFrameTime.toFixed(2)}ms
   Target: <16.67ms (60 FPS)

📉 Frame Drops: ${averageMetrics.frameDrops} per test
   Total: ${allMetrics.reduce((sum, m) => sum + m.frameDrops, 0)}

🎭 Jank Frames: ${totalJankFrames}/${totalFrames} (${jankPercentage}%)
   Target: 0%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 60 FPS Target: ${averageMetrics.fps >= 60 ? '✅ MET' : `❌ NOT MET (${(60 - averageMetrics.fps).toFixed(1)} FPS below target)`}
🎭 Zero Jank Target: ${totalJankFrames === 0 ? '✅ MET' : `⚠️ NOT MET (${totalJankFrames} jank frames)`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Recommendations:
${generateRecommendations(averageMetrics, totalJankFrames > 0)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Test completed at: ${new Date().toISOString()}
`.trim();
}

/**
 * Generate performance recommendations based on metrics
 */
function generateRecommendations(metrics: PerformanceMetrics, hasJank: boolean): string {
  const recommendations: string[] = [];

  if (metrics.fps < 60) {
    recommendations.push('• Consider optimizing render logic in message components');
    recommendations.push('• Review FlashList estimatedItemSize accuracy');
    recommendations.push('• Check for expensive computations in renderItem');
  }

  if (hasJank) {
    recommendations.push('• Investigate jank frames - likely caused by JS thread blocking');
    recommendations.push('• Move heavy operations to InteractionManager callbacks');
    recommendations.push('• Consider memoizing expensive components with React.memo');
  }

  if (metrics.avgFrameTime > 16.67) {
    recommendations.push('• Frame time exceeds 16.67ms budget');
    recommendations.push('• Profile with React DevTools to find slow renders');
    recommendations.push('• Consider reducing complexity of message bubbles');
  }

  if (recommendations.length === 0) {
    recommendations.push('• ✅ Performance is excellent! No optimizations needed.');
  }

  return recommendations.join('\n');
}

/**
 * Quick FPS check (shorter version for rapid testing)
 */
export async function quickFpsCheck(
  flashListRef: React.RefObject<FlashList<any>>
): Promise<number> {
  console.log('⚡ Running quick FPS check...');

  const metrics = await performanceMonitor.measureScrollPerformance(async () => {
    flashListRef.current?.scrollToEnd({ animated: true });
    await new Promise(resolve => setTimeout(resolve, 1000));
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  console.log(`FPS: ${metrics.fps.toFixed(1)} ${metrics.fps >= 60 ? '✅' : '❌'}`);

  return metrics.fps;
}

/**
 * Export test results to JSON for documentation
 */
export function exportTestResults(result: ScrollTestResult): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      device: 'Mobile Device', // Update with actual device info
      platform: 'iOS/Android', // Update with actual platform
      passed: result.passed,
      averageMetrics: result.averageMetrics,
      allMetrics: result.metrics,
      summary: result.summary,
    },
    null,
    2
  );
}
