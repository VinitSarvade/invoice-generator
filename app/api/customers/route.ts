import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCustomerRecord, getCustomers } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { customerSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export const GET = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const customers = await getCustomers();
    return NextResponse.json({ customers }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to load customers:', error);
    return NextResponse.json(
      { message: ERROR_MESSAGES.DATABASE_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};

export const POST = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const payload = customerSchema.parse(await request.json());

    const customer = await createCustomerRecord({
      name: payload.name,
      email: payload.email || null,
      address: payload.address || null
    });

    return NextResponse.json({ customer }, { status: HTTP_STATUS.CREATED });
  } catch (error) {
    console.error('Failed to create customer:', error);
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
