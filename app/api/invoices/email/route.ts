import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { buildInvoicePdf } from '@/lib/pdf';
import { EmailPayload } from '@/types/invoice';

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
  try {
    const payload = (await request.json()) as EmailPayload;

    if (!payload?.invoice || !payload?.to) {
      return NextResponse.json(
        { message: 'Recipient address and invoice data are required.' },
        { status: 400 }
      );
    }

    const pdfBuffer = await buildInvoicePdf(payload.invoice);

    const transporter = await getTransporter();

    const fromAddress =
      process.env.SMTP_FROM ||
      payload.senderEmail ||
      'invoice-generator@example.com';

    const message = {
      from: fromAddress,
      to: payload.to,
      cc: payload.cc,
      subject: payload.subject,
      text: payload.message,
      attachments: [
        {
          filename: `${payload.invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(message);

    if ('message' in info) {
      console.info('Invoice email payload', info.message); // JSON transport logs
    }

    return NextResponse.json({
      message: 'Invoice email processed successfully',
      transportInfo: info
    });
  } catch (error) {
    console.error('Failed to send invoice email', error);
    return NextResponse.json(
      { message: 'Unable to send the invoice email.' },
      { status: 500 }
    );
  }
};
