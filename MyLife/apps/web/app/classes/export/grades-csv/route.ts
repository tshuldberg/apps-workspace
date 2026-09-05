import { NextResponse } from 'next/server';
import { loadFullExport, gradesCSV } from '@mylife/classes';
import { getClassesDb } from '../../data';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getClassesDb();
    const bundle = loadFullExport(db);
    const csv = gradesCSV(bundle.data.classes, bundle.data.assignments);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="myclasses-grades-${stamp}.csv"`,
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
