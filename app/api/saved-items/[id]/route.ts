import { NextResponse } from 'next/server';
import { deleteSavedItem } from '@/db/queries';

export const DELETE = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  try {
    await deleteSavedItem(params.id);
    return NextResponse.json({ message: 'Saved item deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete saved item', error);
    return NextResponse.json({ message: 'Unable to delete saved item.' }, { status: 500 });
  }
};
