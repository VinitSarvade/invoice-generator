import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateCustomerRecord } from '@/db/queries';

const customerUpdateSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z
    .string()
    .email('Please provide a valid email')
    .optional()
    .or(z.literal('')),
  address: z.string().optional().or(z.literal(''))
});

export const PATCH = async (
  request: Request,
  { params }: { params: { customerId: string } }
) => {
  try {
    const payload = customerUpdateSchema.parse(await request.json());

    const customer = await updateCustomerRecord(params.customerId, {
      name: payload.name,
      email: payload.email?.trim() || null,
      address: payload.address?.trim() || null
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Failed to update customer', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'Customer not found') {
      return NextResponse.json({ message: 'Customer not found.' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Unable to update customer.' }, { status: 500 });
  }
};
