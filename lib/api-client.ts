/**
 * Type-Safe API Client using Elysia + Eden
 *
 * Provides end-to-end type safety for API calls
 */

import { treaty } from '@elysiajs/eden';
import type { App } from '@/app/api/v2/[[...slugs]]/route';

/**
 * Get the base URL for API calls
 */
function getBaseURL(): string {
  // Client-side: use window.location
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Server-side: use environment variable or localhost
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

/**
 * Type-safe API client
 *
 * @example
 * ```typescript
 * // Client component
 * 'use client';
 *
 * const invoices = await api.v2.invoices.get();
 * //    ^? { success: true; data: InvoiceListItem[] }
 *
 * const invoice = await api.v2.invoices({ id: '123' }).get();
 * //    ^? { success: true; data: InvoicePayload }
 *
 * const created = await api.v2.invoices.post({
 *   customerId: 'xxx',
 *   // ... fully typed!
 * });
 * ```
 */
export const api = treaty<App>(getBaseURL(), {
  // Add credentials for authentication
  fetch: {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  }
});

/**
 * React hook for type-safe API calls with loading states
 *
 * @example
 * ```typescript
 * const { data, loading, error } = useApiQuery(() =>
 *   api.v2.invoices.get()
 * );
 * ```
 */
export function useApiQuery<T>(
  queryFn: () => Promise<{ data: T; error: any }>
) {
  const [state, setState] = React.useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: true,
    error: null
  });

  React.useEffect(() => {
    let mounted = true;

    queryFn()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          setState({ data: null, loading: false, error: new Error(error.value) });
        } else {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setState({ data: null, loading: false, error: err });
      });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

// Re-export for convenience
import React from 'react';
export { React };
