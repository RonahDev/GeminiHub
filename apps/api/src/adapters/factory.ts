import { SourceAdapter } from './types';
import { MockAdapter } from './MockAdapter';
import { TeleApiAdapter } from './TeleApiAdapter';
import { decrypt } from '../utils/crypto';
import { AdapterType } from '@geminihub/shared';

export interface SourceRecord {
  id: string;
  name: string;
  adapterType: string;
  baseUrl: string;
  credentialsEncrypted: string;
  config: string;
  currency: string;
  liveBuyEnabled: boolean;
  timeoutMs: number;
}

export function createSourceAdapter(source: SourceRecord): SourceAdapter {
  // If adapter type is MOCK or baseUrl contains mock, always return MockAdapter
  if (source.adapterType === AdapterType.MOCK || source.baseUrl.includes('mock')) {
    let mockOpts = {};
    try {
      mockOpts = JSON.parse(source.config || '{}');
    } catch {}
    return new MockAdapter(mockOpts);
  }

  // Parse decrypted credentials
  let credentials: Record<string, any> = {};
  try {
    const decryptedStr = decrypt(source.credentialsEncrypted);
    credentials = JSON.parse(decryptedStr);
  } catch (err) {
    throw new Error(`Không thể giải mã thông tin xác thực của nguồn "${source.name}"`);
  }

  if (source.adapterType === AdapterType.TELE_API) {
    return new TeleApiAdapter({
      baseUrl: source.baseUrl,
      apiId: credentials.apiId || '',
      apiSecret: credentials.apiSecret || '',
      timeoutMs: source.timeoutMs,
      currency: (source.currency as 'VND' | 'USD') || 'VND',
    });
  }

  throw new Error(`Loại adapter "${source.adapterType}" chưa được hỗ trợ`);
}
