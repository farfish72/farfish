/**
 * Debug logging utilities for wallet connection diagnostics.
 */

interface ConnectionAttemptDetails {
  connectorId: string;
  connectorType: string;
  hasInjected: boolean;
  isMobile: boolean;
  isWebView: boolean;
  userAgent: string;
}

export function logWalletConnectionAttempt(details: ConnectionAttemptDetails): void {
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
  console.log('[WalletConnect Debug]', {
    timestamp: new Date().toISOString(),
    ...details,
    walletConnectProjectId: projectId ? `${projectId.slice(0, 8)}...` : 'not set',
  });
}

export function logWalletConnectionError(error: any, context: string): void {
  console.error('[WalletConnect Error]', {
    context,
    timestamp: new Date().toISOString(),
    errorMessage: error?.message,
    errorCode: error?.code,
    errorName: error?.name,
    errorDetails: error?.details,
    stack: error?.stack,
  });
}
