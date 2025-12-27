import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Middleware to verify user authentication on API routes
 * Returns user session if authenticated, or 401 error if not
 */
export async function requireAuth(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    if (!session?.user) {
      return NextResponse.json(
        { message: 'Unauthorized. Please log in to access this resource.' },
        { status: 401 }
      );
    }

    return { session, user: session.user };
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json(
      { message: 'Authentication failed.' },
      { status: 401 }
    );
  }
}

/**
 * Optional authentication - returns session if available, but doesn't block request
 */
export async function optionalAuth(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers as any,
    });

    return session ? { session, user: session.user } : null;
  } catch (error) {
    return null;
  }
}
