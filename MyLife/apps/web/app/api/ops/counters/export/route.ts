import { NextRequest, NextResponse } from 'next/server';
import { listAggregateEventCounters } from '@mylife/db';
import { getAdapter } from '@/lib/db';
import {
  getConfiguredOpsReadKey,
  getProvidedOpsReadKeyFromRequest,
  isOpsReadAuthorized,
} from '@/lib/ops-read-key';

export const runtime = 'nodejs';

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

function csvEscape(value: string | number): string {
  const raw = String(value);
  if (!/[",\n]/.test(raw)) {
    return raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const configuredReadKey = getConfiguredOpsReadKey();
  if (configuredReadKey && !isOpsReadAuthorized(getProvidedOpsReadKeyFromRequest(request))) {
    return NextResponse.json({ error: 'Invalid ops read key.' }, { status: 401 });
  }

  const prefix = request.nextUrl.searchParams.get('prefix')?.trim() || undefined;
  const bucketDate = request.nextUrl.searchParams.get('bucketDate')?.trim() || undefined;
  const limit = parsePositiveInt(request.nextUrl.searchParams.get('limit'));

  const items = listAggregateEventCounters(getAdapter(), {
    eventKeyPrefix: prefix,
    bucketDate,
    limit,
  });

  const lines = [
    'eventKey,bucketDate,count,updatedAt',
    ...items.map((item) => [
      csvEscape(item.event_key),
      csvEscape(item.bucket_date),
      csvEscape(item.count),
      csvEscape(item.updated_at),
    ].join(',')),
  ];

  return new NextResponse(`${lines.join('\n')}\n`, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="mylife-ops-counters.csv"',
      'cache-control': 'no-store',
    },
  });
}
