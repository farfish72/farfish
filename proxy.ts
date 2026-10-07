import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy for handling multiple production domains
 * 
 * Supports:
 * - app.farfish.xyz (new primary production domain)
 * - farfish.vercel.app (legacy domain for backward compatibility)
 * - *.vercel.app (Vercel preview deployments)
 * - localhost (development)
 */
export function proxy(request: NextRequest) {
  const { hostname, pathname, search } = request.nextUrl;
  
  // Allow all domains - no redirects
  // This ensures the app works on both app.farfish.xyz and farfish.vercel.app
  // as well as preview deployments and localhost
  
  // Supported domains:
  const isNewPrimaryDomain = hostname === 'app.farfish.xyz';
  const isLegacyDomain = hostname === 'farfish.vercel.app' || hostname.endsWith('.farfish.vercel.app');
  const isLocalhost = hostname === 'localhost' || hostname.startsWith('localhost:');
  const isVercelPreview = hostname.endsWith('.vercel.app') && !isLegacyDomain;
  
  // Log domain access for monitoring (optional, can be removed in production)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Proxy] Request from: ${hostname}${pathname}${search}`);
  }
  
  // Continue without redirecting
  // This allows users to access the app from any of the supported domains
  return NextResponse.next();
}

// Configure which routes the proxy runs on
export const config = {
  // Run on all routes except static files and API routes that don't need domain logic
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.webp$).*)',
  ],
};
