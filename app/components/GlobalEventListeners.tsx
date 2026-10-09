'use client';
import { useEffect } from 'react';

export function GlobalEventListeners() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      try {
        if (typeof window !== 'undefined' && (window as any).Android?.reportError) {
          (window as any).Android.reportError(
            'UnhandledRejection',
            event.reason?.message || String(event.reason),
            event.reason?.stack || ''
          );
        }
      } catch (_) {}
    };
    
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      try {
        if (typeof window !== 'undefined' && (window as any).Android?.reportError) {
          (window as any).Android.reportError(
            'GlobalError',
            event.message || 'Unknown error',
            event.error?.stack || ''
          );
        }
      } catch (_) {}
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
  return null;
}
