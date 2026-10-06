"use client";

import { useState, useEffect } from "react";

interface UseScrollProgressOptions {
  debounceMs?: number; // Debounce delay for scroll events
}

/**
 * Hook to track scroll progress as a percentage (0-100)
 * Useful for progress bars, scroll-based animations, etc.
 */
export function useScrollProgress({
  debounceMs = 100,
}: UseScrollProgressOptions = {}) {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const calculateScrollProgress = () => {
      // Cancel previous timeout if exists
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce the calculation
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        const scrollHeight = document.documentElement.scrollHeight;

        // Calculate total scrollable height
        const scrollableHeight = scrollHeight - clientHeight;

        // Avoid division by zero for pages with no scroll
        if (scrollableHeight <= 0) {
          setScrollProgress(100); // Short pages are considered "fully scrolled"
          return;
        }

        // Calculate percentage (0-100)
        const progress = Math.min(
          100,
          Math.max(0, (scrollTop / scrollableHeight) * 100)
        );

        setScrollProgress(Math.round(progress));
      }, debounceMs);
    };

    // Check initial position
    calculateScrollProgress();

    // Add scroll listener with passive flag for better performance
    window.addEventListener("scroll", calculateScrollProgress, {
      passive: true,
    });

    // Also check on resize (viewport changes)
    window.addEventListener("resize", calculateScrollProgress, {
      passive: true,
    });

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener("scroll", calculateScrollProgress);
      window.removeEventListener("resize", calculateScrollProgress);
    };
  }, [debounceMs]);

  return scrollProgress;
}
