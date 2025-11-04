import { NextResponse } from 'next/server';
import { getAnalytics } from '@/db/queries';

export const GET = async () => {
  try {
    const analytics = await getAnalytics();
    return NextResponse.json({ analytics });
  } catch (error) {
    console.error('Failed to fetch analytics', error);
    return NextResponse.json({ message: 'Unable to fetch analytics.' }, { status: 500 });
  }
};
