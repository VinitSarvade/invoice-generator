import { NextResponse } from 'next/server';
import { buildInvoicePdf } from '@/lib/pdf';
import { InvoicePayload } from '@/types/invoice';

export const POST = async (request: Request) => {
  try {
    const payload = (await request.json()) as InvoicePayload;

    if (!payload?.customer?.name || !payload.invoiceNumber) {
      return NextResponse.json(
        { message: 'Invoice number and customer details are required.' },
        { status: 400 }
      );
    }

    const pdfBuffer = await buildInvoicePdf(payload);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${payload.invoiceNumber}.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      }
    });
  } catch (error) {
    console.error('Failed to generate invoice PDF', error);
    return NextResponse.json(
      { message: 'Unable to generate invoice PDF.' },
      { status: 500 }
    );
  }
};
