import React from 'react';
import { formatVnd } from '@/lib/utils';
import { AlertTriangle, Clock, Sparkles } from 'lucide-react';

export interface ProductItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  currentPrice: number;
  warrantyMinutes: number;
  mustUseImmediately: boolean;
  maxPerOrder: number;
  showStockCount: boolean;
  stock?: number;
  inStock: boolean;
  isPaused: boolean;
  pausedReason?: string;
}

export interface ProductCardProps {
  product: ProductItem;
  onSelect: (product: ProductItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onSelect }) => {
  return (
    <div className="product-card group relative flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 transition-all duration-300 hover:border-blue-500/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1">
      <div>
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {product.mustUseImmediately && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-3 w-3" /> Phải dùng ngay
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
            <Clock className="h-3 w-3" /> Bảo hành {product.warrantyMinutes} phút
          </span>
          {product.showStockCount && product.stock !== undefined ? (
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${
                product.stock > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              Còn {product.stock}
            </span>
          ) : (
            <span
              className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${
                product.inStock
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {product.inStock ? 'Sẵn hàng' : 'Hết hàng'}
            </span>
          )}
        </div>

        {/* Title & Desc */}
        <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
          {product.name}
        </h3>
        <p className="mt-2 text-xs text-zinc-400 leading-relaxed line-clamp-3">
          {product.description || 'Kích hoạt tài khoản Gemini Advanced bản quyền chính thức'}
        </p>

        {/* Price */}
        <div className="mt-6 mb-4 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
            {formatVnd(product.currentPrice)}
          </span>
          <span className="text-xs text-zinc-500">/ 1 tài khoản</span>
        </div>
      </div>

      {/* Button Action */}
      <div className="mt-6 pt-4 border-t border-zinc-800/80">
        {product.isPaused ? (
          <button
            disabled
            className="w-full rounded-xl bg-zinc-800 py-3 text-xs font-semibold text-zinc-500 cursor-not-allowed"
          >
            {product.pausedReason || 'Tạm ngưng phục vụ'}
          </button>
        ) : !product.inStock ? (
          <button
            disabled
            className="w-full rounded-xl bg-zinc-800 py-3 text-xs font-semibold text-zinc-500 cursor-not-allowed"
          >
            Tạm hết hàng
          </button>
        ) : (
          <button
            onClick={() => onSelect(product)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 py-3 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            <span>Mua Ngay</span>
          </button>
        )}
      </div>
    </div>
  );
};
