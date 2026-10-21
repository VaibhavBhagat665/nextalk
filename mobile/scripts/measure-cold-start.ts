/**
 * Cold Start Time Measurement Script
 * 
 * This script provides methodology and helpers for measuring mobile app cold start time.
 * 
 * Cold start is defined as: Time from app icon tap to first interactive frame
 * (chat list visible and interactive).
 * 
 * Target: <2 seconds on mid-range devices (iPhone SE 3rd gen, Google Pixel 6a)
 * 
 * Measurement Methodology:
 * ========================
 * 
 * iOS (Manual via Xcode Instruments):
 * 1. Force quit the app
 * 2. Clear background apps to free memory
 * 3. Open Xcode → Product → Profile → Time Profiler
 * 4. Start recording
 * 5. Tap app icon
 * 6. Stop recording when chat list is interactive
 * 7. Measure time from "Application Launch" to first frame after "componentDidMount"
 * 
 * Android (Manual via Android Studio Profiler):
 * 1. Force quit the app
 * 2. Clear background apps
 * 3. Open Android Studio → View → Tool Windows → Profiler
 * 4. Select CPU profiler
 * 5. Start recording
 * 6. Tap app icon
 * 7. Stop recording when chat list is interactive
 * 8. Measure time from process start to first interactive frame
 * 
 * Automated (React Native Performance Monitor):
 * This script uses React Native's built-in performance APIs to measure cold start
 * automatically from JavaScript perspective.
 */

import { Platform } from 'react-native';

// Type definitions for measurement results
export interface ColdStartMeasurement {
  platform: 'ios' | 'android';
  device: string;
  scenario: 'first-launch' | 'warm-start' | 'fresh-login';
  totalTime: number; // milliseconds
  breakdown: {
    appLaunch: number;
    jsLoad: number;
    rnInit: number;
    authCheck: number;
    dataFetch: number;
    firstRender: number;
  };
  timestamp: Date;
  targetMet: boolean; // < 2000ms
}

// Marker timestamps for cold start measurement
const performanceMarkers = {
  appLaunch: 0,
  jsLoadStart: 0,
  jsLoadEnd: 0,
  rnInitStart: 0,
  rnInitEnd: 0,
  authCheckStart: 0,
  authCheckEnd: 0,
  dataFetchStart: 0,
  dataFetchEnd: 0,
  firstRenderStart: 0,
  firstRenderEnd: 0,
};

/**
 * Mark the start of app launch (called at top of entry point)
 */
export function markAppLaunchStart(): void {
  performanceMarkers.appLaunch = Date.now();
  performanceMarkers.jsLoadStart = Date.now();
}

/**
 * Mark the end of JavaScript bundle load
 */
export function markJSLoadEnd(): void {
  performanceMarkers.jsLoadEnd = Date.now();
}

/**
 * Mark React Native initialization
 */
export function markRNInitStart(): void {
  performanceMarkers.rnInitStart = Date.now();
}

export function markRNInitEnd(): void {
  performanceMarkers.rnInitEnd = Date.now();
}

/**
 * Mark authentication check phase
 */
export function markAuthCheckStart(): void {
  performanceMarkers.authCheckStart = Date.now();
}

export function markAuthCheckEnd(): void {
  performanceMarkers.authCheckEnd = Date.now();
}

/**
 * Mark data fetch phase (initial API calls)
 */
export function markDataFetchStart(): void {
  performanceMarkers.dataFetchStart = Date.now();
}

export function markDataFetchEnd(): void {
  performanceMarkers.dataFetchEnd = Date.now();
}

/**
 * Mark first render phase
 */
export function markFirstRenderStart(): void {
  performanceMarkers.firstRenderStart = Date.now();
}

export function markFirstRenderEnd(): void {
  performanceMarkers.firstRenderEnd = Date.now();
}

/**
 * Calculate cold start time and breakdown
 */
