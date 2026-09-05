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

  return NextResponse.json({
    items: items.map((item) => ({
      eventKey: item.event_key,
      bucketDate: item.bucket_date,
      count: item.count,
      updatedAt: item.updated_at,
    })),
  });
}
