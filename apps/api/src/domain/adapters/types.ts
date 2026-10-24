import type { ExternalProduct, BuyResult, SourceAdapter } from '@geminihub/shared';

export type { ExternalProduct, BuyResult, SourceAdapter };

export interface AdapterConfig {
  sourceId: string;
  name: string;
  baseUrl: string;
  credentials: Record<string, any>;
  config?: Record<string, any>;
  timeoutMs?: number;
}

