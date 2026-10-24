import { PrismaClient } from '@prisma/client';

// Support JSON serialization of BigInt values across all responses
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

