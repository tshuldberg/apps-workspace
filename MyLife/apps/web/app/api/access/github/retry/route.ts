import { NextRequest, NextResponse } from 'next/server';
import { getAdapter } from '@/lib/db';
import { grantGitHubSelfHostAccess } from '@/lib/access/github';
import {
  listDueAccessJobs,
  markAccessJobCompleted,
  scheduleAccessJobRetry,
} from '@/lib/access/jobs';
import { assertAdminKey } from '@/lib/admin-key';

export const runtime = 'nodejs';

function parseLimit(value: string | null): number {
  const parsed = Number(value ?? '10');
  if (!Number.isFinite(parsed) || parsed <= 0) return 10;
  return Math.min(100, Math.floor(parsed));
}

export async function POST(request: NextRequest) {
  // Historically this route ran open when MYLIFE_ACCESS_JOB_KEY was unset, to
  // support local-only deployments that call it from a cron shell. Preserve
  // that behavior but use constant-time comparison whenever a key IS set.
  const retryKey = process.env.MYLIFE_ACCESS_JOB_KEY;
  if (retryKey) {
    const auth = assertAdminKey({
      provided: request.headers.get('x-access-job-key'),
      expected: retryKey,
      label: 'access job key',
    });
    if (!auth.ok) return auth.response;
  }

  const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
  const db = getAdapter();
  const jobs = listDueAccessJobs(db, new Date().toISOString(), limit);

  let processed = 0;
  let completed = 0;
  let pending = 0;
  let alerts = 0;

  for (const job of jobs) {
    processed += 1;

    const result = await grantGitHubSelfHostAccess({
      githubUsername: job.payload.githubUsername,
      email: job.payload.customerEmail,
    }).catch((error: unknown) => {
      console.error('GitHub access retry failed:', error);
      return {
        ok: false as const,
        status: 'failed' as const,
        detail: 'Access grant failed.',
      };
    });

    if (result.ok) {
      markAccessJobCompleted(db, job.eventId);
      completed += 1;
      continue;
    }

    const updated = scheduleAccessJobRetry(
      db,
      job.eventId,
      result.detail ?? 'Unknown retry failure.',
      job.payload,
    );

    if (updated.status === 'alert') {
      alerts += 1;
    } else {
      pending += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    completed,
    pending,
    alerts,
  });
}
