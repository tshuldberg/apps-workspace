import { ReportSubmissionSchema, type ReportReason, type ReportTargetKind } from '../models';

// The report taxonomy moved to ../taxonomy.ts so the console and Server
// Components can import it without pulling the cloud port (plan 48 WP8). It is
// re-exported here because every existing caller imports it from this module.
export {
  REPORT_REASON_HINTS,
  REPORT_REASON_LABELS,
  REPORT_SEVERITY_RANK,
  REPORT_SLA_HOURS,
  REPORT_URGENT_REASONS,
  isUrgentReportReason,
  reportDeadlineAtMs,
  type UrgentReportReason,
} from '../taxonomy';
import type { MyNewsCloudPort } from './cloud';

export type ReportResult =
  | { ok: true; status: 'submitted' | 'already-reported' | 'escalated' }
  | { ok: false; code: ReportErrorCode; detail?: string };

export type ReportErrorCode =
  | 'validation'
  | 'not-signed-in'
  | 'no-profile'
  | 'bad-target'
  | 'rate-limited'
  | 'intake-unavailable'
  | 'network'
  | 'unknown';

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  'not-signed-in',
  'no-profile',
  'bad-target',
  'rate-limited',
  'intake-unavailable',
]);

type ReportSubmissionResponse =
  | { ok: true; status: 'submitted' | 'already-reported' | 'escalated' }
  | { ok: false; error: string };

interface ReportSubmissionPort {
  submitReport(
    input: Parameters<MyNewsCloudPort['submitReport']>[0],
  ): Promise<ReportSubmissionResponse>;
}

interface SubmitReportInput<TPort extends ReportSubmissionPort> {
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  detail?: string;
  port: TPort;
}

type ReportResultForPort<TPort extends ReportSubmissionPort> =
  | {
      ok: true;
      status: Extract<
        Awaited<ReturnType<TPort['submitReport']>>,
        { ok: true }
      >['status'];
    }
  | Extract<ReportResult, { ok: false }>;

/**
 * Client-side validate, then submit a content report through the port
 * (mynews-report). Shared by the Expo and web report surfaces so the error
 * mapping and validation are identical. Never fabricates success: a typed
 * server error maps to a typed code the UI renders honestly.
 */
export function submitReport<TPort extends ReportSubmissionPort>(
  input: SubmitReportInput<TPort>,
): Promise<ReportResultForPort<TPort>>;
export async function submitReport(
  input: SubmitReportInput<ReportSubmissionPort>,
): Promise<ReportResult> {
  const parsed = ReportSubmissionSchema.safeParse({
    targetKind: input.targetKind,
    targetId: input.targetId,
    reason: input.reason,
    detail: input.detail ?? '',
  });
  if (!parsed.success) {
    return { ok: false, code: 'validation', detail: parsed.error.issues[0]?.message };
  }

  let result: ReportSubmissionResponse;
  try {
    result = await input.port.submitReport({
      targetKind: parsed.data.targetKind,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      detail: parsed.data.detail,
    });
  } catch (error) {
    return { ok: false, code: 'network', detail: (error as Error).message };
  }

  if (result.ok) return { ok: true, status: result.status };
  const code = KNOWN_ERROR_CODES.has(result.error)
    ? (result.error as ReportErrorCode)
    : 'unknown';
  return { ok: false, code, detail: result.error };
}

export interface ReportErrorMessage {
  message: string;
  /** UI hint: a code that needs the user to sign in first. */
  action?: 'sign-in';
}

/** Honest, human copy per typed report error code. No em dashes. */
export function reportErrorMessage(code: ReportErrorCode, detail?: string): ReportErrorMessage {
  switch (code) {
    case 'not-signed-in':
      return { message: 'Sign in to report content. Reports are tied to your account.', action: 'sign-in' };
    case 'no-profile':
      return { message: 'Finish setting up your profile before reporting content.' };
    case 'bad-target':
      return { message: 'That content could not be found. It may have already been removed.' };
    case 'rate-limited':
      return { message: 'You have reported a lot recently. Please wait a minute and try again.' };
    case 'intake-unavailable':
      return { message: 'Could not submit your report right now. Please try again in a moment.' };
    case 'network':
      return { message: 'Could not reach the server. Check your connection and try again.' };
    case 'validation':
      return { message: detail ? `That report is not valid: ${detail}` : 'That report is not valid.' };
    case 'unknown':
    default:
      return { message: detail ? `Something went wrong: ${detail}` : 'Something went wrong. Please try again.' };
  }
}
