import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrUpdateInvoice } from '@/db/queries';

const lineItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Line item name is required'),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  taxRate: z.coerce.number()
});

const invoiceSchema = z.object({
  invoiceId: z.string().optional(),
  customerId: z.string().min(1, 'Customer is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().nullable().optional(),
  currencyCode: z.string().min(1, 'Currency is required'),
  currencySymbol: z.string().min(1, 'Currency symbol is required'),
  notes: z.string().optional(),
  roundOff: z.coerce.number(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required')
});

export const POST = async (request: Request) => {
  try {
    const payload = invoiceSchema.parse(await request.json());

    const invoice = await createOrUpdateInvoice({
      invoiceId: payload.invoiceId,
      customerId: payload.customerId,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate ?? null,
      currencyCode: payload.currencyCode,
      currencySymbol: payload.currencySymbol,
      notes: payload.notes ?? '',
      roundOff: payload.roundOff,
      lineItems: payload.lineItems
    });

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Failed to create invoice', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0]?.message ?? 'Invalid invoice data.' }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Unable to create invoice.' }, { status: 500 });
  }
};
