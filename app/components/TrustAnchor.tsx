// app/components/TrustAnchor.tsx
'use client';

import {
  CalendarDots,
  ChartBar,
  ChartLine,
  CheckCircle,
  Coins,
  Crown,
  Fire,
  Handshake,
  HourglassHigh,
  Medal,
  Warning,
} from '@phosphor-icons/react';
import { AppIcon } from './ui';

interface TrustAnchorProps {
  streak: number | null;          // Current consecutive streak
  daysActive: number | null;      // Total cumulative days (never resets)
  referrals: number | null;       // Lifetime referral count
  totalHolding: string | null;    // Total FRH token balance (formatted)
  rank: number | null;            // User's rank based on referrals
  hasActiveStake: boolean;        // Whether user has active NFT stake
  isLoading?: boolean;            // Loading state
  error?: string | null;          // Error message if any
}

export default function TrustAnchor({
  streak,
  daysActive,
  referrals,
  totalHolding,
  rank,
  hasActiveStake,
  isLoading = false,
  error = null,
}: TrustAnchorProps) {
  // Format number safely
  const formatNumber = (num: number | null): string => {
    return num !== null && num >= 0 ? num.toString() : '0';
  };

  // Determine tier based ONLY on active stake status
  const tier = hasActiveStake ? 'Premium' : 'Basic';

  const fields = [
    { icon: CheckCircle,   label: "Status",      value: "Active"                        },
    { icon: CalendarDots,  label: "Active Days",  value: formatNumber(daysActive)        },
    { icon: Fire,          label: "Streak",       value: `${formatNumber(streak)} days`  },
    { icon: Handshake,     label: "Referrals",    value: formatNumber(referrals)         },
    { icon: Coins,         label: "Balance",      value: totalHolding || "0 FRH"         },
    { icon: ChartBar,      label: "Rank",         value: rank ? `#${rank}` : "Unranked" },
    { icon: HourglassHigh, label: "Snapshot",     value: "~30 days"                      },
    { icon: tier === 'Premium' ? Crown : Medal, label: "Tier", value: tier               },
  ];

  return (
    <div className="app-panel relative overflow-hidden border-white/20 shadow-2xl shadow-slate-500/20">
      {/* Animated background elements */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center shadow-lg">
            <AppIcon icon={ChartLine} size="lg" weight="bold" className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Trust Anchor
            </h3>
            <p className="text-sm text-white/70">On-chain activity record</p>
          </div>
        </div>

        {/* Fields Grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {fields.map((field, idx) => (
            <div 
              key={idx}
              className={`
                relative overflow-hidden bg-surface backdrop-blur-sm 
                border border-white/10 rounded-2xl p-3 hover:scale-105 transition-all duration-300
                ${fields.length % 2 !== 0 && idx === fields.length - 1 ? 'col-span-2' : ''}
              `}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg bg-white/15 border border-white/30 flex items-center justify-center shadow-sm flex-shrink-0"
                >
                  <AppIcon icon={field.icon} size="sm" weight="bold" className="text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/60 font-medium">{field.label}</p>
                  <p className="text-sm font-bold text-white truncate">
                    {isLoading ? '...' : field.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Explanation */}
        <div className="app-panel border-white/10">
          <p className="text-sm text-white/80 text-center">
            Activity tracked daily. Counts toward future snapshots.
          </p>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-red-500/10 border border-red-400/30">
            <div className="flex items-center gap-2">
              <AppIcon icon={Warning} size="md" weight="fill" className="text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
