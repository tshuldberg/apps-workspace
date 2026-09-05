import { REPORT_REASON_LABELS, type ReportView } from '@mylife/mynews';

const TARGET_LABEL: Record<ReportView['targetKind'], string> = {
  article: 'Article',
  revision: 'Revision',
  suggestion: 'Suggestion',
  profile: 'Profile',
  media: 'Media',
};

const STATUS_LABEL: Record<ReportView['status'], string> = {
  open: 'Under review',
  actioned: 'Action taken',
  no_action: 'No action needed',
};

export interface MyReportRow {
  id: string;
  title: string;
  status: string;
  detail: string;
}

/** Pure view-model for a "My reports" row. Honest labels, no fabrication. */
export function toMyReportRow(report: ReportView): MyReportRow {
  return {
    id: report.id,
    title: `${TARGET_LABEL[report.targetKind]} · ${REPORT_REASON_LABELS[report.reason]}`,
    status: STATUS_LABEL[report.status],
    detail: report.detail,
  };
}
