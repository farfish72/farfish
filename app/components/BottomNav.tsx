"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Package,
  Coins,
  Trophy,
  User,
} from "@phosphor-icons/react";
import { AppIcon } from "./ui";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/chest", label: "Chest", icon: Package },
  { href: "/stake", label: "Stake", icon: Coins },
  { href: "/rank", label: "Rank", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="
      fixed bottom-0 left-1/2 -translate-x-1/2
      w-[95%] max-w-md
      bg-surface
      border border-surface-raised
      rounded-xl
      px-1 py-2
      z-50
    "
    >
      <ul className="flex justify-between items-center">
        {items.map((item) => {
          const active = path === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`
                  flex flex-col items-center gap-1 
                  text-xs font-medium
                  transition-all duration-300 ease-out
                  app-control px-1
                  ${active 
                    ? "border border-accent bg-surface text-accent" 
                    : "text-muted hover:text-white"
                  }
                `}
              >
                <div className={`
                  p-1.5 rounded-control transition-all duration-300
                  ${active 
                    ? "bg-text/20"
                    : "hover:bg-surface-raised"
                  }
                `}>
                  <AppIcon icon={Icon} size="sm" />
                </div>
                <span className="text-[9px] font-semibold tracking-wide">
                  {item.label}
                </span>
                {active && (
                  <div className="w-1 h-1 rounded-full bg-white animate-pulse"></div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
