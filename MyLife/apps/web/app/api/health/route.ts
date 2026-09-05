import { NextResponse } from 'next/server';
import { getAdapter } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = getAdapter();
    db.query<{ ok: number }>('SELECT 1 as ok');

    return NextResponse.json(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
