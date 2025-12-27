import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createOrUpdateInvoice, getAllInvoices } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { invoiceSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export const GET = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const invoices = await getAllInvoices();
    return NextResponse.json({ invoices }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to fetch invoices:', error);
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

    return NextResponse.json({ invoice }, { status: HTTP_STATUS.CREATED });
  } catch (error) {
    console.error('Failed to create invoice:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0]?.message ?? ERROR_MESSAGES.VALIDATION_FAILED },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { message: error.message },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    return NextResponse.json(
      { message: ERROR_MESSAGES.DATABASE_ERROR },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};
