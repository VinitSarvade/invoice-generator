import { NextResponse } from 'next/server';
import { getInvoiceById, deleteInvoice, updateInvoiceStatus } from '@/db/queries';
import { z } from 'zod';

export const GET = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  try {
    const invoice = await getInvoiceById(params.id);

    if (!invoice) {
      return NextResponse.json({ message: 'Invoice not found.' }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error('Failed to fetch invoice', error);
    return NextResponse.json({ message: 'Unable to fetch invoice.' }, { status: 500 });
  }
};

export const DELETE = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  try {
    await deleteInvoice(params.id);
    return NextResponse.json({ message: 'Invoice deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete invoice', error);
    return NextResponse.json({ message: 'Unable to delete invoice.' }, { status: 500 });
  }
};

const statusSchema = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  paidAt: z.number().optional().nullable()
});

export const PATCH = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  try {
    const body = statusSchema.parse(await request.json());
    await updateInvoiceStatus(params.id, body.status, body.paidAt);
    return NextResponse.json({ message: 'Invoice status updated successfully.' });
  } catch (error) {
    console.error('Failed to update invoice status', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0]?.message ?? 'Invalid status data.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Unable to update invoice status.' }, { status: 500 });
  }
};
