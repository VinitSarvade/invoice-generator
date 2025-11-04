import { NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertSavedItem, getSavedLineItems } from '@/db/queries';

const savedItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional().or(z.literal('')),
  unitPrice: z.coerce.number(),
  taxRate: z.coerce.number()
});

export const GET = async () => {
  try {
    const items = await getSavedLineItems();
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to fetch saved items', error);
    return NextResponse.json({ message: 'Unable to fetch saved items.' }, { status: 500 });
  }
};

export const POST = async (request: Request) => {
  try {
    const payload = savedItemSchema.parse(await request.json());

    await upsertSavedItem({
      name: payload.name,
      description: payload.description?.trim() || null,
      unitPrice: payload.unitPrice,
      taxRate: payload.taxRate
    });

    const items = await getSavedLineItems();

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Failed to save line item', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0]?.message ?? 'Invalid item data.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Unable to save line item.' }, { status: 500 });
  }
};
