/**
 * Plan 51 P2/P4: the moderation-side seams that let an anonymous credential
 * presentation become revocable enforcement evidence WITHOUT ever crossing the
 * one-way wall.
 *
 * Two interfaces live here, both moderation-side (never account-side):
 *
 *  - CredentialEvidenceSink: when a surface ACCEPTS a credential presentation
 *    (community public submit, persona registration), it records the presented
 *    serial ALONGSIDE the persona/publication identifier already on that surface.
 *    A serial may co-locate with persona identifiers here -- this is the
 *    moderation side of the wall (design Section 3). It must NEVER co-locate with
 *    an account identifier; no account identifier exists on these surfaces and
 *    none is ever introduced.
 *
 *  - CredentialRevocationSink: the operator enforcement lane (revokeCredentialSerial)
 *    writes a serial + epoch + reason into credential.revocations through this
 *    sink. The bin backs it with the meerkat_moderation role (INSERT on
 *    credential.revocations); tests back it in memory. Defined locally on purpose:
 *    the enforcement lane never imports an account-side store, so no code path can
 *    join an account to a persona.
 *
 * Both are OPTIONAL everywhere: a surface with no evidence sink behaves exactly as
 * before (byte-identical legacy behavior), and the console lane refuses honestly
 * (503) when no revocation sink is wired.
 */

/** One accepted-credential evidence row. Persona-side identifiers only. */
export interface CredentialEvidenceRecord {
  /** The revocation-list key of the accepted credential (sha512(message)/2, hex). */
  serial: string;
  /** The epoch the credential was minted for. */
  epoch: number;
  /**
   * The moderation-side subject the presentation was accepted for: a persona
   * pubkey (submit) or the registering persona (registration). NEVER an account id.
   */
  subject: string;
  /** The surface that accepted it, for the operator's context (no identity). */
  surface: 'community_submit' | 'persona_registration' | 'archive_intake';
  /** Optional publication scope for the community submit surface. */
  publicationId?: string;
}

/**
 * Records accepted-credential evidence so an operator can later revoke the serial
 * of an actioned persona. Append-only by intent; idempotent on (serial, subject).
 */
export interface CredentialEvidenceSink {
  record(evidence: CredentialEvidenceRecord): void | Promise<void>;
}

/**
 * The enforcement write seam: revoke one credential serial. The bin passes a
 * postgres-backed impl using the meerkat_moderation role (INSERT on
 * credential.revocations). Never account-side.
 */
export interface CredentialRevocationSink {
  revokeSerial(serial: string, epoch: number, reason: string): void | Promise<void>;
}

/**
 * In-memory evidence sink (tests, ephemeral runs). Keyed by (serial|subject) so a
 * replayed presentation of the same credential by the same persona is idempotent.
 * The stored rows carry persona identifiers only; a test scans them to assert no
 * account-shaped key ever appears (AC-2).
 */
export class InMemoryCredentialEvidenceSink implements CredentialEvidenceSink {
  private readonly rows = new Map<string, CredentialEvidenceRecord>();

  record(evidence: CredentialEvidenceRecord): void {
    this.rows.set(`${evidence.serial}|${evidence.subject}`, { ...evidence });
  }

  /** Every stored evidence row (copies), for assertions. */
  list(): CredentialEvidenceRecord[] {
    return [...this.rows.values()].map((row) => ({ ...row }));
  }

  /** Evidence rows recorded for one persona subject (the operator lookup shape). */
  forSubject(subject: string): CredentialEvidenceRecord[] {
    const wanted = subject.toLowerCase();
    return this.list().filter((row) => row.subject.toLowerCase() === wanted);
  }
}

/** In-memory revocation sink (tests). Serial -> (epoch, reason). */
export class InMemoryCredentialRevocationSink implements CredentialRevocationSink {
  private readonly revoked = new Map<string, { epoch: number; reason: string }>();

  revokeSerial(serial: string, epoch: number, reason: string): void {
    if (!this.revoked.has(serial)) this.revoked.set(serial, { epoch, reason });
  }

  /** Membership check, so a test verifier can share this sink as its revocation source. */
  isRevoked(serial: string): boolean {
    return this.revoked.has(serial);
  }

  serials(): string[] {
    return [...this.revoked.keys()];
  }
}
