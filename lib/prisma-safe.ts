/**
 * Safe Prisma wrapper that handles missing tables gracefully
 * Used during initial deployment when database schema isn't fully migrated
 */

import { prisma } from "./prisma";

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )`,
      tableName
    );
    return result[0]?.exists || false;
  } catch (error) {
    console.warn(`Failed to check if table ${tableName} exists:`, error);
    return false;
  }
}

// Cache table existence checks
const tableExistsCache = new Map<string, boolean>();

/**
 * Safe wrapper for keyVerification queries
 */
export const safeKeyVerification = {
  async findUnique(args: any) {
    const exists = tableExistsCache.get('KeyVerification') ?? await tableExists('KeyVerification');
    tableExistsCache.set('KeyVerification', exists);
    
    if (!exists) {
      console.warn('KeyVerification table does not exist - returning null');
      return null;
    }
    
    try {
      return await prisma.keyVerification.findUnique(args);
    } catch (error) {
      console.error('KeyVerification query failed:', error);
      return null;
    }
  },

  async upsert(args: any) {
    const exists = tableExistsCache.get('KeyVerification') ?? await tableExists('KeyVerification');
    tableExistsCache.set('KeyVerification', exists);
    
    if (!exists) {
      throw new Error('KeyVerification table does not exist. Please run database migration.');
    }
    
    return await prisma.keyVerification.upsert(args);
  },

  async findMany(args?: any) {
    const exists = tableExistsCache.get('KeyVerification') ?? await tableExists('KeyVerification');
    tableExistsCache.set('KeyVerification', exists);
    
    if (!exists) {
      console.warn('KeyVerification table does not exist - returning empty array');
      return [];
    }
    
    try {
      return await prisma.keyVerification.findMany(args);
    } catch (error) {
      console.error('KeyVerification query failed:', error);
      return [];
    }
  }
};

/**
 * Clear the table existence cache
 * Call this after running migrations
 */
export function clearTableCache() {
  tableExistsCache.clear();
}
