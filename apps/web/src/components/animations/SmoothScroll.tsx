'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ChevronUp } from 'lucide-react';

interface SmoothScrollContextType {
  lenis: Lenis | null;
  scrollTo: (target: string | number | HTMLElement, options?: { offset?: number; duration?: number; immediate?: boolean }) => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextType>({
  lenis: null,
  scrollTo: () => {},
});

export const useSmoothScroll = () => useContext(SmoothScrollContext);

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const pathname = usePathname();
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Register ScrollTrigger with GSAP
    gsap.registerPlugin(ScrollTrigger);

    // Initialize Lenis with optimal physics & silky smooth momentum
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth exponential ease-out
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.05,
      touchMultiplier: 1.8,
      syncTouch: false, // native smooth 120Hz gesture response on mobile devices
    });

    setLenisInstance(lenis);

    // Synchronize Lenis scroll position with GSAP ScrollTrigger
    lenis.on('scroll', (e: any) => {
      ScrollTrigger.update();

      // Track progress for top progress bar & back to top button
      if (typeof window !== 'undefined') {
        const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (totalHeight > 0) {
          const progress = Math.min(1, Math.max(0, e.scroll / totalHeight));
          setScrollProgress(progress);
        }
        setShowBackToTop(e.scroll > 350);
      }
    });

    // Synchronize requestAnimationFrame with GSAP Ticker
    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
      setLenisInstance(null);
    };
  }, []);

  // Handle route navigation: immediately reset scroll and recalculate ScrollTrigger
  useEffect(() => {
    if (lenisInstance) {
      lenisInstance.scrollTo(0, { immediate: true });
      const timer = setTimeout(() => {
        ScrollTrigger.refresh();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pathname, lenisInstance]);

  const scrollTo = (
    target: string | number | HTMLElement,
    options?: { offset?: number; duration?: number; immediate?: boolean }
  ) => {
    if (!lenisInstance) {
      if (typeof target === 'string') {
        const el = document.querySelector(target);
        el?.scrollIntoView({ behavior: 'smooth' });
      } else if (typeof target === 'number') {
        window.scrollTo({ top: target, behavior: 'smooth' });
      }
      return;
    }

    lenisInstance.scrollTo(target, {
      offset: options?.offset ?? -80, // account for sticky navbar height
      duration: options?.duration ?? 1.2,
      immediate: options?.immediate ?? false,
    });
  };

  const handleBackToTop = () => {
    scrollTo(0, { duration: 1.2 });
  };

  return (
    <SmoothScrollContext.Provider value={{ lenis: lenisInstance, scrollTo }}>
      {/* Top Reading Scroll Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-[100] h-[2.5px] pointer-events-none bg-transparent">
        <div
          ref={progressBarRef}
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 shadow-sm shadow-blue-500/50 transition-all duration-75"
          style={{ width: `${scrollProgress * 100}%` }}
        />
      </div>

      {children}

      {/* Floating Smooth Back to Top Button */}
      <button
        onClick={handleBackToTop}
        aria-label="Cuộn lên đầu trang"
        className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-700/80 bg-zinc-900/80 text-zinc-300 shadow-xl backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-blue-500/50 hover:bg-zinc-800 hover:text-white hover:shadow-blue-500/20 active:scale-95 ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <ChevronUp className="h-5 w-5" />
      </button>
    </SmoothScrollContext.Provider>
  );
}
