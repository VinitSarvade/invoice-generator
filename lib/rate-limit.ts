import { NextResponse } from 'next/server';
import { HTTP_STATUS, FEATURE_FLAGS } from './constants';

/**
 * Rate limiter configuration
 */
interface RateLimitConfig {
  /**
   * Maximum number of requests allowed in the time window
   */
  maxRequests: number;
  /**
   * Time window in milliseconds
   */
  windowMs: number;
  /**
   * Optional message to return when rate limited
   */
  message?: string;
}

/**
 * Request tracking entry
 */
interface RequestTracker {
  count: number;
  resetTime: number;
}

/**
 * In-memory store for rate limiting
 * In production, consider using Redis or similar distributed cache
 */
class RateLimitStore {
  private store: Map<string, RequestTracker> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): RequestTracker | undefined {
    return this.store.get(key);
  }

  set(key: string, value: RequestTracker): void {
    this.store.set(key, value);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Global rate limit store
const rateLimitStore = new RateLimitStore();

/**
 * Get client identifier from request
 * Uses IP address or a combination of headers for identification
 */
function getClientIdentifier(request: Request): string {
  // Try to get real IP from various headers (when behind proxy/load balancer)
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const realIp = headers.get('x-real-ip');
  const cfConnectingIp = headers.get('cf-connecting-ip'); // Cloudflare

  let ip: string;
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    ip = forwardedFor.split(',')[0].trim();
  } else if (realIp) {
    ip = realIp;
  } else if (cfConnectingIp) {
    ip = cfConnectingIp;
  } else {
    // Fallback - use combination of user-agent and accept-language as fingerprint
    const userAgent = headers.get('user-agent') || 'unknown';
    const acceptLang = headers.get('accept-language') || 'unknown';
    ip = `fallback-${userAgent.substring(0, 50)}-${acceptLang.substring(0, 20)}`;
  }

  return ip;
}

/**
 * Rate limiting middleware using token bucket algorithm
 *
 * @param request - The incoming request
 * @param config - Rate limit configuration
 * @returns NextResponse if rate limited, null otherwise
 *
 * @example
 * ```typescript
 * export const GET = async (request: Request) => {
 *   const rateLimitResult = checkRateLimit(request, { maxRequests: 100, windowMs: 60000 });
 *   if (rateLimitResult) return rateLimitResult;
 *   // ... handle request
 * };
 * ```
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig
): NextResponse | null {
  // Skip rate limiting if disabled
  if (!FEATURE_FLAGS.ENABLE_RATE_LIMITING) {
    return null;
  }

  const identifier = getClientIdentifier(request);
  const now = Date.now();
  const key = `ratelimit:${identifier}`;

  const tracker = rateLimitStore.get(key);

  if (!tracker || tracker.resetTime < now) {
    // First request or window has expired, create new tracker
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return null;
  }

  if (tracker.count >= config.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((tracker.resetTime - now) / 1000);

    return NextResponse.json(
      {
        message: config.message || 'Too many requests. Please try again later.',
        retryAfter: retryAfter
      },
      {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(tracker.resetTime / 1000).toString()
        }
      }
    );
  }

  // Increment request count
  tracker.count++;
  rateLimitStore.set(key, tracker);

  return null;
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitPresets = {
  /**
   * Strict limit for expensive operations (e.g., PDF generation, email sending)
   * 10 requests per minute
   */
  STRICT: { maxRequests: 10, windowMs: 60000 },

  /**
   * Standard limit for most API endpoints
   * 100 requests per minute
   */
  STANDARD: { maxRequests: 100, windowMs: 60000 },

  /**
   * Generous limit for read operations
   * 300 requests per minute
   */
  GENEROUS: { maxRequests: 300, windowMs: 60000 },

  /**
   * Very strict limit for authentication endpoints
   * 5 requests per 15 minutes (prevents brute force)
   */
  AUTH: { maxRequests: 5, windowMs: 15 * 60000 }
} as const;

/**
 * Cleanup function for graceful shutdown
 */
export function cleanupRateLimiter(): void {
  rateLimitStore.destroy();
}
