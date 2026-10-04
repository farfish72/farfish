"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger" | "success";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-gradient-to-r from-teal to-mint text-ink hover:opacity-90",
  ghost: "bg-white/10 border border-white/10 text-white hover:bg-white/25",
  danger: "bg-gradient-to-r from-red-500 to-rose-500 text-white hover:opacity-90",
  success: "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90",
};

export default function Button({
  variant = "primary",
  loading = false,
  loadingText,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center gap-2
        font-semibold transition
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading ? (
        <>
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
