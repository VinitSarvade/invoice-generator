import { NextResponse } from 'next/server';
import { getInvoiceById, deleteInvoice, updateInvoiceStatus } from '@/db/queries';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

const statusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  paidAt: z.number().optional().nullable()
});

const idParamSchema = z.string().uuid('Invalid invoice ID');

export const GET = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Validate invoice ID
    const invoiceId = idParamSchema.parse(params.id);
    const invoice = await getInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { message: ERROR_MESSAGES.NOT_FOUND },
        { status: HTTP_STATUS.NOT_FOUND }
      );
    }

    return NextResponse.json({ invoice }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to fetch invoice:', error);
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

export const DELETE = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Validate invoice ID
    const invoiceId = idParamSchema.parse(params.id);
    await deleteInvoice(invoiceId);
    return NextResponse.json(
      { message: 'Invoice deleted successfully.' },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('Failed to delete invoice:', error);
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

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Validate invoice ID
    const invoiceId = idParamSchema.parse(params.id);
    const body = statusSchema.parse(await request.json());
    await updateInvoiceStatus(invoiceId, body.status, body.paidAt);
    return NextResponse.json(
      { message: 'Invoice status updated successfully.' },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('Failed to update invoice status:', error);
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
