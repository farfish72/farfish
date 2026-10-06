"use client";

import { useScrollToBottom } from "../hooks/useScrollToBottom";

export default function Footer() {
  const isAtBottom = useScrollToBottom({ threshold: 150, debounceMs: 100 });

  return (
    <footer
      className={`
        fixed bottom-20 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4
        transition-all duration-500 ease-out
        ${
          isAtBottom
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }
      `}
    >
      <div className="border-t border-surface-raised bg-surface p-2 rounded-xl">
        <div className="text-center">
          <p className="text-[10px] font-medium text-muted">
            FarFISH 2026 | Built on Base
          </p>
        </div>
      </div>
    </footer>
  );
}
