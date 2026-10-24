'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { formatVnd } from '@/lib/utils';
import { toast } from 'sonner';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import {
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Copy,
  ChevronRight,
  Loader2,
  Wallet,
  ArrowRight,
  Zap,
  Lock,
  Layers,
  ChevronDown,
  Gift,
  HelpCircle,
} from 'lucide-react';

interface Product {
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

export default function HomePage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // References for GSAP animations
  const containerRef = useRef<HTMLDivElement>(null);
  const heroBadgeRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroDescRef = useRef<HTMLParagraphElement>(null);
  const heroPillsRef = useRef<HTMLDivElement>(null);
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const productSectionRef = useRef<HTMLDivElement>(null);
  const stepsSectionRef = useRef<HTMLDivElement>(null);
  const featuresSectionRef = useRef<HTMLDivElement>(null);
  const faqSectionRef = useRef<HTMLDivElement>(null);

  // Stats counter refs
  const stat1Ref = useRef<HTMLSpanElement>(null);
  const stat2Ref = useRef<HTMLSpanElement>(null);
  const stat3Ref = useRef<HTMLSpanElement>(null);
  const stat4Ref = useRef<HTMLSpanElement>(null);

  // Purchase Modal state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  // Purchase Result state
  const [purchaseResult, setPurchaseResult] = useState<{
    status: string;
    code?: string;
    links?: string[];
    failReason?: string;
    warrantyUntil?: string;
  } | null>(null);

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      if (res.success && res.data) {
        setProducts(res.data);
      }
    } catch {
      toast.error('Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  };

  // GSAP Animations setup with useGSAP
  useGSAP(
    () => {
      gsap.registerPlugin(ScrollTrigger);

      // 1. Ambient Background Glow Orbs floating animation
      gsap.to('.ambient-glow-1', {
        x: '+=60',
        y: '+=40',
        scale: 1.15,
        duration: 7,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      gsap.to('.ambient-glow-2', {
        x: '-=50',
        y: '-=30',
        scale: 1.2,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // 2. Hero entrance staggered timeline
      const heroTl = gsap.timeline({ defaults: { ease: 'power4.out' } });

      if (heroBadgeRef.current) {
        heroTl.from(heroBadgeRef.current, {
          y: -20,
          opacity: 0,
          scale: 0.85,
          duration: 0.7,
        });
      }

      if (heroTitleRef.current) {
        heroTl.from(
          heroTitleRef.current,
          {
            y: 35,
            opacity: 0,
            duration: 0.9,
          },
          '-=0.4'
        );
      }

      if (heroDescRef.current) {
        heroTl.from(
          heroDescRef.current,
          {
            y: 25,
            opacity: 0,
            duration: 0.8,
          },
          '-=0.6'
        );
      }

      if (heroPillsRef.current) {
        heroTl.from(
          heroPillsRef.current.children,
          {
            y: 20,
            opacity: 0,
            stagger: 0.12,
            duration: 0.6,
          },
          '-=0.5'
        );
      }

      // 3. Stats Number Counters triggered by ScrollTrigger
      if (statsContainerRef.current) {
        const stats = { val1: 0, val2: 0, val3: 0, val4: 0 };

        ScrollTrigger.create({
          trigger: statsContainerRef.current,
          start: 'top 85%',
          once: true,
          onEnter: () => {
            gsap.from(statsContainerRef.current, {
              y: 40,
              opacity: 0,
              duration: 0.8,
              ease: 'power3.out',
            });

            gsap.to(stats, {
              val1: 99.8,
              val2: 3,
              val3: 24,
              val4: 100,
              duration: 2,
              ease: 'power2.out',
              onUpdate: () => {
                if (stat1Ref.current) stat1Ref.current.textContent = `${stats.val1.toFixed(1)}%`;
                if (stat2Ref.current) stat2Ref.current.textContent = `< ${Math.ceil(stats.val2)}s`;
                if (stat3Ref.current) stat3Ref.current.textContent = `${Math.ceil(stats.val3)}/7`;
                if (stat4Ref.current) stat4Ref.current.textContent = `${Math.ceil(stats.val4)}%`;
              },
            });
          },
        });
      }

      // 4. Steps Horizontal / Vertical Scroll reveal
      if (stepsSectionRef.current) {
        gsap.from('.step-card', {
          scrollTrigger: {
            trigger: stepsSectionRef.current,
            start: 'top 80%',
          },
          y: 45,
          opacity: 0,
          stagger: 0.15,
          duration: 0.8,
          ease: 'power3.out',
        });
      }

      // 5. Features reveal
      if (featuresSectionRef.current) {
        gsap.from('.feature-card', {
          scrollTrigger: {
            trigger: featuresSectionRef.current,
            start: 'top 80%',
          },
          y: 35,
          opacity: 0,
          stagger: 0.12,
          duration: 0.7,
          ease: 'power3.out',
        });
      }

      // 6. FAQ section reveal
      if (faqSectionRef.current) {
        gsap.from(faqSectionRef.current, {
          scrollTrigger: {
            trigger: faqSectionRef.current,
            start: 'top 85%',
          },
          y: 30,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
        });
      }
    },
    { scope: containerRef, dependencies: [loading] }
  );

  // Animate product cards when products are loaded
  useEffect(() => {
    if (!loading && products.length > 0 && productSectionRef.current) {
      gsap.from('.product-card', {
        scrollTrigger: {
          trigger: productSectionRef.current,
          start: 'top 80%',
        },
        y: 40,
        opacity: 0,
        scale: 0.95,
        stagger: 0.15,
        duration: 0.8,
        ease: 'power3.out',
      });
    }
  }, [loading, products]);

  // Animate Modal Pop-in
  useEffect(() => {
    if (selectedProduct && modalRef.current) {
      gsap.fromTo(
        modalRef.current,
        { scale: 0.9, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.5)' }
      );
    }
  }, [selectedProduct]);

  const handleOpenBuyModal = (prod: Product) => {
    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent('/')}`);
      return;
    }
    setSelectedProduct(prod);
    setQuantity(1);
    setAcknowledged(false);
    setPurchaseResult(null);
    setIdempotencyKey(`KEY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedProduct || !acknowledged) return;

    setIsSubmitting(true);
    try {
      const res = await api.post(
        '/orders',
        {
          productId: selectedProduct.id,
          quantity,
          mustUseAcknowledged: acknowledged,
        },
        {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }
      );

      if (res.success && res.data) {
        setPurchaseResult(res.data);
        await refreshUser();
        if (res.data.status === 'COMPLETED') {
          toast.success('Mua link thành công!');
        } else if (res.data.status === 'NEEDS_REVIEW') {
          toast.warning('Đơn hàng đang chờ Admin đối soát');
        } else if (res.data.status === 'FAILED') {
          toast.error(res.data.failReason || 'Đơn hàng không thành công');
        }
      } else {
        toast.error(res.error?.message || 'Có lỗi xảy ra khi tạo đơn hàng');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success('Đã sao chép link vào bộ nhớ tạm');
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Dynamic Ambient Background Glow Elements (GSAP Animated) */}
      <div className="ambient-glow-1 pointer-events-none absolute -top-40 left-1/4 h-[550px] w-[550px] rounded-full bg-blue-600/15 blur-[140px]" />
      <div className="ambient-glow-2 pointer-events-none absolute top-96 right-10 h-[500px] w-[500px] rounded-full bg-purple-600/15 blur-[150px]" />
      <div className="pointer-events-none absolute bottom-96 left-10 h-[450px] w-[450px] rounded-full bg-indigo-600/10 blur-[130px]" />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ==================================================== */}
        {/* 1. HERO BANNER SECTION */}
        {/* ==================================================== */}
        <section className="relative mb-16 overflow-hidden rounded-3xl border border-blue-900/40 bg-gradient-to-br from-blue-950/40 via-indigo-950/30 to-purple-950/40 p-8 sm:p-14 shadow-2xl backdrop-blur-xl">
          <div className="relative z-10 max-w-3xl">
            {/* Badge */}
            <div
              ref={heroBadgeRef}
              className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-500/15 px-3.5 py-1 text-xs font-bold text-blue-400 mb-5 shadow-lg shadow-blue-500/20"
            >
              <Sparkles className="h-4 w-4 animate-spin text-blue-300" style={{ animationDuration: '6s' }} />
              <span>Hệ Thống Tự Động Kết Nối Bot Telegram 24/7</span>
            </div>

            {/* Title */}
            <h1
              ref={heroTitleRef}
              className="text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl bg-gradient-to-r from-white via-blue-100 to-indigo-200 bg-clip-text text-transparent leading-tight"
            >
              Kích Hoạt Bản Quyền Google Gemini Advanced
            </h1>

            {/* Description */}
            <p
              ref={heroDescRef}
              className="mt-5 text-sm sm:text-base text-zinc-300 leading-relaxed max-w-2xl"
            >
              Hệ thống bán lại link kích hoạt tài khoản Google Gemini tự động. Giao link tức thời sau khi mua, tự động failover giữa các nguồn Telegram, bảo vệ an toàn số dư ví và chính sách bảo hành 5 phút uy tín.
            </p>

            {/* Feature Pills */}
            <div
              ref={heroPillsRef}
              className="mt-8 flex flex-wrap gap-4 text-xs font-semibold text-zinc-300"
            >
              <span className="flex items-center gap-2 rounded-xl bg-zinc-900/80 px-3.5 py-2 border border-zinc-800 shadow-sm text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Giao link tức thời trong 3s
              </span>
              <span className="flex items-center gap-2 rounded-xl bg-zinc-900/80 px-3.5 py-2 border border-zinc-800 shadow-sm text-blue-400">
                <Clock className="h-4 w-4" /> Bảo hành đổi mới 5 phút
              </span>
              <span className="flex items-center gap-2 rounded-xl bg-zinc-900/80 px-3.5 py-2 border border-zinc-800 shadow-sm text-purple-400">
                <ShieldCheck className="h-4 w-4" /> VietQR SePay nạp ví tự động
              </span>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 2. LIVE STATS COUNTER SECTION (GSAP SCROLLTRIGGER) */}
        {/* ==================================================== */}
        <section
          ref={statsContainerRef}
          className="mb-20 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
        >
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center backdrop-blur-sm hover:border-zinc-700 transition-colors">
            <span
              ref={stat1Ref}
              className="block text-3xl sm:text-4xl font-extrabold text-blue-400 font-mono"
            >
              0%
            </span>
            <span className="mt-2 block text-xs font-medium text-zinc-400">
              Tỷ Lệ Mua Tự Động Thành Công
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center backdrop-blur-sm hover:border-zinc-700 transition-colors">
            <span
              ref={stat2Ref}
              className="block text-3xl sm:text-4xl font-extrabold text-indigo-400 font-mono"
            >
              0s
            </span>
            <span className="mt-2 block text-xs font-medium text-zinc-400">
              Tốc Độ Giao Link Kích Hoạt
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center backdrop-blur-sm hover:border-zinc-700 transition-colors">
            <span
              ref={stat3Ref}
              className="block text-3xl sm:text-4xl font-extrabold text-purple-400 font-mono"
            >
              0/7
            </span>
            <span className="mt-2 block text-xs font-medium text-zinc-400">
              Hệ Thống Trực Tuyến 24/7
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 text-center backdrop-blur-sm hover:border-zinc-700 transition-colors">
            <span
              ref={stat4Ref}
              className="block text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono"
            >
              0%
            </span>
            <span className="mt-2 block text-xs font-medium text-zinc-400">
              Cam Kết Không Mất Tiền Ví
            </span>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 3. PRODUCT LIST SECTION */}
        {/* ==================================================== */}
        <section ref={productSectionRef} className="mb-20">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">
                <Gift className="h-4 w-4" />
                <span>Bảng Giá Hiện Tại</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Chọn Gói Tài Khoản Gemini
              </h2>
            </div>
            <p className="text-xs text-zinc-400">
              Giá bán được tự động cập nhật theo giá vốn bot nguồn và làm tròn thông minh
            </p>
          </div>

          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
              Hiện chưa có sản phẩm nào được mở bán. Vui lòng quay lại sau!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((prod) => {
                return (
                  <div
                    key={prod.id}
                    className="product-card group relative flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 transition-all duration-300 hover:border-blue-500/50 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1"
                  >
                    <div>
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {prod.mustUseImmediately && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="h-3 w-3" /> Phải dùng ngay
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                          <Clock className="h-3 w-3" /> Bảo hành {prod.warrantyMinutes} phút
                        </span>
                        {prod.showStockCount && prod.stock !== undefined ? (
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${
                              prod.stock > 0
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            Còn {prod.stock}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${
                              prod.inStock
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-red-500/10 text-red-400'
                            }`}
                          >
                            {prod.inStock ? 'Còn hàng' : 'Hết hàng'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                        {prod.name}
                      </h3>

                      <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-blue-400">
                          {formatVnd(prod.currentPrice)}
                        </span>
                        <span className="text-xs text-zinc-500 font-medium">/ 1 link kích hoạt</span>
                      </div>

                      {prod.description && (
                        <div className="mt-4 text-xs text-zinc-400 line-clamp-3 whitespace-pre-line leading-relaxed">
                          {prod.description}
                        </div>
                      )}
                    </div>

                    <div className="mt-8 pt-5 border-t border-zinc-800/80">
                      {prod.isPaused ? (
                        <button
                          disabled
                          className="w-full rounded-xl bg-zinc-800 py-3 text-center text-xs font-bold text-zinc-500 cursor-not-allowed"
                        >
                          {prod.pausedReason || 'Tạm ngưng bán'}
                        </button>
                      ) : !prod.inStock ? (
                        <button
                          disabled
                          className="w-full rounded-xl bg-zinc-800 py-3 text-center text-xs font-bold text-zinc-500 cursor-not-allowed"
                        >
                          Hết hàng
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOpenBuyModal(prod)}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/20 hover:scale-[1.02]"
                        >
                          <span>Mua Ngay Tức Thời</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ==================================================== */}
        {/* 4. HOW IT WORKS TIMELINE (GSAP ANIMATED) */}
        {/* ==================================================== */}
        <section ref={stepsSectionRef} className="mb-24">
          <div className="text-center max-w-xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-400 mb-2">
              <Zap className="h-4 w-4" />
              <span>Quy Trình Hoạt Động</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Sở Hữu Gemini Advanced Chỉ Với 4 Bước
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-zinc-400">
              Quy trình khép kín, hoàn toàn tự động từ lúc nạp tiền đến lúc giao link
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="step-card rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 font-black text-sm mb-4">
                01
              </div>
              <h3 className="font-bold text-white text-base mb-2">Nạp Tiền VietQR</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Tạo mã nạp tiền tự động, quét mã VietQR SePay qua App ngân hàng. Tiền vào ví chỉ sau 3-5 giây.
              </p>
            </div>

            {/* Step 2 */}
            <div className="step-card rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 font-black text-sm mb-4">
                02
              </div>
              <h3 className="font-bold text-white text-base mb-2">Chọn Gói & Xác Nhận</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Chọn gói 1 tháng hoặc 1 năm, xác nhận điều khoản sử dụng ngay và bấm thanh toán an toàn.
              </p>
            </div>

            {/* Step 3 */}
            <div className="step-card rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 font-black text-sm mb-4">
                03
              </div>
              <h3 className="font-bold text-white text-base mb-2">Nhận Link Tức Thời</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Hệ thống gọi bot Telegram lấy link bản quyền, mã hóa AES-256 và hiển thị ngay trên màn hình.
              </p>
            </div>

            {/* Step 4 */}
            <div className="step-card rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 font-black text-sm mb-4">
                04
              </div>
              <h3 className="font-bold text-white text-base mb-2">Kích Hoạt & Bảo Hành</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Bấm vào link và tham gia vào tài khoản Google. Hỗ trợ nút báo lỗi bảo hành 1 chạm trong 5 phút.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 5. CORE SYSTEM INVARIANTS / FEATURES */}
        {/* ==================================================== */}
        <section ref={featuresSectionRef} className="mb-24">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 sm:p-12">
            <div className="mb-10 text-center max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                Tại Sao Chọn GeminiHub?
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-zinc-400">
                Thiết kế với tiêu chuẩn an toàn tài chính và độ tin cậy cao nhất
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="feature-card flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-400">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Failover Nguồn Tự Động</h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Khi nguồn chính hết hàng hoặc số dư bot không đủ, hệ thống tự động failover sang nguồn kế tiếp (tối đa 3 nguồn) trong cùng đơn.
                  </p>
                </div>
              </div>

              <div className="feature-card flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Bảo Toàn Số Dư Sổ Cái</h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Sổ cái ví bất biến (append-only ledger). Nếu bot hết hàng, tiền tự động hoàn trả 100% vào số dư ví ngay lập tức.
                  </p>
                </div>
              </div>

              <div className="feature-card flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Mã Hóa AES-256-GCM</h3>
                  <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                    Thông tin tài khoản, link kích hoạt và API ID của nguồn được mã hóa bằng AES-256-GCM. Không bao giờ lộ bí mật ra bên ngoài.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* 6. FAQ SECTION */}
        {/* ==================================================== */}
        <section ref={faqSectionRef} className="mb-20 max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              <HelpCircle className="h-4 w-4" />
              <span>Câu Hỏi Thường Gặp</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Giải Đáp Thắc Mắc</h2>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Link kích hoạt Gemini Advanced có hạn sử dụng không?',
                a: 'Có. Theo chính sách của nguồn bot Telegram, link kích hoạt phải được sử dụng ngay sau khi nhận và được bảo hành trong vòng 5 phút. Vui lòng bấm kích hoạt vào tài khoản Google ngay khi nhận link.',
              },
              {
                q: 'Nếu bot nguồn hết hàng hoặc gặp lỗi, tôi có bị mất tiền không?',
                a: 'Tuyệt đối không. Hệ thống áp dụng giao dịch nguyên tử 2 pha. Nếu tất cả các nguồn bot đều hết hàng, tiền sẽ được hoàn lại 100% vào số dư ví của bạn kèm thông báo lý do chi tiết.',
              },
              {
                q: 'Nạp tiền vào ví qua VietQR mất bao lâu?',
                a: 'Hệ thống tích hợp cổng SePay tự động ghi nhận giao dịch. Sau khi bạn chuyển khoản đúng số tiền và nội dung (mã GHxxxxxx), tiền sẽ được cộng vào ví trong vòng 3 đến 10 giây.',
              },
              {
                q: 'Tôi gặp sự cố khi kích hoạt link thì làm thế nào?',
                a: 'Trong trang Chi tiết đơn hàng, nếu đơn còn trong thời hạn 5 phút, bạn sẽ thấy nút "Báo lỗi bảo hành". Bạn chỉ cần nhập mô tả lỗi và bấm gửi, ban quản trị sẽ kiểm tra để đổi link mới hoặc hoàn tiền ngay lập tức.',
              },
            ].map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between p-5 text-left text-xs sm:text-sm font-bold text-white hover:bg-zinc-800/40 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-zinc-400 transition-transform duration-300 ${
                        isOpen ? 'rotate-180 text-blue-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="p-5 pt-0 text-xs text-zinc-300 leading-relaxed border-t border-zinc-800/60">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ==================================================== */}
      {/* 7. PURCHASE MODAL WITH GSAP ENTRANCE */}
      {/* ==================================================== */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div
            ref={modalRef}
            className="w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-900 p-7 shadow-2xl"
          >
            {purchaseResult ? (
              /* Purchase Result View */
              <div>
                {purchaseResult.status === 'COMPLETED' ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Mua Link Thành Công!</h3>
                    <p className="mt-1 text-xs text-zinc-400">Mã đơn: {purchaseResult.code}</p>

                    <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 text-left flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        <strong>Lưu ý:</strong> Link có hạn bảo hành <strong>{selectedProduct.warrantyMinutes} phút</strong>. Vui lòng bấm vào link và kích hoạt ngay vào tài khoản Google của bạn!
                      </span>
                    </div>

                    {/* Links Display */}
                    <div className="my-4 space-y-2 text-left">
                      <label className="text-xs font-semibold text-zinc-300">Link kích hoạt của bạn:</label>
                      {purchaseResult.links?.map((link, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 rounded-xl bg-zinc-950 p-3 border border-zinc-800"
                        >
                          <input
                            type="text"
                            readOnly
                            value={link}
                            className="w-full bg-transparent text-xs text-emerald-400 focus:outline-none select-all font-mono"
                          />
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCopyLink(link)}
                              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Sao chép"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                              title="Mở link"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex gap-3">
                      <Link
                        href="/orders"
                        className="flex-1 rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 text-center"
                      >
                        Xem trong Lịch sử đơn
                      </Link>
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="flex-1 rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                ) : purchaseResult.status === 'NEEDS_REVIEW' ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
                      <Clock className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Đơn Đang Được Xử Lý</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      Hệ thống đã gửi lệnh mua nhưng kết quả từ bot nguồn cần được Admin đối soát. Link sẽ được cập nhật trong mục <strong>Lịch sử mua</strong> ngay sau khi kiểm tra xong.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
                      >
                        Đã hiểu
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Mua Hàng Thất Bại</h3>
                    <p className="mt-2 text-xs text-zinc-300">
                      {purchaseResult.failReason || 'Nguồn hàng hiện đang hết hoặc tạm thời không thể cung cấp.'}
                    </p>
                    <p className="mt-1 text-xs text-emerald-400 font-medium">
                      ✓ Tiền đã được tự động hoàn lại vào số dư ví của bạn.
                    </p>
                    <div className="mt-6">
                      <button
                        onClick={() => setSelectedProduct(null)}
                        className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-white hover:bg-zinc-700"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Confirmation Form */
              <div>
                <h3 className="text-xl font-bold text-white">Xác Nhận Đặt Mua</h3>
                <p className="text-xs text-zinc-400 mt-0.5">{selectedProduct.name}</p>

                {/* Quantity */}
                <div className="mt-5 flex items-center justify-between border-y border-zinc-800 py-3.5">
                  <span className="text-xs font-semibold text-zinc-300">Số lượng:</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1 || isSubmitting}
                      className="h-8 w-8 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 font-bold"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-bold text-white">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(selectedProduct.maxPerOrder, q + 1))}
                      disabled={quantity >= selectedProduct.maxPerOrder || isSubmitting}
                      className="h-8 w-8 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 disabled:opacity-40 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Pricing & Balance Calculation */}
                {(() => {
                  const unitPrice = selectedProduct.currentPrice;
                  const totalPrice = unitPrice * quantity;
                  const currentBalance = user?.balance || 0;
                  const balanceAfter = currentBalance - totalPrice;
                  const isShortage = balanceAfter < 0;
                  const shortageAmount = Math.abs(balanceAfter);

                  return (
                    <div className="mt-4 space-y-2 rounded-2xl bg-zinc-950 p-4 border border-zinc-800 text-xs">
                      <div className="flex justify-between text-zinc-400">
                        <span>Đơn giá:</span>
                        <span>{formatVnd(unitPrice)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-white">
                        <span>Tổng thanh toán:</span>
                        <span className="text-blue-400 text-sm font-mono">{formatVnd(totalPrice)}</span>
                      </div>
                      <div className="flex justify-between text-zinc-400 pt-2 border-t border-zinc-800">
                        <span>Số dư ví hiện tại:</span>
                        <span>{formatVnd(currentBalance)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Số dư sau khi mua:</span>
                        <span className={isShortage ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                          {formatVnd(balanceAfter)}
                        </span>
                      </div>

                      {isShortage && (
                        <div className="mt-3 rounded-xl bg-red-500/10 p-3 border border-red-500/20 text-red-300 flex items-center justify-between">
                          <span>Thiếu {formatVnd(shortageAmount)}</span>
                          <Link
                            href="/topup"
                            className="inline-flex items-center gap-1 font-bold text-red-400 hover:underline"
                          >
                            <span>Nạp thêm</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Mandatory Checkbox */}
                {selectedProduct.mustUseImmediately && (
                  <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                    <label className="flex items-start gap-2.5 cursor-pointer text-xs text-amber-200">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="mt-0.5 rounded border-amber-500/50 bg-zinc-900 text-amber-500 focus:ring-0"
                      />
                      <span>
                        Tôi đã hiểu: Link kích hoạt <strong>phải sử dụng ngay</strong> và chỉ được bảo hành trong vòng <strong>{selectedProduct.warrantyMinutes} phút</strong> sau khi mua.
                      </span>
                    </label>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setSelectedProduct(null)}
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-zinc-800 py-3 text-xs font-semibold text-zinc-300 hover:bg-zinc-700"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleConfirmPurchase}
                    disabled={
                      !acknowledged ||
                      isSubmitting ||
                      (user?.balance || 0) < selectedProduct.currentPrice * quantity
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 py-3 text-xs font-bold text-white disabled:opacity-40 shadow-lg shadow-indigo-600/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <span>Xác nhận thanh toán</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
