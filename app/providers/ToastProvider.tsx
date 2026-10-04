'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import Toast, { ToastProps } from '../components/Toast';

interface ToastContextType {
  showToast: (toast: Omit<ToastProps, 'onClose'>) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

interface ActiveToast extends ToastProps {
  id: string;
}

export default function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastProps, 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ActiveToast = {
      ...toast,
      id,
      onClose: () => removeToast(id),
    };
    
    setToasts(prev => [...prev, newToast]);
  }, [removeToast]);

  const showError = useCallback((message: string) => {
    showToast({ type: 'error', message });
  }, [showToast]);

  const showSuccess = useCallback((message: string) => {
    showToast({ type: 'success', message });
  }, [showToast]);

  const showWarning = useCallback((message: string) => {
    showToast({ type: 'warning', message });
  }, [showToast]);

  const showInfo = useCallback((message: string) => {
    showToast({ type: 'info', message });
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showWarning, showInfo }}>
      {children}
      {toasts.map(toast => (
        <Toast key={toast.id} {...toast} />
      ))}
    </ToastContext.Provider>
  );
}