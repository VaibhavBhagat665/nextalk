# Scroll Performance Measurement Guide

**Task**: 65.2 - Measure scroll performance  
**Requirements**: 7.14 - Mobile Performance Measurement  
**Goal**: Ensure 60 FPS during scroll in message list

## Overview

This document describes how to measure scroll performance in the NexTalk mobile app's message list, interpret the results, and take action based on findings.

## Tools Created

### 1. Performance Monitor (`lib/performance-monitor.ts`)

A comprehensive performance monitoring utility that tracks:
- **FPS (Frames Per Second)**: The rate at which frames are rendered
- **Frame Time**: Duration of each frame (target: <16.67ms for 60 FPS)
- **Frame Drops**: Frames that exceeded the 16.67ms budget
- **Jank Frames**: Frames that took >33ms (2x the budget) - very noticeable lag
- **Render Metrics**: React component render durations via Profiler API

### 2. Scroll Test Script (`scripts/measure-scroll-performance.ts`)

Automated test utilities that:
- Perform multiple scroll cycles (scroll to end, scroll to top, random scrolls)
- Collect FPS metrics across all test runs
- Calculate aggregate statistics
- Provide pass/fail determination (60 FPS target)
- Generate actionable recommendations

## How to Measure Scroll Performance

### Method 1: Manual Testing with Performance Monitor

1. **Add Performance Monitor to Chat Screen**

```typescript
import { performanceMonitor, createProfilerCallback } from '../lib/performance-monitor';
import { Profiler } from 'react';

// Wrap your component with Profiler
export default function ChatScreen() {
  // ... existing code ...

  return (
    <Profiler id="ChatScreen" onRender={createProfilerCallback()}>
      {/* Your existing JSX */}
    </Profiler>
  );
}
```

2. **Add Test Button (Development Only)**

```typescript
// Add this to your chat screen for testing
{__DEV__ && (
  <TouchableOpacity
    style={{ position: 'absolute', top: 100, right: 20, zIndex: 999 }}
    onPress={async () => {
      const metrics = await performanceMonitor.measureScrollPerformance(async () => {
        flashListRef.current?.scrollToEnd({ animated: true });
        await new Promise(r => setTimeout(r, 1500));
        flashListRef.current?.scrollToOffset({ offset: 0, animated: true });
        await new Promise(r => setTimeout(r, 1500));
      });
      console.log(performanceMonitor.formatMetrics(metrics));
      Alert.alert('FPS Test', `Average FPS: ${metrics.fps.toFixed(1)}\n${metrics.fps >= 60 ? '✅ PASSED' : '❌ FAILED'}`);
    }}
  >
    <Text style={{ backgroundColor: 'gold', padding: 10, borderRadius: 5 }}>Test FPS</Text>
  </TouchableOpacity>
)}
```

3. **Run the Test**
   - Open the app in development mode
   - Navigate to a channel with many messages
   - Tap the "Test FPS" button
   - Review console output and alert

### Method 2: Automated Testing

1. **Create a Test File**

```typescript
// mobile/__tests__/scroll-performance.test.ts
import { runScrollPerformanceTest } from '../scripts/measure-scroll-performance';
import { FlashList } from '@shopify/flash-list';

describe('Scroll Performance', () => {
  it('should maintain 60 FPS during scroll', async () => {
    // This would require E2E test setup (Detox, Appium, etc.)
    // For now, run manually in development
    
    const flashListRef = { current: null as any };
    // ... setup component with ref
    
    const result = await runScrollPerformanceTest(flashListRef, {
      cycles: 5,
      scrollDuration: 1000,
      delayBetweenScrolls: 500,
    });

    expect(result.passed).toBe(true);
    expect(result.averageMetrics.fps).toBeGreaterThanOrEqual(60);
  }, 30000);
});
```

2. **Run Tests**

```bash
cd mobile
npm test -- scroll-performance
```

### Method 3: Using React DevTools Profiler

1. **Install React DevTools**
   - Install the standalone React DevTools: `npm install -g react-devtools`
   - Or use browser extension (for web debugging)

