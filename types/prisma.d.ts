/**
 * Type extensions for Prisma types with Unsupported fields
 */

import type { Prisma } from '@prisma/client';

declare module '@prisma/client' {
  interface Message {
    embedding?: unknown; // pgvector type
    blurhash?: string | null;
    imageDimensions?: unknown;
  }
  
  namespace Prisma {
    interface MessageWhereInput {
      embedding?: unknown;
      blurhash?: unknown;
    }
    
    interface MessageSelect {
      embedding?: boolean;
      blurhash?: boolean;
      imageDimensions?: boolean;
    }
    
    interface MessageCreateInput {
      embedding?: unknown;
      blurhash?: string | null;
      imageDimensions?: unknown;
    }
    
    interface MessageUncheckedCreateInput {
      embedding?: unknown;
      blurhash?: string | null;
      imageDimensions?: unknown;
    }
  }
}
