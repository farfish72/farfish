// Error handling utilities for the FarFISH app

export interface AppError {
  type: 'wallet' | 'network' | 'api' | 'transaction' | 'unknown';
  message: string;
  originalError?: Error;
  code?: string | number;
}

// Wallet-specific error handling
export function handleWalletError(error: any): AppError {
  console.error('Wallet error:', error);

  // User rejected transaction
  if (error?.code === 4001 || error?.message?.includes('rejected') || error?.message?.includes('denied')) {
    return {
      type: 'wallet',
      message: 'Transaction cancelled.',
      originalError: error,
      code: error?.code
    };
  }

  // Insufficient funds
  if (error?.message?.includes('insufficient') || error?.code === -32000) {
    return {
      type: 'wallet',
      message: 'Insufficient balance to complete transaction.',
      originalError: error,
      code: error?.code
    };
  }

  // Network issues
  if (error?.message?.includes('network') || error?.message?.includes('chain')) {
    return {
      type: 'network',
      message: 'Network issue. Please check your connection and try again.',
      originalError: error,
      code: error?.code
    };
  }

  // Wallet not connected
  if (error?.message?.includes('not connected') || error?.message?.includes('no provider')) {
    return {
      type: 'wallet',
      message: 'Wallet not connected. Please connect to continue.',
      originalError: error,
      code: error?.code
    };
  }

  // Generic wallet error
  return {
    type: 'wallet',
    message: 'Wallet error. Please try again.',
    originalError: error,
    code: error?.code
  };
}

// API/Network error handling
export function handleApiError(error: any): AppError {
  console.error('API error:', error);

  // Network timeout
  if (error?.name === 'TimeoutError' || error?.message?.includes('timeout')) {
    return {
      type: 'network',
      message: 'Request timed out. Please try again.',
      originalError: error
    };
  }

  // Network connectivity
  if (error?.message?.includes('fetch') || error?.message?.includes('NetworkError')) {
    return {
      type: 'network',
      message: 'Network error. Check your connection and try again.',
      originalError: error
    };
  }

  // Server errors
  if (error?.status >= 500) {
    return {
      type: 'api',
      message: 'Server error. Please try again later.',
      originalError: error,
      code: error?.status
    };
  }

  // Client errors
  if (error?.status >= 400) {
    return {
      type: 'api',
      message: 'Request failed. Please try again.',
      originalError: error,
      code: error?.status
    };
  }

  // Generic API error
  return {
    type: 'api',
    message: 'Something went wrong. Please try again.',
    originalError: error
  };
}

// Transaction-specific error handling
export function handleTransactionError(error: any): AppError {
  console.error('Transaction error:', error);

  // Transaction reverted
  if (error?.message?.includes('reverted') || error?.message?.includes('execution reverted')) {
    return {
      type: 'transaction',
      message: 'Transaction failed. Please check requirements and try again.',
      originalError: error
    };
  }

  // Gas estimation failed
  if (error?.message?.includes('gas') || error?.message?.includes('Gas')) {
    return {
      type: 'transaction',
      message: 'Transaction failed due to gas issues. Please try again.',
      originalError: error
    };
  }

  // Use wallet error handling for transaction errors
  return handleWalletError(error);
}

// Generic error handler
export function handleGenericError(error: any): AppError {
  console.error('Generic error:', error);

  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: 'Something went wrong. Please try again.',
      originalError: error
    };
  }

  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again.',
    originalError: error
  };
}

// Async wrapper with error handling
export async function withErrorHandling<T>(
  asyncFn: () => Promise<T>,
  errorHandler: (error: any) => AppError = handleGenericError
): Promise<{ data?: T; error?: AppError }> {
  try {
    const data = await asyncFn();
    return { data };
  } catch (error) {
    const appError = errorHandler(error);
    return { error: appError };
  }
}

// Check if user is connected (for wallet operations)
export function checkWalletConnection(address?: string, isConnected?: boolean): AppError | null {
  if (!address || !isConnected) {
    return {
      type: 'wallet',
      message: 'Wallet not connected. Please connect to continue.'
    };
  }
  return null;
}

// Check network
export function checkNetwork(chainId?: number, expectedChainId: number = 8453): AppError | null {
  if (chainId && chainId !== expectedChainId) {
    return {
      type: 'network',
      message: 'Wrong network. Please switch to Base network.'
    };
  }
  return null;
}