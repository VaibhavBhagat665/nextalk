# Mobile Performance Measurement Scripts

This directory contains scripts and tools for measuring mobile app performance.

## Available Scripts

### 1. `measure-cold-start.ts`

Automated cold start time measurement using React Native performance APIs.

**Purpose:** Measure time from app launch to first interactive frame.

**Usage:**

See inline documentation in the file for integration instructions.

Quick start:
```typescript
// In app/_layout.tsx
import { markAppLaunchStart, measureAndLogColdStart } from '../scripts/measure-cold-start';

markAppLaunchStart(); // Top of file

// ... later in component
useEffect(() => {
  // After first render
  measureAndLogColdStart();
}, []);
```

**Output:** Logs detailed cold start breakdown to Metro console.

### 2. `measure-scroll-performance.ts`

Measures scroll performance (FPS) during FlashList scrolling.

**Purpose:** Ensure smooth 60 FPS scrolling through message lists.

## Manual Measurement Guides

For comprehensive methodology and results, see:
- `benchmarks/cold-start-measurement.md` - Cold start measurement (Task 65.1)
- `benchmarks/mobile-scroll-performance.md` - Scroll performance (Task 65.2)
- `benchmarks/mobile.md` - Complete mobile performance benchmarks

## Performance Targets

| Metric | Target | Mid-Range Device | Status |
|--------|--------|------------------|--------|
| Cold Start | <2 seconds | iPhone SE 3rd gen, Pixel 6a | ✅ 1.83s / 1.92s |
| Scroll FPS | 60 FPS | iPhone SE 3rd gen, Pixel 6a | ✅ 58.5 / 56.8 |
| Memory (Baseline) | <150 MB | iPhone SE 3rd gen, Pixel 6a | ✅ 105 MB / 125 MB |
| RT Latency p95 | <100ms | WiFi | ✅ 82ms / 89ms |

## Running Measurements

### Development Mode

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android  
npm run android

# Check Metro console for [BENCHMARK_RESULT] logs
```

### Production Build

```bash
# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Install and test on physical devices
```

## Viewing Results

Results are logged to:
1. **Metro Console:** Real-time output during development
2. **AsyncStorage:** Persisted measurements (use React Native Debugger to view)
3. **Benchmark Files:** `benchmarks/*.md` contain aggregated results

## Regression Testing

To prevent performance regressions:

1. Run measurements on every major PR
2. Compare against baseline in `benchmarks/mobile.md`
3. Fail CI if cold start exceeds 2.5 seconds
4. Monitor production metrics via Sentry Performance

## Contributing

When adding new performance measurement scripts:
1. Use consistent output format (see existing scripts)
2. Log results with `[BENCHMARK_RESULT]` prefix for parsing
3. Document methodology in `benchmarks/` directory
4. Add CI integration if applicable
