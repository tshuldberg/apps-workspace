// PublicPersonaSection (Plan 39 P3, Track A). WEB twin of the native persona screens
// (identity Public-persona section S11, alias creation S3, persona settings + GDPR S13),
// folded into one settings section. Verify -> alias picker -> account, then manage / export /
// delete. Everything is the REAL persona service; nothing fabricates a registered/available/
// verified state. With no persona service configured this section says so and creates nothing.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  clearStoredHumanityToken,
  getStoredHumanityToken,
  hasValidStoredToken,
  humanityServiceConfig,
} from '../../lib/humanity-core';
import {
  checkAliasAvailability,
  createAndRegisterPersona,
  deletePersona,
  exportPersona,
  getStoredPersona,
  isPersonaServiceConfigured,
  personaServiceConfig,
  setStoredDisplayName,
  validateAlias,
  type AliasAvailability,
} from '../../lib/persona-core';
import { liveAccountDeps, presentCredentialHeader } from '../../lib/account';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';
import { VerifySheet } from '../discover/VerifySheet';

function availabilityLine(state: AliasAvailability | 'checking' | null): { text: string; tone: 'ok' | 'bad' | 'muted' } | null {
  switch (state) {
    case 'available': return { text: '✓ Available', tone: 'ok' };
    case 'taken': return { text: 'That name is taken', tone: 'bad' };
    case 'invalid': return { text: 'Use 3-20 letters, numbers, or underscores', tone: 'muted' };
    case 'unreachable': return { text: 'Could not check right now', tone: 'muted' };
    case 'not_configured': return { text: 'Needs a connection server', tone: 'muted' };
    case 'checking': return { text: 'Checking…', tone: 'muted' };
    default: return null;
  }
}

function reasonToMessage(reason: string): string {
  switch (reason) {
    case 'not_configured': return 'This build has no account server connected, so nothing was created.';
    case 'needs_verification': return 'Human verification is needed again. Verify and try once more.';
    case 'alias_taken': return 'That name was just taken. Pick another.';
    case 'alias_reserved': return 'That name is reserved. Pick another.';
    case 'alias_cooldown': return 'That name was recently released and is on a 30-day hold. Pick another.';
    case 'persona_exists': return 'This device already has a public name.';
    case 'unreachable': return 'The account server could not be reached. Try again when you are online.';
    default: return 'That did not go through. Nothing was created; try again.';
  }
}

