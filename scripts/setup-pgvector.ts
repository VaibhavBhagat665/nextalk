/**
 * pgvector Setup Script
 * 
 * This script enables the pgvector extension in the PostgreSQL database
 * and verifies it's properly installed with the correct version.
 * 
 * Requirements: 4.1
 * 
 * Usage:
 *   tsx scripts/setup-pgvector.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PgVectorInfo {
  installed: boolean;
  version: string | null;
  hasHNSWSupport: boolean;
}

/**
 * Check if pgvector extension is installed and get version
 */
async function checkPgVector(): Promise<PgVectorInfo> {
  try {
    const result = await prisma.$queryRaw<Array<{ extversion: string }>>`
      SELECT extversion 
      FROM pg_extension 
      WHERE extname = 'vector'
    `;

    if (result.length === 0) {
      return {
        installed: false,
        version: null,
        hasHNSWSupport: false,
      };
    }

    const version = result[0].extversion;
    const hasHNSWSupport = compareVersions(version, "0.7.0") >= 0;

    return {
      installed: true,
      version,
      hasHNSWSupport,
    };
  } catch (error: any) {
    console.error("Error checking pgvector:", error.message);
    return {
      installed: false,
      version: null,
      hasHNSWSupport: false,
    };
  }
}

/**
 * Enable pgvector extension
 */
async function enablePgVector(): Promise<boolean> {
  try {
    console.log("🔧 Enabling pgvector extension...");
    
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;
    
    console.log("✅ pgvector extension enabled");
    return true;
  } catch (error: any) {
    console.error("❌ Failed to enable pgvector:", error.message);
    return false;
  }
}

/**
 * Compare semantic versions
 */
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

/**
 * Test vector operations
 */
async function testVectorOperations(): Promise<boolean> {
  try {
    console.log("\n🧪 Testing vector operations...");

    // Test 1: Create a test table with vector column
    console.log("  1. Creating test table...");
    await prisma.$executeRaw`
      DROP TABLE IF EXISTS vector_test CASCADE
    `;
    await prisma.$executeRaw`
      CREATE TABLE vector_test (
        id SERIAL PRIMARY KEY,
        embedding vector(3)
      )
    `;

    // Test 2: Insert test vectors
    console.log("  2. Inserting test vectors...");
    await prisma.$executeRaw`
      INSERT INTO vector_test (embedding) VALUES 
        ('[1,2,3]'::vector),
        ('[4,5,6]'::vector),
        ('[7,8,9]'::vector)
    `;

    // Test 3: Test cosine similarity search
    console.log("  3. Testing cosine similarity...");
    const similarityResults = await prisma.$queryRaw<
      Array<{ id: number; distance: number }>
    >`
      SELECT id, 1 - (embedding <=> '[2,3,4]'::vector) as distance
      FROM vector_test
      ORDER BY embedding <=> '[2,3,4]'::vector
      LIMIT 2
    `;

    if (similarityResults.length === 0) {
      throw new Error("Similarity search returned no results");
    }

    console.log(`    Found ${similarityResults.length} similar vectors`);

    // Test 4: Test L2 distance
    console.log("  4. Testing L2 distance...");
    const l2Results = await prisma.$queryRaw<
      Array<{ id: number; distance: number }>
    >`
      SELECT id, embedding <-> '[2,3,4]'::vector as distance
      FROM vector_test
      ORDER BY embedding <-> '[2,3,4]'::vector
      LIMIT 1
    `;

    if (l2Results.length === 0) {
      throw new Error("L2 distance search returned no results");
    }

    console.log(`    L2 distance: ${l2Results[0].distance.toFixed(4)}`);

    // Test 5: Test inner product
    console.log("  5. Testing inner product...");
    const ipResults = await prisma.$queryRaw<
      Array<{ id: number; distance: number }>
    >`
      SELECT id, embedding <#> '[2,3,4]'::vector as distance
      FROM vector_test
      ORDER BY embedding <#> '[2,3,4]'::vector
      LIMIT 1
    `;

    if (ipResults.length === 0) {
      throw new Error("Inner product search returned no results");
    }

    console.log(`    Inner product: ${ipResults[0].distance.toFixed(4)}`);

    // Cleanup
    console.log("  6. Cleaning up test table...");
    await prisma.$executeRaw`DROP TABLE vector_test`;

    console.log("✅ All vector operations working correctly");
    return true;
  } catch (error: any) {
    console.error("❌ Vector operation test failed:", error.message);
    return false;
  }
}

/**
 * Test HNSW index creation (if supported)
 */
