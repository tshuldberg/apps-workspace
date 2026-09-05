import { NextResponse } from 'next/server';
import { loadFullExport, bundleToJSON } from '@mylife/classes';
import { getClassesDb } from '../data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getClassesDb();
    const bundle = loadFullExport(db);
    const json = bundleToJSON(bundle, { pretty: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="myclasses-export-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 },
    );
  }
}
