"use client";

import { useState, useEffect } from "react";

interface UseScrollToBottomOptions {
  threshold?: number; // Distance from bottom in pixels to trigger visibility
  debounceMs?: number; // Debounce delay for scroll events
}

export function useScrollToBottom({
  threshold = 150,
  debounceMs = 100,
}: UseScrollToBottomOptions = {}) {
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const checkScrollPosition = () => {
      // Cancel previous timeout if exists
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Debounce the scroll check
      timeoutId = setTimeout(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;
        const scrollHeight = document.documentElement.scrollHeight;

        // Calculate if user is near the bottom
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
        const nearBottom = distanceFromBottom <= threshold;

        // For very short pages (no scroll), always show footer
        const isShortPage = scrollHeight <= clientHeight + 50;

        setIsAtBottom(nearBottom || isShortPage);
      }, debounceMs);
    };

    // Check initial position
    checkScrollPosition();

    // Add scroll listener with passive flag for better performance
    window.addEventListener("scroll", checkScrollPosition, { passive: true });
    
    // Also check on resize (viewport changes)
    window.addEventListener("resize", checkScrollPosition, { passive: true });

    // Cleanup
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      window.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, [threshold, debounceMs]);

  return isAtBottom;
}
