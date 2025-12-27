import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { buildInvoicePdf } from '@/lib/pdf';
import { EmailPayload } from '@/types/invoice';
import { requireAuth } from '@/lib/auth-middleware';
import { emailPayloadSchema, sanitizeFilename } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES, FEATURE_FLAGS } from '@/lib/constants';
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit';

const getTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host) {
    // Fallback to JSON transport to emulate delivery when SMTP is not configured.
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host,
    port: port ?? (secure ? 465 : 587),
    secure,
    auth: user && pass ? { user, pass } : undefined
  });
};

export const POST = async (request: Request) => {
  // Check rate limit (strict for email sending)
  const rateLimitResult = checkRateLimit(request, RateLimitPresets.STRICT);
  if (rateLimitResult) return rateLimitResult;

  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // Check if email feature is enabled
  if (!FEATURE_FLAGS.ENABLE_EMAIL) {
    return NextResponse.json(
      { message: 'Email functionality is currently disabled.' },
      { status: HTTP_STATUS.SERVICE_UNAVAILABLE }
    );
  }

  try {
    // Validate and sanitize email payload
    const payload = emailPayloadSchema.parse(await request.json());

    // Build PDF
    const pdfBuffer = await buildInvoicePdf(payload.invoice);

    // Get email transporter
    const transporter = await getTransporter();

    // Validate SMTP_FROM in production
    const fromAddress = process.env.SMTP_FROM || payload.senderEmail;
    if (process.env.NODE_ENV === 'production' && !process.env.SMTP_FROM) {
      return NextResponse.json(
        { message: 'Email configuration error. Please contact support.' },
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    // Sanitize filename to prevent header injection
    const safeFilename = sanitizeFilename(payload.invoice.invoiceNumber) + '.pdf';

    const message = {
      from: fromAddress,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      text: payload.message,
      attachments: [
        {
          filename: safeFilename,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(message);

    if ('message' in info) {
      console.info('Invoice email payload:', info.message); // JSON transport logs
    }

    return NextResponse.json(
      {
        message: 'Invoice email sent successfully',
        transportInfo: info
      },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.errors[0]?.message ?? ERROR_MESSAGES.VALIDATION_FAILED },
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }
    return NextResponse.json(
      { message: 'Unable to send the invoice email.' },
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
};
