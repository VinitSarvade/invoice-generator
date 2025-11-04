import { NextResponse } from 'next/server';
import { searchInvoices } from '@/db/queries';

export const GET = async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      query: searchParams.get('query') || undefined,
      status: searchParams.get('status') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      minAmount: searchParams.get('minAmount') ? Number(searchParams.get('minAmount')) : undefined,
      maxAmount: searchParams.get('maxAmount') ? Number(searchParams.get('maxAmount')) : undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const invoices = await searchInvoices(params);
    return NextResponse.json({ invoices });
  } catch (error) {
    console.error('Failed to search invoices', error);
    return NextResponse.json({ message: 'Unable to search invoices.' }, { status: 500 });
  }
};
