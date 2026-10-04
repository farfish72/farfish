"use client";

import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";
import type { IconProps } from "@phosphor-icons/react";

type IconSize = "sm" | "md" | "lg";

const iconSizes: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function AppIcon({
  icon: Icon,
  size = "md",
  ...props
}: { icon: ComponentType<IconProps>; size?: IconSize } & Omit<IconProps, "size">) {
  return <Icon size={iconSizes[size]} {...props} />;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`app-panel ${className}`}>{children}</section>;
}

export function IconButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`app-control inline-flex items-center justify-center ${className}`} {...props}>
      {children}
    </button>
  );
}