export function calculateColdStartTime(): ColdStartMeasurement | null {
  if (performanceMarkers.firstRenderEnd === 0) {
    console.warn('[Cold Start] Measurement incomplete - missing markers');
    return null;
  }

  const totalTime = performanceMarkers.firstRenderEnd - performanceMarkers.appLaunch;
  
  const breakdown = {
    appLaunch: performanceMarkers.jsLoadStart - performanceMarkers.appLaunch,
    jsLoad: performanceMarkers.jsLoadEnd - performanceMarkers.jsLoadStart,
    rnInit: performanceMarkers.rnInitEnd - performanceMarkers.rnInitStart,
    authCheck: performanceMarkers.authCheckEnd - performanceMarkers.authCheckStart,
    dataFetch: performanceMarkers.dataFetchEnd - performanceMarkers.dataFetchStart,
    firstRender: performanceMarkers.firstRenderEnd - performanceMarkers.firstRenderStart,
  };

  const device = getDeviceInfo();
  
  const measurement: ColdStartMeasurement = {
    platform: Platform.OS as 'ios' | 'android',
    device,
    scenario: 'warm-start', // Default, can be overridden
    totalTime,
    breakdown,
    timestamp: new Date(),
    targetMet: totalTime < 2000,
  };

  return measurement;
}

/**
 * Log cold start measurement results
 */
export function logColdStartMeasurement(measurement: ColdStartMeasurement | null): void {
  if (!measurement) {
    return;
  }

  const statusEmoji = measurement.targetMet ? '✅' : '❌';
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`${statusEmoji} COLD START TIME MEASUREMENT`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Platform:       ${measurement.platform.toUpperCase()}`);
  console.log(`Device:         ${measurement.device}`);
  console.log(`Scenario:       ${measurement.scenario}`);
  console.log(`Total Time:     ${measurement.totalTime}ms`);
  console.log(`Target Met:     ${measurement.targetMet ? 'YES (<2000ms)' : `NO (${measurement.totalTime}ms >= 2000ms)`}`);
  console.log('───────────────────────────────────────────────────────');
  console.log('Breakdown:');
  console.log(`  App Launch:    ${measurement.breakdown.appLaunch}ms (${percentage(measurement.breakdown.appLaunch, measurement.totalTime)})`);
  console.log(`  JS Load:       ${measurement.breakdown.jsLoad}ms (${percentage(measurement.breakdown.jsLoad, measurement.totalTime)})`);
  console.log(`  RN Init:       ${measurement.breakdown.rnInit}ms (${percentage(measurement.breakdown.rnInit, measurement.totalTime)})`);
  console.log(`  Auth Check:    ${measurement.breakdown.authCheck}ms (${percentage(measurement.breakdown.authCheck, measurement.totalTime)})`);
  console.log(`  Data Fetch:    ${measurement.breakdown.dataFetch}ms (${percentage(measurement.breakdown.dataFetch, measurement.totalTime)})`);
  console.log(`  First Render:  ${measurement.breakdown.firstRender}ms (${percentage(measurement.breakdown.firstRender, measurement.totalTime)})`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Log to a format that can be parsed for benchmarking
  console.log('[BENCHMARK_RESULT]', JSON.stringify(measurement));
}

/**
 * Helper to calculate percentage
 */
function percentage(part: number, total: number): string {
  return `${((part / total) * 100).toFixed(1)}%`;
}

/**
 * Get device information
 * Note: Requires expo-device or manual configuration
 */
function getDeviceInfo(): string {
  // In a real implementation, use expo-device
  // For now, return platform default
  if (Platform.OS === 'ios') {
    return Platform.isPad ? 'iPad' : 'iPhone';
  }
  return 'Android Device';
}

/**
 * Save measurement to AsyncStorage for later analysis
 */
export async function saveMeasurement(measurement: ColdStartMeasurement): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const key = `cold_start_${measurement.timestamp.getTime()}`;
    await AsyncStorage.setItem(key, JSON.stringify(measurement));
    console.log(`[Cold Start] Measurement saved to AsyncStorage: ${key}`);
  } catch (error) {
    console.error('[Cold Start] Failed to save measurement:', error);
  }
}

/**
 * Retrieve all saved measurements
 */
export async function getAllMeasurements(): Promise<ColdStartMeasurement[]> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const keys = await AsyncStorage.getAllKeys();
    const coldStartKeys = keys.filter((key: string) => key.startsWith('cold_start_'));
    
    const measurements = await Promise.all(
      coldStartKeys.map(async (key: string) => {
        const data = await AsyncStorage.getItem(key);
        return data ? JSON.parse(data) : null;
      })
    );

    return measurements.filter((m: ColdStartMeasurement | null) => m !== null);
  } catch (error) {
    console.error('[Cold Start] Failed to retrieve measurements:', error);
    return [];
  }
}

/**
 * Calculate statistics from multiple measurements
 */
export function calculateStatistics(measurements: ColdStartMeasurement[]): {
  count: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
  targetMetRate: number;
} | null {
  if (measurements.length === 0) {
    return null;
  }

  const times = measurements.map(m => m.totalTime).sort((a, b) => a - b);
  
  const sum = times.reduce((acc, time) => acc + time, 0);
  const avgTime = sum / times.length;
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  
  const p50Index = Math.floor(times.length * 0.5);
  const p95Index = Math.floor(times.length * 0.95);
  const p99Index = Math.floor(times.length * 0.99);
  
  const p50 = times[p50Index];
  const p95 = times[p95Index];
  const p99 = times[p99Index];
  
  const targetMetCount = measurements.filter(m => m.targetMet).length;
  const targetMetRate = (targetMetCount / measurements.length) * 100;

  return {
    count: measurements.length,
    avgTime: Math.round(avgTime),
    minTime,
    maxTime,
    p50,
    p95,
    p99,
    targetMetRate,
  };
}

/**
 * Print statistics report
 */
export function printStatistics(stats: ReturnType<typeof calculateStatistics>): void {
  if (!stats) {
    console.log('No statistics available');
    return;
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('COLD START TIME STATISTICS');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Measurements:       ${stats.count}`);
  console.log(`Average Time:       ${stats.avgTime}ms`);
  console.log(`Min Time:           ${stats.minTime}ms`);
  console.log(`Max Time:           ${stats.maxTime}ms`);
  console.log(`p50 (Median):       ${stats.p50}ms`);
  console.log(`p95:                ${stats.p95}ms`);
  console.log(`p99:                ${stats.p99}ms`);
  console.log(`Target Met Rate:    ${stats.targetMetRate.toFixed(1)}%`);
  console.log('═══════════════════════════════════════════════════════\n');
}

