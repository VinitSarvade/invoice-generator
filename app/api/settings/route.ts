import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompanySettings, upsertCompanySettings } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { companySettingsSchema } from '@/lib/validation';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

export const GET = async (request: Request) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const settings = await getCompanySettings();
    return NextResponse.json({ settings }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to fetch company settings:', error);
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
    const payload = companySettingsSchema.parse(await request.json());

    const settings = await upsertCompanySettings({
      companyName: payload.companyName,
      companyEmail: payload.companyEmail || null,
      companyPhone: payload.companyPhone || null,
      companyAddress: payload.companyAddress || null,
      companyLogo: payload.companyLogo || null,
      taxId: payload.taxId || null,
      website: payload.website || null
    });

    return NextResponse.json({ settings }, { status: HTTP_STATUS.OK });
  } catch (error) {
    console.error('Failed to save company settings:', error);
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