export function PublicPersonaSection(): React.ReactElement {
  const m = useMeerkat();
  const personaConfig = useMemo(() => personaServiceConfig(), []);
  const humanityConfig = useMemo(() => humanityServiceConfig(), []);
  const configured = isPersonaServiceConfigured(personaConfig);

  const [persona, setPersona] = useState(() => getStoredPersona(m.db));
  const [verified, setVerified] = useState(() => hasValidStoredToken(m.db, humanityConfig));
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [alias, setAlias] = useState('');
  const [availability, setAvailability] = useState<AliasAvailability | 'checking' | null>(null);
  const [draftName, setDraftName] = useState(persona?.displayName ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const checkSeq = useRef(0);
  // Synchronous single-flight for Create: two fast clicks land before the busy
  // re-render, and a double register would spend the single-use humanity token
  // twice. Mirrors mobile persona/create.tsx.
  const createInFlightRef = useRef(false);

  const validity = validateAlias(alias);
  const canCheck = configured && alias.trim().length > 0 && validity === 'ok';

  useEffect(() => {
    if (!canCheck) {
      setAvailability(alias.trim().length === 0 ? null : (validity === 'ok' ? null : 'invalid'));
      return;
    }
    const seq = ++checkSeq.current;
    setAvailability('checking');
    const timer = setTimeout(() => {
      void checkAliasAvailability(personaConfig, alias).then((result) => {
        if (checkSeq.current === seq) setAvailability(result);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [alias, canCheck, validity, personaConfig]);

  const onCreate = (): void => {
    if (createInFlightRef.current) return;
    const token = getStoredHumanityToken(m.db);
    if (!token) { setVerified(false); return; }
    createInFlightRef.current = true;
    setBusy(true);
    setNotice(null);
    void (async () => {
      try {
        // createAndRegisterPersona mints + stores the persona key in the browser
        // secret store, which can throw; the catch keeps Create honest and
        // retryable instead of stranding "Creating…" forever.
        const result = await createAndRegisterPersona(
          m.db, personaConfig, token, alias, '', undefined,
          presentCredentialHeader(liveAccountDeps(m.storageSecretAccess)) ?? undefined,
        );
        if (result.ok) {
          clearStoredHumanityToken(m.db); // spent server-side at registration
          void m.db.flush().catch(() => undefined);
          setPersona(getStoredPersona(m.db));
        } else {
          setNotice(reasonToMessage(result.reason));
          if (result.reason === 'needs_verification') setVerified(false);
        }
      } catch {
        setNotice('That did not go through on this device. Try again.');
      } finally {
        createInFlightRef.current = false;
        setBusy(false);
      }
    })();
  };

  const onSaveName = (): void => {
    setStoredDisplayName(m.db, draftName);
    void m.db.flush().catch(() => undefined);
    setPersona(getStoredPersona(m.db));
  };

  const onExport = (): void => {
    setBusy(true);
    setNotice(null);
    void exportPersona(m.db, personaConfig).then((result) => {
      if (result.ok) {
        // Surface the real data: download the JSON so the user actually receives it.
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meerkat-public-data-${persona?.alias ?? 'persona'}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setNotice('Your public data was downloaded as JSON. It includes every post and reply the server holds.');
      } else {
        setNotice(result.reason === 'key_unavailable'
          ? 'The local persona key is unavailable in this browser, so the export could not be signed.'
          : 'Export could not be completed right now. Nothing was changed; try again when you are online.');
      }
      setBusy(false);
    });
  };

  const onDelete = (): void => {
    if (!persona) return;
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(`Delete public persona @${persona.alias}? Releases it after 30 days, signs out all sessions, removes your posts from the feed, and erases the server record. Your private Meerkat is untouched.`);
    if (!confirmed) return;
    setBusy(true);
    setNotice(null);
    void deletePersona(m.db, personaConfig, fetch, m.deleteSecret).then((result) => {
      if (result.ok) {
        void m.db.flush().catch(() => undefined);
        setPersona(null);
      } else {
        setNotice(result.reason === 'key_unavailable'
          ? 'The local persona key is unavailable in this browser, so the delete request could not be signed.'
          : 'Deletion could not be completed right now. Your persona is unchanged; try again when you are online.');
      }
      setBusy(false);
    });
  };

  const availLine = availabilityLine(availability);

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Public persona</h3>
      <p className="mk-muted" style={{ marginTop: 0, fontSize: 13 }}>
        Used for: your devices, friends, private communities, DMs. No account, no server, no verification needed. Unchanged.
      </p>

      {!configured ? (
        <HonestNotice>
          Creating a public name needs a connection to a Meerkat account server, and this build has none configured. Your private Meerkat works fully without it.
        </HonestNotice>
      ) : persona ? (
        <>
          <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>@{persona.alias} · verified</div>
          <p className="mk-muted" style={{ margin: '2px 0', fontSize: 12 }}>
            persona key {persona.personaPubkey.slice(0, 6)}…{persona.personaPubkey.slice(-4)} · separate key, separate life
          </p>
          <p style={{ margin: '2px 0', fontSize: 13 }}>
            Used for: the public feed, topics, public communities. What you post here is public and signed by this name only.
          </p>

          <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>Display name</div>
          <TextField
            label="Display name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="A friendly name"
            aria-label="Display name"
          />
          <p className="mk-muted" style={{ margin: '2px 0 6px', fontSize: 12 }}>Shown next to @{persona.alias}. The alias itself can't change.</p>
          <Button variant="ghost" onClick={onSaveName} disabled={draftName.trim() === (persona.displayName ?? '')}>Save display name</Button>

          <div className="mk-btn-row" style={{ marginTop: 'var(--mk-space-sm)' }}>
            <Button variant="ghost" onClick={onExport} disabled={busy}>{busy ? 'Working…' : 'Export my public data'}</Button>
          </div>
          <p className="mk-muted" style={{ margin: '2px 0', fontSize: 12 }}>Every post and reply, as JSON</p>

          <div className="mk-btn-row" style={{ marginTop: 'var(--mk-space-sm)' }}>
            <Button variant="danger" onClick={onDelete} disabled={busy}>Delete public persona</Button>
          </div>
          <p className="mk-muted" style={{ margin: '2px 0', fontSize: 12 }}>
            Releases @{persona.alias} after 30 days, signs out all sessions, removes your posts from the feed, and erases the server record. Your private Meerkat is untouched.
          </p>
        </>
      ) : !verified ? (
        <>
          <p style={{ margin: '4px 0', fontSize: 13 }}>
            Every public account belongs to a verified human. Verify once on this device to continue. It is anonymous: the check proves you are a person, never who you are.
          </p>
          <Button onClick={() => setVerifyOpen(true)}>Verify I'm human</Button>
        </>
      ) : (
        <>
          <HonestNotice>
            This is a brand-new identity. It is not linked to your device name, your friends, or your private communities, and we can't link it either.
          </HonestNotice>
          <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>Public alias</div>
          <TextField
            label="Public alias"
            value={alias}
            onChange={(e) => { setAlias(e.target.value); setNotice(null); }}
            placeholder="duskrunner"
            aria-label="Your public alias"
          />
          {availLine ? (
            <p style={{ margin: '2px 0', fontSize: 13, color: availLine.tone === 'ok' ? 'var(--mk-success, #19805f)' : availLine.tone === 'bad' ? 'var(--mk-danger, #b3413e)' : 'var(--mk-muted-fg)' }}>
              {availLine.text}
            </p>
          ) : null}
          <p style={{ margin: '6px 0 2px', fontSize: 13 }}>🔑 A new public signing key, made on this device</p>
          <p style={{ margin: '2px 0', fontSize: 13 }}>🌐 Your alias, reserved for you everywhere on Meerkat</p>
          <p style={{ margin: '2px 0 6px', fontSize: 13 }}>🚫 Zero connection to your private identity, by design</p>
          <Button onClick={onCreate} disabled={busy || availability !== 'available'}>
            {busy ? 'Creating…' : (validity === 'ok' ? `Create @${alias.trim().toLowerCase()}` : 'Create public name')}
          </Button>
          <p className="mk-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>
            You can change how your name displays later. The @alias itself is permanent while the account exists.
          </p>
        </>
      )}

      {notice ? <HonestNotice>{notice}</HonestNotice> : null}
      <HonestNotice>
        These two identities are cryptographically unrelated. Meerkat's servers see the persona and never the device key. Nothing you do privately can be tied to {persona ? `@${persona.alias}` : 'your public name'}, and we prove this with tests, not promises.
      </HonestNotice>

      {verifyOpen ? (
        <VerifySheet
          onClose={() => setVerifyOpen(false)}
          onVerified={() => { setVerified(true); setVerifyOpen(false); }}
          purpose="create your public name"
        />
      ) : null}
    </section>
  );
}
