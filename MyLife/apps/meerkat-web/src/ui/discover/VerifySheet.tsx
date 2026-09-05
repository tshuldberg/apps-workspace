// Humanity verification sheet (Plan 24 P5, item 14). WEB twin of
// apps/meerkat/app/(root)/components/VerifySheet.tsx. The one honest gate a joiner
// or publisher crosses before an action reaches other people. It never fakes a
// verified state: with no verification service configured (this build) it says so
// and the gated action stays blocked; when configured it runs the REAL Turnstile
// challenge -> issue flow and only reports success after a token is issued.

import { useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  acquireHumanityTokenBatch,
  describeHumanityGate,
  humanityGateState,
  humanityServiceConfig,
  setStoredHumanityTokens,
  type HumanityAttestationSolver,
} from '../../lib/humanity-core';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

/**
 * The web attestation solver. Cloudflare Turnstile needs the widget script + a
 * configured site key (an external network dependency founder-ops wires); until
 * then this returns null (attestation unavailable) rather than a faked pass.
 * Kept injectable so a deploy with a real site key can supply the widget response.
 */
const turnstileSolver: HumanityAttestationSolver = async () => null;

export function VerifySheet({
  onClose,
  onVerified,
  purpose,
}: {
  onClose: () => void;
  /** Called once a real token is issued + stored. The caller then retries the gated action. */
  onVerified: () => void;
  /** What the verification unlocks, for honest copy (e.g. 'join this community'). */
  purpose: string;
}): React.ReactElement {
  const m = useMeerkat();
  const config = useMemo(() => humanityServiceConfig(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const state = humanityGateState(m.db, config);

  const onVerify = (): void => {
    setBusy(true);
    setError(null);
    void acquireHumanityTokenBatch(config, 'turnstile', turnstileSolver).then((result) => {
      if (result.ok) {
        setStoredHumanityTokens(m.db, result.tokens);
        void m.db.flush().catch(() => undefined);
        onVerified();
        onClose();
      } else {
        setError(
          result.reason === 'attestation_unavailable'
            ? 'Human verification needs the Turnstile check, which is not configured in this build, so this action stays off.'
            : result.reason === 'service_unreachable'
              ? 'The verification service could not be reached. Try again when you are online.'
              : 'Verification could not be completed right now. This action stays off until it succeeds.',
        );
      }
      setBusy(false);
    });
  };

  return (
    <Modal title="Verify you're human" onClose={onClose}>
      <p className="mk-muted" style={{ marginTop: 0 }}>Needed once to {purpose}.</p>
      <p>{describeHumanityGate(state)}</p>
      {error && <div className="mk-box is-error" role="alert">{error}</div>}
      <div className="mk-btn-row">
        {state === 'verified' ? (
          <Button onClick={() => { onVerified(); onClose(); }}>Continue</Button>
        ) : state === 'needs_verification' ? (
          <Button onClick={onVerify} disabled={busy}>{busy ? 'Verifying…' : "Verify I'm human"}</Button>
        ) : null}
        <Button variant="ghost" onClick={onClose}>Not now</Button>
      </div>
      <HonestNotice>
        This check is anonymous. It proves you are a person to keep out bulk spam accounts; it never
        proves who you are and is never shown to anyone. Reading and private, on-device features
        never require it.
      </HonestNotice>
    </Modal>
  );
}
