import { NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertSavedItem, getSavedLineItems } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { unitPriceSchema, taxRateSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

const savedItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').max(200, 'Item name too long'),
  description: z.string().trim().max(1000, 'Description too long').nullable().optional(),
  unitPrice: unitPriceSchema,
  taxRate: taxRateSchema
});

export const GET = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const items = await getSavedLineItems();
    return NextResponse.json({ items }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to fetch saved items:', error);
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
    const payload = savedItemSchema.parse(await request.json());

    await upsertSavedItem({
      name: payload.name,
      description: payload.description || null,
      unitPrice: payload.unitPrice,
      taxRate: payload.taxRate
    });

    const items = await getSavedLineItems();

    return NextResponse.json({ items }, { status: HTTP_STATUS.CREATED });
  } catch (error) {
    console.error('Failed to save line item:', error);
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
