import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildInvoicePdf } from '@/lib/pdf';
import { InvoicePayload } from '@/types/invoice';
import { requireAuth } from '@/lib/auth-middleware';
import { sanitizeFilename } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit';

// Basic validation schema for PDF generation
const pdfPayloadSchema = z.object({
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  customer: z.object({
    name: z.string().min(1, 'Customer name is required')
  }).passthrough()
}).passthrough(); // Allow other invoice fields

export const POST = async (request: Request) => {
  // Check rate limit (strict for PDF generation)
  const rateLimitResult = checkRateLimit(request, RateLimitPresets.STRICT);
  if (rateLimitResult) return rateLimitResult;

  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const payload = pdfPayloadSchema.parse(await request.json()) as InvoicePayload;

    // Generate PDF
    const pdfBuffer = await buildInvoicePdf(payload);

    // Sanitize filename to prevent HTTP header injection
    const safeFilename = sanitizeFilename(payload.invoiceNumber) + '.pdf';

    return new NextResponse(pdfBuffer, {
      status: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Failed to generate invoice PDF:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0]?.message ?? ERROR_MESSAGES.VALIDATION_FAILED },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    return NextResponse.json(
      { message: 'Unable to generate invoice PDF.' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};
