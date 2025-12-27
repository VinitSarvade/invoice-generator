import { NextResponse } from 'next/server';
import { getAnalytics } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export const GET = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const analytics = await getAnalytics();
    return NextResponse.json({ analytics }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { message: ERROR_MESSAGES.DATABASE_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};