// Export convenience function to run full measurement cycle
export async function measureAndLogColdStart(): Promise<void> {
  const measurement = calculateColdStartTime();
  
  if (measurement) {
    logColdStartMeasurement(measurement);
    await saveMeasurement(measurement);
  }
}

/**
 * Usage Instructions:
 * ==================
 * 
 * 1. In your app's entry point (app/_layout.tsx or App.tsx):
 * 
 *    import { markAppLaunchStart } from './scripts/measure-cold-start';
 *    markAppLaunchStart();
 * 
 * 2. After JavaScript bundle loads (top of root component):
 * 
 *    import { markJSLoadEnd, markRNInitStart } from './scripts/measure-cold-start';
 *    markJSLoadEnd();
 *    markRNInitStart();
 * 
 * 3. In useEffect of root layout:
 * 
 *    useEffect(() => {
 *      markRNInitEnd();
 *      // ... other initialization
 *    }, []);
 * 
 * 4. Around authentication check:
 * 
 *    markAuthCheckStart();
 *    const user = await clerk.getUser();
 *    markAuthCheckEnd();
 * 
 * 5. Around data fetching:
 * 
 *    markDataFetchStart();
 *    await fetchInitialData();
 *    markDataFetchEnd();
 * 
 * 6. When first interactive frame renders:
 * 
 *    markFirstRenderStart();
 *    // ... render chat list
 *    markFirstRenderEnd();
 *    
 *    // Log the measurement
 *    await measureAndLogColdStart();
 * 
 * 7. To view all measurements:
 * 
 *    const measurements = await getAllMeasurements();
 *    const stats = calculateStatistics(measurements);
 *    printStatistics(stats);
 */