2. **Connect to Running App**
   ```bash
   npx react-devtools
   ```

3. **Start Profiling**
   - Open React DevTools
   - Click "Profiler" tab
   - Click the record button (🔴)
   - Perform scroll actions in the app
   - Stop recording

4. **Analyze Results**
   - Look for components with render times >16ms
   - Check "Flamegraph" view to see render hierarchy
   - Identify components that re-render unnecessarily
   - Review "Ranked" view to find slowest components

## Understanding the Metrics

### FPS (Frames Per Second)

- **60 FPS**: ✅ Excellent - Smooth, imperceptible
- **50-59 FPS**: ✅ Good - Slight occasional stutter
- **40-49 FPS**: ⚠️ Fair - Noticeable lag during fast scrolls
- **<40 FPS**: ❌ Poor - Significant lag, janky scrolling

### Frame Time

- **<16.67ms**: ✅ On budget for 60 FPS
- **16.67-33ms**: ⚠️ Will drop below 60 FPS but still acceptable
- **>33ms**: ❌ Very noticeable jank

### Jank Frames

Frames that took >2x the budget (>33ms). These cause **very** noticeable stuttering.

- **0 jank frames**: ✅ Perfect smooth scrolling
- **1-5 jank frames**: ⚠️ Occasional stutter (acceptable if rare)
- **>5 jank frames**: ❌ Frequent stuttering (needs optimization)

## Performance Targets

Based on **Requirement 7.14**, the mobile app should meet these targets:

| Metric | Target | Threshold |
|--------|--------|-----------|
| Average FPS | ≥60 FPS | Must not drop below 50 FPS |
| Frame Time | <16.67ms average | No frames >50ms |
| Jank Frames | 0% | <1% acceptable |
| Frame Drops | <5% | <10% acceptable |

## Interpreting Results

### Example Output

```
📊 Scroll Performance Metrics:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ FPS: 58.3 (target: 60)
⏱️  Avg Frame Time: 17.15ms (target: <16.67ms)
⚠️ Jank Frames: 2/87 (2.3%)
📉 Frame Drops: 8/87 (9.2%)
📦 Total Frames: 87
⏲️  Duration: 1492ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Performance Status: ✅ GOOD
```

**Interpretation**: This result shows good performance with minor room for improvement. FPS is slightly below 60 but within acceptable range. A few jank frames occurred but overall scrolling should feel smooth.

## Common Issues and Solutions

### Issue 1: Low FPS (<50)

**Symptoms**: Scrolling feels sluggish and choppy

**Likely Causes**:
- Heavy render logic in message components
- Large images without optimization
- Expensive calculations on scroll
- Too many re-renders

**Solutions**:
1. Memoize message components with `React.memo()`
2. Use `useMemo()` for expensive calculations
3. Optimize image loading (lazy load, smaller sizes)
4. Ensure `estimatedItemSize` in FlashList is accurate
5. Remove unnecessary state updates during scroll

### Issue 2: High Jank Frames (>5%)

**Symptoms**: Occasional but noticeable stutters during scroll

**Likely Causes**:
- JavaScript thread blocking
- Network requests on UI thread
- Large data processing during scroll
- Animation frame collisions

**Solutions**:
1. Move heavy operations to `InteractionManager.runAfterInteractions()`
2. Defer non-critical updates until scroll ends
3. Use `shouldComponentUpdate` or `React.memo` to prevent unnecessary renders
4. Batch state updates with `unstable_batchedUpdates`

### Issue 3: Slow Initial Render

**Symptoms**: First scroll is slow, subsequent scrolls are smooth

**Likely Causes**:
- Initial component mounting overhead
- Image loading blocking
- Data fetching not optimized

**Solutions**:
1. Pre-load images before scroll
2. Use skeleton screens during initial load
3. Implement pagination/windowing correctly
4. Cache rendered components

### Issue 4: Frame Time Spikes

**Symptoms**: Most frames are fast, but occasional spikes >50ms

**Likely Causes**:
- Garbage collection pauses
- Network requests completing
- Large state updates
- Animations starting/stopping

