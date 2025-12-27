import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateCustomerRecord, deleteCustomer } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { customerSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

const customerIdSchema = z.string().uuid('Invalid customer ID');

export const PATCH = async (
  request: Request,
  { params }: { params: { customerId: string } }
) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Validate customer ID
    const customerId = customerIdSchema.parse(params.customerId);
    const payload = customerSchema.parse(await request.json());

    const customer = await updateCustomerRecord(customerId, {
      name: payload.name,
      email: payload.email || null,
      address: payload.address || null
    });

    return NextResponse.json({ customer }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to update customer:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0]?.message ?? ERROR_MESSAGES.VALIDATION_FAILED },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    if (error instanceof Error && error.message === 'Customer not found') {
      return NextResponse.json(
        { message: ERROR_MESSAGES.NOT_FOUND },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }
    return NextResponse.json(
      { message: ERROR_MESSAGES.DATABASE_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};

export const DELETE = async (
  request: Request,
  { params }: { params: { customerId: string } }
) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Validate customer ID
    const customerId = customerIdSchema.parse(params.customerId);
    await deleteCustomer(customerId);
    return NextResponse.json(
      { message: 'Customer deleted successfully.' },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('Failed to delete customer:', error);
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