async function testHNSWIndex(): Promise<boolean> {
  try {
    console.log("\n🧪 Testing HNSW index...");

    // Create test table
    await prisma.$executeRaw`
      DROP TABLE IF EXISTS hnsw_test CASCADE
    `;
    await prisma.$executeRaw`
      CREATE TABLE hnsw_test (
        id SERIAL PRIMARY KEY,
        embedding vector(128)
      )
    `;

    // Insert some test data
    console.log("  1. Inserting test data...");
    for (let i = 0; i < 100; i++) {
      const randomVector = Array.from({ length: 128 }, () =>
        Math.random()
      ).join(",");
      await prisma.$executeRaw`
        INSERT INTO hnsw_test (embedding) 
        VALUES (${`[${randomVector}]`}::vector)
      `;
    }

    // Create HNSW index
    console.log("  2. Creating HNSW index...");
    await prisma.$executeRaw`
      CREATE INDEX ON hnsw_test 
      USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `;

    // Test index usage
    console.log("  3. Testing index usage...");
    const randomQuery = Array.from({ length: 128 }, () => Math.random()).join(
      ","
    );
    const results = await prisma.$queryRaw<Array<{ id: number }>>`
      SELECT id 
      FROM hnsw_test 
      ORDER BY embedding <=> ${`[${randomQuery}]`}::vector
      LIMIT 5
    `;

    if (results.length === 0) {
      throw new Error("HNSW index query returned no results");
    }

    console.log(`    Index query returned ${results.length} results`);

    // Cleanup
    console.log("  4. Cleaning up...");
    await prisma.$executeRaw`DROP TABLE hnsw_test`;

    console.log("✅ HNSW index working correctly");
    return true;
  } catch (error: any) {
    console.error("❌ HNSW index test failed:", error.message);
    console.error(
      "   Note: HNSW requires pgvector 0.7.0+. Your version may not support it."
    );
    return false;
  }
}

/**
 * Main setup function
 */
async function main() {
  console.log("=" .repeat(60));
  console.log("pgvector Setup and Verification");
  console.log("=" .repeat(60));
  console.log();

  try {
    // Step 1: Check current status
    console.log("📋 Checking current pgvector status...");
    const initialStatus = await checkPgVector();

    if (initialStatus.installed) {
      console.log(`✅ pgvector is already installed (version ${initialStatus.version})`);
      console.log(
        `   HNSW support: ${initialStatus.hasHNSWSupport ? "✅ Yes" : "❌ No (requires 0.7.0+)"}`
      );
    } else {
      console.log("⚠️  pgvector is not installed");

      // Step 2: Enable pgvector
      const enabled = await enablePgVector();
      if (!enabled) {
        console.error("\n❌ Setup failed: Could not enable pgvector");
        console.error(
          "   Make sure your PostgreSQL database supports pgvector."
        );
        console.error("   For Supabase: pgvector should be available by default.");
        console.error(
          "   For other providers: You may need to install it manually."
        );
        process.exit(1);
      }

      // Verify it was enabled
      const finalStatus = await checkPgVector();
      if (!finalStatus.installed) {
        console.error("\n❌ Setup failed: pgvector not installed after enable");
        process.exit(1);
      }

      console.log(`   Installed version: ${finalStatus.version}`);
      console.log(
        `   HNSW support: ${finalStatus.hasHNSWSupport ? "✅ Yes" : "❌ No (requires 0.7.0+)"}`
      );
    }

    // Step 3: Test vector operations
    const operationsWork = await testVectorOperations();
    if (!operationsWork) {
      console.error("\n❌ Setup failed: Vector operations not working");
      process.exit(1);
    }

    // Step 4: Test HNSW index (if supported)
    const status = await checkPgVector();
    if (status.hasHNSWSupport) {
      const hnswWork = await testHNSWIndex();
      if (!hnswWork) {
        console.warn(
          "\n⚠️  Warning: HNSW index creation failed, but basic operations work"
        );
        console.warn("   You can still use pgvector with IVFFlat indexes");
      }
    } else {
      console.log("\n⚠️  Skipping HNSW test (requires pgvector 0.7.0+)");
      console.log("   Your version supports IVFFlat indexes");
    }

    // Success!
    console.log("\n" + "=".repeat(60));
    console.log("✅ pgvector setup complete!");
    console.log("=".repeat(60));
    console.log();
    console.log("Next steps:");
    console.log("  1. Run Prisma migration to add embedding column to Message model");
    console.log("  2. Create embedding ingestion worker");
    console.log("  3. Implement semantic search service");
    console.log();
  } catch (error: any) {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
main();
