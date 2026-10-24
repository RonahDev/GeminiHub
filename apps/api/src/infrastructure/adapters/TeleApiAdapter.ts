import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { ExternalProduct, BuyResult, SourceAdapter } from '../../domain/adapters/types';
import { computeHmacSha256 } from '../security/crypto';

export interface TeleApiConfig {
  baseUrl: string;
  apiId: string;
  apiSecret: string;
  timeoutMs?: number;
  currency?: 'VND' | 'USD';
}

export class TeleApiAdapter implements SourceAdapter {
  private client: AxiosInstance;
  private apiId: string;
  private apiSecret: string;
  private currency: 'VND' | 'USD';

  constructor(config: TeleApiConfig) {
    this.apiId = config.apiId;
    this.apiSecret = config.apiSecret;
    this.currency = config.currency ?? 'VND';

    this.client = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ''),
      timeout: config.timeoutMs ?? 20000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private generateAuthHeaders(bodyStr: string = '') {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const signPayload = `${timestamp}|${nonce}|${bodyStr}`;
    const signature = computeHmacSha256(this.apiSecret, signPayload);

    return {
      'X-Tele-API-ID': this.apiId,
      'X-Tele-Timestamp': timestamp,
      'X-Tele-Nonce': nonce,
      'X-Tele-Signature': signature,
    };
  }

  async testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      const headers = this.generateAuthHeaders('');
      const res = await this.client.get('/tele-balance', { headers });
      const duration = Date.now() - start;

      if (res.status >= 200 && res.status < 300) {
        return { ok: true, latencyMs: duration };
      }
      return {
        ok: false,
        latencyMs: duration,
        error: `HTTP ${res.status}: ${JSON.stringify(res.data)}`,
      };
    } catch (err: any) {
      const duration = Date.now() - start;
      return {
        ok: false,
        latencyMs: duration,
        error: err.response?.data?.message || err.message || 'Lỗi kết nối tới bot nguồn',
      };
    }
  }

  async getBalance(): Promise<{ amount: number; currency: 'VND' | 'USD' }> {
    const headers = this.generateAuthHeaders('');
    const res = await this.client.get('/tele-balance', { headers });
    const data = res.data;

    let balance = 0;
    if (typeof data === 'number') {
      balance = data;
    } else if (data && typeof data.balance === 'number') {
      balance = data.balance;
    } else if (data?.data && typeof data.data.balance === 'number') {
      balance = data.data.balance;
    }

    return {
      amount: Math.floor(balance),
      currency: data?.currency || this.currency,
    };
  }

  async listProducts(): Promise<ExternalProduct[]> {
    const headers = this.generateAuthHeaders('');
    const res = await this.client.get('/tele-products', { headers });
    const rawList = Array.isArray(res.data) ? res.data : (res.data?.data || []);

    return rawList.map((item: any) => ({
      externalId: String(item.id || item.externalId || item.code),
      name: String(item.name || item.title || 'Sản phẩm Telegram'),
      rawPrice: Number(item.price || item.rawPrice || 0),
      costVnd: Number(item.costVnd || item.price || 0),
      stock: Number(item.stock || item.quantity || 0),
      description: item.description || '',
    }));
  }

  async getProduct(externalId: string): Promise<ExternalProduct> {
    const headers = this.generateAuthHeaders('');
    const res = await this.client.get(`/tele-products/${encodeURIComponent(externalId)}`, { headers });
    const item = res.data?.data || res.data;

    return {
      externalId: String(item.id || item.externalId || externalId),
      name: String(item.name || item.title || ''),
      rawPrice: Number(item.price || item.rawPrice || 0),
      costVnd: Number(item.costVnd || item.price || 0),
      stock: Number(item.stock || item.quantity || 0),
      description: item.description || '',
    };
  }

  async buy(externalId: string, quantity: number): Promise<BuyResult> {
    const bodyObj = { id: externalId, quantity };
    const bodyStr = JSON.stringify(bodyObj);
    const headers = this.generateAuthHeaders(bodyStr);

    try {
      const res = await this.client.post('/tele-product/buy', bodyObj, { headers });
      const rawText = JSON.stringify(res.data);
      const links = this.extractLinks(res.data);

      if (links.length >= quantity) {
        return {
          kind: 'SUCCESS',
          links: links.slice(0, quantity),
          raw: rawText,
        };
      }

      return {
        kind: 'UNKNOWN',
        error: `Số lượng link nhận được (${links.length}) không khớp với yêu cầu (${quantity})`,
        raw: rawText,
      };
    } catch (err: any) {
      const status = err.response?.status;
      const responseData = err.response?.data;
      const raw = responseData ? JSON.stringify(responseData) : (err.message || 'Network error');

      if (status === 400 || status === 422) {
        const textToCheck = `${JSON.stringify(responseData)}`.toLowerCase();
        if (/hết hàng|out of stock|kho|tồn kho|sold out/i.test(textToCheck)) {
          return { kind: 'DEFINITE_FAIL', reason: 'OUT_OF_STOCK', raw };
        }
        if (/số dư|balance|không đủ tiền|insufficient/i.test(textToCheck)) {
          return { kind: 'DEFINITE_FAIL', reason: 'SOURCE_BALANCE', raw };
        }
        if (/không tồn tại|not found|invalid id/i.test(textToCheck)) {
          return { kind: 'DEFINITE_FAIL', reason: 'NOT_FOUND', raw };
        }
      }

      if (status === 401 || status === 403) {
        return { kind: 'DEFINITE_FAIL', reason: 'AUTH', raw };
      }

      if (status === 404) {
        return { kind: 'DEFINITE_FAIL', reason: 'NOT_FOUND', raw };
      }

      return {
        kind: 'UNKNOWN',
        error: err.response?.data?.message || err.message || 'Lỗi không xác định khi gọi bot nguồn',
        raw,
      };
    }
  }

  private extractLinks(data: any): string[] {
    const links: string[] = [];
    if (!data) return links;

    if (Array.isArray(data.links)) {
      return data.links.map(String);
    }
    if (data.data && Array.isArray(data.data.links)) {
      return data.data.links.map(String);
    }
    if (typeof data.link === 'string') {
      return [data.link];
    }
    if (data.data && typeof data.data.link === 'string') {
      return [data.data.link];
    }

    const str = JSON.stringify(data);
    const urlRegex = /(https?:\/\/[^\s"',]+)/g;
    const matches = str.match(urlRegex);
    if (matches) {
      for (const m of matches) {
        if (!links.includes(m)) {
          links.push(m);
        }
      }
    }

    return links;
  }
}

