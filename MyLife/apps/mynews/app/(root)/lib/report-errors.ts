// Report failures map to plain, honest reader-facing copy via the module's
// shared reportErrorMessage (the same mapping the web surface uses). Re-exported
// here so the app imports its error copy from lib/, matching desk-errors and
// publish-errors, and so the copy is unit-testable in the node harness.

export { reportErrorMessage } from '@mylife/mynews';
export type { ReportErrorCode, ReportErrorMessage } from '@mylife/mynews';
