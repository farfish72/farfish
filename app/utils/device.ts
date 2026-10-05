/**
 * Device detection utilities for wallet connection optimization.
 * Safe to use in client components ('use client' context).
 */

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroidWebView(): boolean {
  if (typeof window === 'undefined') return false;
  return /FarfishAndroid/i.test(navigator.userAgent);
}

export function hasInjectedProvider(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).ethereum);
}
