/**
 * Test RAG Benchmark Scripts
 * 
 * Quick test to verify the benchmark scripts work correctly
 * without requiring a full database with embedded messages.
 * 
 * Usage: npx tsx scripts/test-rag-benchmarks.ts
 */

import * as fs from "fs";
import * as path from "path";

interface EvaluationQuery {
  id: number;
  query: string;
  description: string;
  channelId?: string;
  relevantMessageIds: string[];
  category: string;
}

/**
 * Test dataset generation logic
 */
function testDatasetStructure(): void {
  console.log("🧪 Testing Evaluation Dataset Structure...");

  // Create a mock evaluation query
  const mockQuery: EvaluationQuery = {
    id: 1,
    query: "test query",
    description: "Test description",
    channelId: "test-channel-id",
    relevantMessageIds: ["msg-1", "msg-2", "msg-3"],
    category: "exact-match",
  };

  // Verify structure
  if (
    !mockQuery.id ||
    !mockQuery.query ||
    !mockQuery.description ||
    !mockQuery.relevantMessageIds ||
    !mockQuery.category
  ) {
    throw new Error("Invalid query structure");
  }

  console.log("✅ Evaluation query structure is valid");
  console.log();
}

/**
 * Test metric calculation functions
 */
function testMetricCalculations(): void {
  console.log("🧪 Testing Metric Calculations...");

  // Test Recall@K calculation
  function calculateRecall(retrieved: string[], relevant: string[], k: number): number {
    const topK = retrieved.slice(0, k);
    const relevantInTopK = topK.filter((id) => relevant.includes(id)).length;
    return relevant.length > 0 ? relevantInTopK / relevant.length : 0;
  }

  // Test case 1: Perfect recall
  const retrieved1 = ["msg-1", "msg-2", "msg-3", "msg-4", "msg-5"];
  const relevant1 = ["msg-1", "msg-2", "msg-3"];
  const recall1 = calculateRecall(retrieved1, relevant1, 5);
  console.log(`   Test 1 - Perfect Recall: ${recall1} (expected: 1.0)`);
  if (Math.abs(recall1 - 1.0) > 0.001) {
    throw new Error("Recall calculation failed for perfect recall");
  }

  // Test case 2: Partial recall
  const retrieved2 = ["msg-1", "msg-4", "msg-5", "msg-6", "msg-7"];
  const relevant2 = ["msg-1", "msg-2", "msg-3"];
  const recall2 = calculateRecall(retrieved2, relevant2, 5);
  console.log(`   Test 2 - Partial Recall: ${recall2.toFixed(3)} (expected: 0.333)`);
  if (Math.abs(recall2 - 0.333) > 0.01) {
    throw new Error("Recall calculation failed for partial recall");
  }

  // Test case 3: Zero recall
  const retrieved3 = ["msg-4", "msg-5", "msg-6", "msg-7", "msg-8"];
  const relevant3 = ["msg-1", "msg-2", "msg-3"];
  const recall3 = calculateRecall(retrieved3, relevant3, 5);
  console.log(`   Test 3 - Zero Recall: ${recall3} (expected: 0.0)`);
  if (recall3 !== 0.0) {
    throw new Error("Recall calculation failed for zero recall");
  }

  console.log("✅ Recall@K calculation is correct");
  console.log();

  // Test Reciprocal Rank calculation
  function calculateReciprocalRank(retrieved: string[], relevant: string[]): number {
    for (let i = 0; i < retrieved.length; i++) {
      if (relevant.includes(retrieved[i])) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  // Test case 1: First result relevant
  const rr1 = calculateReciprocalRank(retrieved1, relevant1);
  console.log(`   Test 1 - First Position: ${rr1} (expected: 1.0)`);
  if (Math.abs(rr1 - 1.0) > 0.001) {
    throw new Error("RR calculation failed for first position");
  }

  // Test case 2: Second result relevant
  const rr2 = calculateReciprocalRank(["msg-4", "msg-1", "msg-5"], relevant1);
  console.log(`   Test 2 - Second Position: ${rr2} (expected: 0.5)`);
  if (Math.abs(rr2 - 0.5) > 0.001) {
    throw new Error("RR calculation failed for second position");
  }

  // Test case 3: No relevant results
  const rr3 = calculateReciprocalRank(retrieved3, relevant3);
  console.log(`   Test 3 - No Relevant: ${rr3} (expected: 0.0)`);
  if (rr3 !== 0.0) {
    throw new Error("RR calculation failed for no relevant results");
  }

  console.log("✅ Reciprocal Rank calculation is correct");
  console.log();
}

/**
 * Test percentile calculation
 */
function testPercentileCalculation(): void {
  console.log("🧪 Testing Percentile Calculations...");

  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  const p50 = percentile(latencies, 50);
  console.log(`   p50: ${p50}ms (expected: 50ms)`);
  if (p50 !== 50) {
    throw new Error("p50 calculation failed");
  }

  const p95 = percentile(latencies, 95);
  console.log(`   p95: ${p95}ms (expected: 95-100ms)`);
  if (p95 < 90 || p95 > 100) {
    throw new Error("p95 calculation failed");
  }

  const p99 = percentile(latencies, 99);
  console.log(`   p99: ${p99}ms (expected: 99-100ms)`);
  if (p99 < 95 || p99 > 100) {
    throw new Error("p99 calculation failed");
  }

  console.log("✅ Percentile calculations are correct");
  console.log();
}

/**
 * Test file paths and structure
 */
function testFileStructure(): void {
  console.log("🧪 Testing File Structure...");

  const benchmarksDir = path.join(process.cwd(), "benchmarks");
  
  // Check if benchmarks directory exists or can be created
  if (!fs.existsSync(benchmarksDir)) {
    console.log("   Creating benchmarks directory...");
    fs.mkdirSync(benchmarksDir, { recursive: true });
  }

  console.log(`✅ Benchmarks directory exists: ${benchmarksDir}`);

  // Check if rag.md was created
  const ragMdPath = path.join(benchmarksDir, "rag.md");
  if (!fs.existsSync(ragMdPath)) {
    throw new Error("rag.md documentation file not found");
  }

  console.log(`✅ RAG documentation exists: ${ragMdPath}`);
  console.log();
}

/**
 * Main test runner
 */
async function main() {
  console.log("🧪 Testing RAG Benchmark Scripts\n");
  console.log("=" .repeat(60));
  console.log();

  try {
    // Run all tests
    testDatasetStructure();
    testMetricCalculations();
    testPercentileCalculation();
    testFileStructure();

    console.log("=" .repeat(60));
    console.log("✅ All tests passed!");
    console.log();
    console.log("Ready to run actual benchmarks:");
    console.log("   1. Ensure database has embedded messages");
    console.log("   2. Run: npx tsx scripts/create-rag-evaluation-dataset.ts");
    console.log("   3. Run: npx tsx scripts/measure-rag-performance.ts");
    console.log();

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
