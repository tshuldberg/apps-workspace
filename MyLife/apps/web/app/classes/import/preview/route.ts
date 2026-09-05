import { NextResponse } from 'next/server';
import { applyImport, parseImportJSON } from '@mylife/classes';
import { getClassesDb } from '../../data';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const json = await request.text();
    const parsed = parseImportJSON(json);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const db = getClassesDb();
    const result = applyImport(db, parsed.bundle, { mode: 'merge', dryRun: true });
    return NextResponse.json({
      schema_version: parsed.bundle.schema_version,
      exported_at: parsed.bundle.exported_at,
      plan: result.applied,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Preview failed' },
      { status: 500 },
    );
  }
}
