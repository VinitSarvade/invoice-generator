import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCustomerRecord, getCustomers } from '@/db/queries';

const baseCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  email: z
    .string()
    .email('Please provide a valid email')
    .optional()
    .or(z.literal('')),
  address: z.string().optional().or(z.literal(''))
});

export const GET = async () => {
  try {
    const customers = await getCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    console.error('Failed to load customers', error);
    return NextResponse.json({ message: 'Unable to load customers.' }, { status: 500 });
  }
};

export const POST = async (request: Request) => {
  try {
    const payload = baseCustomerSchema.parse(await request.json());

    const customer = await createCustomerRecord({
      name: payload.name,
      email: payload.email?.trim() || null,
      address: payload.address?.trim() || null
    });

    return NextResponse.json({ customer });
  } catch (error) {
    console.error('Failed to create customer', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0]?.message ?? 'Invalid input.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Unable to create customer.' }, { status: 500 });
  }
};
