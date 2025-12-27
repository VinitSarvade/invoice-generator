import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteSavedItem } from '@/db/queries';
import { requireAuth } from '@/lib/auth-middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '@/lib/constants';

const idParamSchema = z.string().uuid('Invalid saved item ID');

export const DELETE = async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  // Check authentication
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    // Validate ID
    const itemId = idParamSchema.parse(params.id);
    await deleteSavedItem(itemId);
    return NextResponse.json(
      { message: 'Saved item deleted successfully.' },
      { status: HTTP_STATUS.OK }
    );
  } catch (error) {
    console.error('Failed to delete saved item:', error);
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
