export enum Role {
  USER = 'USER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  BANNED = 'BANNED',
}

export enum WalletTxType {
  TOPUP = 'TOPUP',
  PURCHASE = 'PURCHASE',
  REFUND = 'REFUND',
  ADJUST = 'ADJUST',
}

export enum TopupStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum SourceStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR',
}

export enum AdapterType {
  TELE_API = 'TELE_API',
  HTTP_CUSTOM = 'HTTP_CUSTOM',
  TELEGRAM_CHAT = 'TELEGRAM_CHAT',
  MOCK = 'MOCK',
}

export enum Currency {
  VND = 'VND',
  USD = 'USD',
}

export enum RoutingStrategy {
  PRIORITY = 'PRIORITY',
  CHEAPEST = 'CHEAPEST',
}

export enum PricingMode {
  FIXED = 'FIXED',
  COST_PLUS = 'COST_PLUS',
}

export enum CostBasis {
  PRIORITY = 'PRIORITY',
  HIGHEST = 'HIGHEST',
}

export enum OrderStatus {
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NEEDS_REVIEW = 'NEEDS_REVIEW',
  REFUNDED = 'REFUNDED',
}

export enum OrderItemOrigin {
  SOURCE = 'SOURCE',
  MANUAL = 'MANUAL',
  WARRANTY = 'WARRANTY',
}

export enum WarrantyStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
}

export enum WarrantyResolution {
  REPLACED_SOURCE = 'REPLACED_SOURCE',
  REPLACED_MANUAL = 'REPLACED_MANUAL',
  REFUNDED = 'REFUNDED',
  REJECTED = 'REJECTED',
}

export enum SourceOperation {
  BALANCE = 'BALANCE',
  LIST = 'LIST',
  DETAIL = 'DETAIL',
  BUY = 'BUY',
}

export enum SourceCallResult {
  SUCCESS = 'SUCCESS',
  DEFINITE_FAIL = 'DEFINITE_FAIL',
  UNKNOWN = 'UNKNOWN',
}

export enum DefiniteFailReason {
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  SOURCE_BALANCE = 'SOURCE_BALANCE',
  NOT_FOUND = 'NOT_FOUND',
  AUTH = 'AUTH',
}

export interface ExternalProduct {
  externalId: string;
  name: string;
  rawPrice: number;
  costVnd: number;
  stock: number;
  description?: string;
}

export type BuyResult =
  | { kind: 'SUCCESS'; links: string[]; raw: string }
  | { kind: 'DEFINITE_FAIL'; reason: 'OUT_OF_STOCK' | 'SOURCE_BALANCE' | 'NOT_FOUND' | 'AUTH'; raw?: string }
  | { kind: 'UNKNOWN'; error: string; raw?: string };

export interface SourceAdapter {
  testConnection(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  getBalance(): Promise<{ amount: number; currency: 'VND' | 'USD' }>;
  listProducts(): Promise<ExternalProduct[]>;
  getProduct(externalId: string): Promise<ExternalProduct>;
  buy(externalId: string, quantity: number): Promise<BuyResult>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
}
