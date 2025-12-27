import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchInvoices } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { searchParamsSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export const GET = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const { searchParams } = new URL(request.url);

    const rawParams = {
      query: searchParams.get('query') || undefined,
      status: searchParams.get('status') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      minAmount: searchParams.get('minAmount') || undefined,
      maxAmount: searchParams.get('maxAmount') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    // Validate search parameters
    const validatedParams = searchParamsSchema.parse(rawParams);

    const invoices = await searchInvoices(validatedParams);
    return NextResponse.json({ invoices }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to search invoices:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0]?.message ?? ERROR_MESSAGES.VALIDATION_FAILED },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    return NextResponse.json(
      { message: ERROR_MESSAGES.DATABASE_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};