**Solutions**:
1. Profile with React DevTools to identify spike causes
2. Spread out state updates over multiple frames
3. Debounce/throttle frequent updates
4. Use `requestAnimationFrame` for UI updates

## Optimization Checklist

Before measuring performance, ensure:

- [ ] FlashList `estimatedItemSize` matches actual item height
- [ ] Message components use `React.memo()` with proper equality check
- [ ] Images use appropriate sizes (not loading 4K images on mobile)
- [ ] Expensive calculations are memoized with `useMemo()`
- [ ] Event handlers are wrapped with `useCallback()`
- [ ] No inline object/array creation in render functions
- [ ] Animations use native driver (`useNativeDriver: true`)
- [ ] Heavy operations deferred to `InteractionManager`

## Documenting Results

### Create Benchmark Document

After running performance tests, document the results in `benchmarks/mobile.md`:

```markdown
## Scroll Performance

### Test Configuration
- Device: [Device Name]
- OS Version: [iOS 17.1 / Android 14]
- App Version: 1.0.0
- Message Count: 500 messages
- Test Date: 2024-01-15

### Results

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Average FPS | 58.3 | ≥60 | ✅ |
| Frame Time | 17.15ms | <16.67ms | ⚠️ |
| Jank Frames | 2.3% | 0% | ⚠️ |
| Frame Drops | 9.2% | <5% | ⚠️ |

### Analysis

Scroll performance is generally good with minor optimizations needed:
- FPS slightly below target but within acceptable range
- Frame drops occur during rapid scrolling
- Jank frames appear when images load during scroll

### Optimizations Applied

1. Implemented `React.memo()` on MessageBubble component
2. Added image lazy loading with placeholder
3. Increased FlashList cache size
4. Memoized expensive date formatting calculations

### After Optimization

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Average FPS | 58.3 | 60.1 | +3.1% |
| Frame Time | 17.15ms | 16.52ms | -3.7% |
| Jank Frames | 2.3% | 0.0% | -100% |
```

## Real Devices vs Simulators

**Important**: Always test on real devices, not just simulators!

### Why Real Devices Matter

- Simulators use desktop GPU (much faster than mobile)
- Different CPU architecture (x86 vs ARM)
- Memory constraints not accurately represented
- Touch input timing different
- Battery/thermal throttling not simulated

### Recommended Test Devices

- **iOS**: iPhone SE (low-end), iPhone 13 (mid-range)
- **Android**: Pixel 5 (mid-range), Samsung Galaxy A52 (low-end)

## Continuous Monitoring

### Setup Performance CI

Add performance testing to CI/CD:

```yaml
# .github/workflows/mobile-performance.yml
name: Mobile Performance Tests

on: [pull_request]

jobs:
  performance:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: cd mobile && npm install
      - name: Run performance tests
        run: cd mobile && npm run test:performance
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: mobile/benchmarks/
```

### Performance Budget

Set performance budgets in your app:

```typescript
// mobile/performance-budget.ts
export const PERFORMANCE_BUDGET = {
  scrollFps: 60,
  maxFrameTime: 16.67,
  maxJankPercentage: 1,
  maxFrameDropPercentage: 5,
} as const;
```

## Next Steps

After measuring scroll performance:

1. **Document Results**: Add findings to `benchmarks/mobile.md`
2. **Address Issues**: Fix any performance problems found
3. **Verify Fixes**: Re-run tests after optimizations
4. **Set Baseline**: Establish current metrics as baseline for future comparison
5. **Monitor Regression**: Add performance tests to CI to catch regressions

## Related Tasks

- Task 65.1: Measure cold start time
- Task 65.3: Document mobile performance
- Task 46: Implement FlashList virtualization (completed)

## References

- [React Native Performance](https://reactnative.dev/docs/performance)
- [FlashList Performance](https://shopify.github.io/flash-list/docs/performance)
- [React DevTools Profiler](https://react.dev/reference/react/Profiler)
- [60 FPS on mobile](https://developer.android.com/topic/performance/vitals/render)
