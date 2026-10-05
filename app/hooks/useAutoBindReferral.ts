"use client";

import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

const REFERRAL_CACHE_KEY = "ff_pending_referral";

/**
 * Reliable auto-referral hook for Farcaster MiniApps.
 *
 * Caches ?ref=XXXXXXXX parameter immediately on page load to localStorage,
 * then uses cached value when wallet connects (since URL params may be lost).
 * POSTs { wallet, refCode } once per connection and clears cache on success.
 */
export default function useAutoBindReferral() {
  const { address, isConnected } = useAccount();
  const hasRecorded = useRef(false);

  // Cache referral code immediately on page load
  useEffect(() => {
    if (typeof window === "undefined") return;

    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get("ref");

    if (refCode && refCode.length === 8) {
      // Cache the referral code for later use
      localStorage.setItem(REFERRAL_CACHE_KEY, refCode);
    }
  }, []); // Run only once on mount

  // Process referral when wallet connects
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isConnected || !address) {
      hasRecorded.current = false;
      return;
    }

    // Only record once per wallet connection
    if (hasRecorded.current) return;

    const registerAndRecordReferral = async () => {
      try {
        // Ensure this wallet has a stable dedicated code before it is shared.
        const linkResponse = await fetch(`/api/referral/link?user=${address}`, {
          cache: "no-store",
        });
        if (!linkResponse.ok) {
          console.error("Referral code registration failed:", linkResponse.status, linkResponse.statusText);
        }

        const cachedRefCode = localStorage.getItem(REFERRAL_CACHE_KEY);
        if (!cachedRefCode || cachedRefCode.length !== 8) return;

        const res = await fetch("/api/referral/record", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wallet: address, refCode: cachedRefCode }),
        });

        if (res.ok) {
          const data = await res.json();
          // Check if the referral was actually recorded successfully
          if (data.success) {
            hasRecorded.current = true;
            // Clear cached referral code after successful recording
            localStorage.removeItem(REFERRAL_CACHE_KEY);
            console.log("Referral recorded successfully:", data);
          } else {
            // API returned success: false - log the error but don't clear cache
            console.error("Referral recording failed:", data.error || "Unknown error");
          }
        } else {
          console.error("Referral API request failed:", res.status, res.statusText);
        }
      } catch (error) {
        console.error("Referral recording failed:", error);
      }
    };

    registerAndRecordReferral();
  }, [address, isConnected]);
}
