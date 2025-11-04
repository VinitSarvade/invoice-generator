import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCompanySettings, upsertCompanySettings } from '@/db/queries';

const settingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  companyPhone: z.string().optional().or(z.literal('')),
  companyAddress: z.string().optional().or(z.literal('')),
  companyLogo: z.string().optional().or(z.literal('')),
  taxId: z.string().optional().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().or(z.literal(''))
});

export const GET = async () => {
  try {
    const settings = await getCompanySettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to fetch company settings', error);
    return NextResponse.json({ message: 'Unable to fetch company settings.' }, { status: 500 });
  }
};

export const POST = async (request: Request) => {
  try {
    const payload = settingsSchema.parse(await request.json());

    const settings = await upsertCompanySettings({
      companyName: payload.companyName,
      companyEmail: payload.companyEmail?.trim() || null,
      companyPhone: payload.companyPhone?.trim() || null,
      companyAddress: payload.companyAddress?.trim() || null,
      companyLogo: payload.companyLogo?.trim() || null,
      taxId: payload.taxId?.trim() || null,
      website: payload.website?.trim() || null
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to save company settings', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0]?.message ?? 'Invalid settings data.' }, { status: 400 });
    }
    return NextResponse.json({ message: 'Unable to save company settings.' }, { status: 500 });
  }
};
