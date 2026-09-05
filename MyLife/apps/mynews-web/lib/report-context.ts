/**
 * Per-request props for the report card (plan 48 WP10).
 *
 * Three pages render `ReportButton`, and all three need the same two server
 * facts. Centralised so a page cannot accidentally render a report form on a
 * deployment where reporting is off, or claim a reader is signed in when the
 * session read said otherwise.
 */
import 'server-only';

import { readWebLegalContext } from './capabilities';
import { isReaderSignedIn } from './reader-auth';

export interface ReportContext {
  signedIn: boolean;
  reportingEnabled: boolean;
}

export async function readReportContext(): Promise<ReportContext> {
  const { capabilities } = readWebLegalContext();
  if (!capabilities.webReporting) {
    // No form will render, so do not spend an auth round trip discovering who
    // the reader is.
    return { signedIn: false, reportingEnabled: false };
  }
  return { signedIn: await isReaderSignedIn(), reportingEnabled: true };
}
