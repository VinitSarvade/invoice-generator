import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { customers } from '@/db/schema';

/**
 * Health Check Endpoint
 * Used for monitoring, load balancers, and uptime checks
 *
 * Returns:
 * - 200 OK: System is healthy
 * - 503 Service Unavailable: System has issues
 */
export const GET = async () => {
  const startTime = Date.now();

  try {
    // Check database connectivity
    const dbCheck = await checkDatabase();

    // Check environment configuration
    const envCheck = checkEnvironment();

    const responseTime = Date.now() - startTime;

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV,
      checks: {
        database: dbCheck,
        environment: envCheck,
      },
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    const health = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: { status: 'error', message: 'Database connection failed' },
        environment: checkEnvironment(),
      },
    };

    return NextResponse.json(health, { status: 503 });
  }
};

/**
 * Check database connectivity
 */
async function checkDatabase() {
  try {
    // Simple query to test connection
    await db.select().from(customers).limit(1);

    return {
      status: 'ok',
      message: 'Database connection successful',
    };
  } catch (error) {
    throw new Error(`Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check environment configuration
 */
function checkEnvironment() {
  const warnings: string[] = [];

  // Check critical environment variables in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      warnings.push('NEXT_PUBLIC_APP_URL not set');
    }
    if (!process.env.BETTER_AUTH_SECRET) {
      warnings.push('BETTER_AUTH_SECRET not set');
    }
  }

  return {
    status: warnings.length === 0 ? 'ok' : 'warning',
    message: warnings.length === 0 ? 'Environment configuration valid' : 'Missing configuration',
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

// OPTIONS handler for CORS preflight
export const OPTIONS = async () => {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
};
