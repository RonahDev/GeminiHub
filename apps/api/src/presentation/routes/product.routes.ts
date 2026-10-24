import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../../infrastructure/database/prisma';

export const productRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // FR-PROD-01, FR-PROD-02, FR-PROD-04, FR-PROD-05
  fastify.get('/products', async (req, reply) => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        sources: {
          where: { enabled: true, broken: false },
          include: {
            sourceProduct: {
              include: { source: true },
            },
          },
        },
      },
    });

    const formatted = products.map((prod) => {
      // Calculate total stock from active sources
      let totalStock = 0;
      for (const mapping of prod.sources) {
        if (mapping.sourceProduct.source.status === 'ACTIVE') {
          totalStock += mapping.sourceProduct.stock;
        }
      }

      const isOutOfStock = totalStock <= 0;
      const isPaused = !prod.isActive || !!prod.pausedReason;

      return {
        id: prod.id,
        slug: prod.slug,
        name: prod.name,
        description: prod.description,
        imageUrl: prod.imageUrl,
        currentPrice: Number(prod.currentPrice),
        warrantyMinutes: prod.warrantyMinutes,
        mustUseImmediately: prod.mustUseImmediately,
        maxPerOrder: prod.maxPerOrder,
        showStockCount: prod.showStockCount,
        stock: prod.showStockCount ? totalStock : undefined,
        inStock: !isOutOfStock,
        isPaused,
        pausedReason: isPaused ? (prod.pausedReason || 'Tạm ngưng bán') : undefined,
      };
    });

    return reply.send({ success: true, data: formatted });
  });

  // FR-PROD-03: Product detail by slug
  fastify.get('/products/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const prod = await prisma.product.findUnique({
      where: { slug },
      include: {
        sources: {
          where: { enabled: true, broken: false },
          include: {
            sourceProduct: {
              include: { source: true },
            },
          },
        },
      },
    });

    if (!prod) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Không tìm thấy sản phẩm' },
      });
    }

    let totalStock = 0;
    for (const mapping of prod.sources) {
      if (mapping.sourceProduct.source.status === 'ACTIVE') {
        totalStock += mapping.sourceProduct.stock;
      }
    }

    const isOutOfStock = totalStock <= 0;
    const isPaused = !prod.isActive || !!prod.pausedReason;

    return reply.send({
      success: true,
      data: {
        id: prod.id,
        slug: prod.slug,
        name: prod.name,
        description: prod.description,
        imageUrl: prod.imageUrl,
        currentPrice: Number(prod.currentPrice),
        warrantyMinutes: prod.warrantyMinutes,
        mustUseImmediately: prod.mustUseImmediately,
        maxPerOrder: prod.maxPerOrder,
        showStockCount: prod.showStockCount,
        stock: prod.showStockCount ? totalStock : undefined,
        inStock: !isOutOfStock,
        isPaused,
        pausedReason: isPaused ? (prod.pausedReason || 'Tạm ngưng bán') : undefined,
      },
    });
  });
};
