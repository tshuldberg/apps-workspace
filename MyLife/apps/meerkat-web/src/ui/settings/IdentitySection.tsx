// IdentitySection (slice 5): rename this device (the hero "Your name"), show the
// friend code for copy, and demote the cryptographic fingerprint to a small
// "Safety code" used only for friend-to-friend verification. Mirrors the native
// Identity tab. The full friend-code controls (make-your-own / regenerate) live
// on the Identity card; here it is copy-only. Everything is the real
// DeviceIdentity; nothing is fabricated, and a name is never proof of identity.

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { CopyRow } from '../shell/CopyRow';

export function IdentitySection(): React.ReactElement {
  const m = useMeerkat();
  const [draft, setDraft] = useState(m.displayName);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const trimmed = draft.trim();
  const dirty = trimmed !== m.displayName;
  const canSave = trimmed.length > 0 && dirty;

  const onSave = (): void => {
    if (!canSave) return;
    setSaveError(null);
    // "Saved" is claimed only after the write resolves; a rejection renders
    // instead of leaving a silent dead button.
    void m.updateDisplayName(trimmed).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }).catch(() => {
      setSaveError('The name could not be saved in this browser. Try again.');
    });
  };

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Identity</h3>
      <TextField
        label="Your name"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        placeholder="My Meerkat"
        aria-label="Your name"
      />
      <Button onClick={onSave} disabled={!canSave}>
        {saved ? 'Saved' : 'Save name'}
      </Button>
      {saveError ? <div className="mk-box is-error" role="alert">{saveError}</div> : null}
      <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>
        Your friend code{m.friendCodeIsCustom ? ' (custom)' : ''}
      </div>
      <CopyRow value={m.friendCode} label="Copy" />
      <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>
        Safety code
      </div>
      <CopyRow value={m.fingerprint} label="Copy" />
      <p className="mk-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
        Friends can compare this to be 100% sure it is really you.
      </p>
      <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>
        Public key
      </div>
      <CopyRow value={m.identity.publicKey} label="Copy key" />
    </section>
  );
}
