// app/components/ChestCard.tsx
import { useState } from 'react';
import { Crown, Diamond, Medal, Warning, DeviceMobile } from '@phosphor-icons/react';
import { AppIcon } from './ui';

type Props = {
  title: string;
  description?: string;
  badge?: string;
  progress?: number;
  variant?: "bronze" | "silver" | "default";
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void | Promise<void>;
  secondaryActionLabel?: string;
  secondaryActionDisabled?: boolean;
  onSecondaryAction?: () => void | Promise<void>;
  error?: string | null;
};

const variantStyles = {
  bronze: {
    gradient: "from-amber-500/20 via-orange-500/20 to-red-500/20",
    border: "border-amber-400/30",
    icon: Crown,
    iconBg: "from-amber-400 to-orange-500",
    button: "from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600",
    progress: "from-amber-400 to-orange-500",
    shadow: ""
  },
  silver: {
    gradient: "from-slate-400/20 via-gray-400/20 to-slate-500/20",
    border: "",
    icon: Medal,
    iconBg: "from-slate-400 to-gray-500",
    button: "from-slate-400 to-gray-500 hover:from-slate-500 hover:to-gray-600",
    progress: "from-slate-400 to-gray-500",
    shadow: ""
  },
  default: {
    gradient: "from-purple-500/20 via-pink-500/20 to-red-500/20",
    border: "",
    icon: Diamond,
    iconBg: "from-purple-400 to-pink-500",
    button: "from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600",
    progress: "from-purple-400 to-pink-500",
    shadow: ""
  }
};

export default function ChestCard({
  title,
  description,
  badge,
  progress,
  variant = "default",
  actionLabel,
  actionDisabled = false,
  onAction,
  secondaryActionLabel,
  secondaryActionDisabled = false,
  onSecondaryAction,
  error
}: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const styles = variantStyles[variant];

  const handleAction = async () => {
    if (!onAction || actionDisabled || isLoading) return;
    
    setIsLoading(true);
    setLocalError(null);
    
    try {
      await onAction();
    } catch (error) {
      console.error('ChestCard action error:', error);
      setLocalError('Action failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecondaryAction = async () => {
    if (!onSecondaryAction || secondaryActionDisabled || secondaryLoading) return;
    
    setSecondaryLoading(true);
    setLocalError(null);
    
    try {
      await onSecondaryAction();
    } catch (error) {
      console.error('ChestCard secondary action error:', error);
      setLocalError('Action failed. Please try again.');
    } finally {
      setSecondaryLoading(false);
    }
  };

  const displayError = error || localError;

  return (
    <article className={`
      app-panel relative overflow-hidden border backdrop-blur-sm transition-all duration-300 hover:scale-105
      ${styles.border} ${styles.shadow} shadow-2xl
    `}>
      {/* Animated background elements */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse delay-1000"></div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center shadow-lg">
              <AppIcon icon={styles.icon} size="lg" weight="fill" className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-1">{title}</h3>
              {description && (
                <p className="text-sm text-white/70">{description}</p>
              )}
            </div>
          </div>

          {badge && (
            <div className={`
              px-4 py-2 rounded-full backdrop-blur-sm border text-xs font-semibold
              ${badge === "Ready" 
                ? "bg-green-500/20 border-green-400/30 text-green-300" 
                : badge === "Cooling" 
                  ? "bg-blue-500/20 border-blue-400/30 text-blue-300"
                  : badge === "Stake required"
                    ? "bg-red-500/20 border-red-400/30 text-red-300"
                    : "bg-white/10 border-white/20 text-white/80"
              }
            `}>
              {badge}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {typeof progress === "number" && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-white/70">Progress</span>
              <span className="text-sm font-semibold text-white">{progress}%</span>
            </div>
            <div
              className="h-3 w-full rounded-full bg-white/10 overflow-hidden"
              role="progressbar"
              aria-label={`${title} progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${progress}% complete`}
            >
              <div
                className={`h-full bg-gradient-to-r ${styles.progress} transition-all duration-1000 ease-out shadow-lg`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {displayError && (
          <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-400/30">
            <div className="flex items-center gap-2">
              <AppIcon icon={Warning} size="md" weight="fill" className="text-red-400" />
              <p className="text-sm text-red-300">{displayError}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={handleAction}
              disabled={actionDisabled || isLoading}
              className={`
                w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed
                ${actionDisabled || isLoading
                  ? "bg-white/10 text-white/50 cursor-not-allowed"
                  : `bg-gradient-to-r ${styles.button} text-black hover:scale-105 ${styles.shadow}`
                }
              `}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </div>
              ) : (
                actionLabel
              )}
            </button>
          )}
          
          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={handleSecondaryAction}
              disabled={secondaryActionDisabled || secondaryLoading}
              className={`
                w-full py-3 rounded-2xl border backdrop-blur-sm text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                ${secondaryActionDisabled || secondaryLoading
                  ? "border-white/20 text-white/40 cursor-not-allowed"
                  : "border-white/30 text-white/90 hover:bg-white/10 hover:border-white/40 hover:scale-105"
                }
              `}
            >
              {secondaryLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <AppIcon icon={DeviceMobile} size="sm" weight="bold" />
                  {secondaryActionLabel}
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
