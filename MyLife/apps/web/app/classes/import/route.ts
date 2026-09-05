import { NextResponse } from 'next/server';
import { applyImport, parseImportJSON, type ImportMode } from '@mylife/classes';
import { getClassesDb } from '../data';

export const dynamic = 'force-dynamic';

function readMode(value: string | null): ImportMode {
  return value === 'replace' ? 'replace' : 'merge';
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = readMode(url.searchParams.get('mode'));
    const json = await request.text();
    const parsed = parseImportJSON(json);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const db = getClassesDb();
    const result = applyImport(db, parsed.bundle, { mode });
    if (result.errors.length > 0) {
      return NextResponse.json(
        { error: 'Import errors', errors: result.errors, plan: result.applied },
        { status: 422 },
      );
    }
    return NextResponse.json({ ok: true, plan: result.applied });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 },
    );
  }
}
