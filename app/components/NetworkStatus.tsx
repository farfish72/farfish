'use client';

import { useState, useEffect } from 'react';

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      
      // Report to Android
      try {
        if (typeof window !== 'undefined' && (window as any).Android?.reportNetworkStatus) {
          (window as any).Android.reportNetworkStatus('online');
        }
      } catch (_) {}
      
      // Fade out success banner after 2 seconds
      setTimeout(() => {
        setShowBanner(false);
      }, 2000);
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      
      // Report to Android
      try {
        if (typeof window !== 'undefined' && (window as any).Android?.reportNetworkStatus) {
          (window as any).Android.reportNetworkStatus('offline');
        }
      } catch (_) {}
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: isOnline ? '#14F195' : '#FF6B6B',
        color: isOnline ? '#000' : '#fff',
        padding: '12px',
        textAlign: 'center',
        fontWeight: 'bold',
      }}
    >
      {isOnline ? '✓ Back Online' : '⚠️ No Internet Connection — Some features may not work'}
    </div>
  );
}
