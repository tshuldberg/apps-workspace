import { AutoConnectCard } from '../sync/AutoConnectCard';
// Private onboarding keeps the existing join, friend, browse, and restore doors.
// Creation introduces the standard community, then chooses layout before theme.
// Draft previews are local component state; only Create commits signed content.

import { useMemo, useRef, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { ONBOARDING_START_ROWS, suggestedDisplayName, type OnboardingStartOption } from '../../lib/onboarding-core';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { TextField, TextArea } from '../shell/Field';
import { CopyRow } from '../shell/CopyRow';
import { HonestNotice } from '../shell/HonestNotice';
import { InvitePreviewSheet } from '../community/InvitePreviewSheet';

import { useDeviceLayout } from './useDeviceLayout';
import { ExperienceChooser } from './ExperienceChooser';
import { buildOnboardingExperience, findOnboardingExperience, type ExperienceId } from '../../lib/onboarding-experience-core';
import { visibleCommunityName } from '../../lib/community-templates';

type Step = 'create' | 'layout' | 'theme' | 'name' | 'start' | 'join' | 'message' | 'restore';
type BusyAction = 'create' | 'message' | 'open' | 'name' | 'restore' | null;

interface FirstMessageTarget {
  communityId: string;
  channelId: string;
  communityName: string;
}

export function OnboardingOverlay({ unlocked }: { unlocked: boolean }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const { displayName, fingerprint } = m;
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState(displayName);
  const deviceLayout = useDeviceLayout(m.db);
  const [experienceId, setExperienceId] = useState<ExperienceId>(() => deviceLayout.choice === 'community' ? 'standard' : deviceLayout.choice);
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [themeId, setThemeId] = useState('open-burrow');
  const creating = useRef(false);
  const [communityName, setCommunityName] = useState('Friends');
  const [inviteLink, setInviteLink] = useState('');
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [firstMessage, setFirstMessage] = useState('Hi everyone');
  const [target, setTarget] = useState<FirstMessageTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreBackup, setRestoreBackup] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const progressText = useMemo(() => {
    if (step === 'create') return 'Create · 1 of 3 · Community';
    if (step === 'layout') return 'Create · 2 of 3 · Layout';
    if (step === 'theme') return 'Create · 3 of 3 · Theme';
    if (step === 'message') return 'Your community is ready';
    return step === 'name' ? 'Your private name' : step === 'restore' ? 'Restore your identity' : 'How to begin';
  }, [step]);

  const trimmedName = name.trim();
  const suggestion = suggestedDisplayName(displayName);
  const trimmedCommunityName = communityName.trim();
  const trimmedFirstMessage = firstMessage.trim();

  const finish = async (nextTarget?: FirstMessageTarget): Promise<void> => {
    await m.completeOnboarding();
    if (nextTarget) {
      dispatch({ type: 'SELECT_COMMUNITY', communityId: nextTarget.communityId, channelId: nextTarget.channelId });
    }
  };

  const continueWithName = (): void => {
    if (!trimmedName) return;
    setBusy('name');
    void m.updateDisplayName(trimmedName).then(() => {
      setStep('start');
      setNotice(null);
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not save your name. Try again.')).finally(() => setBusy(null));
  };

  const onChoose = (option: OnboardingStartOption): void => {
    setNotice(null);
    if (option !== 'browse' && !unlocked) {
      void finish().then(() => {
        dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } });
      });
      return;
    }
    switch (option) {
      case 'create':
        setStep('create');
        break;
      case 'join':
        setStep('join');
        break;
      case 'add_friend':
        // The Add friend overlay replaces this gate; onboarding completes so the
        // user lands in the app with the friend flow open (no fake community).
        void finish().then(() => {
          dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'add-friend' } });
        });
        break;
      case 'browse':
        // Zero side effects beyond the completion flag; land on Discover.
        void finish().then(() => dispatch({ type: 'OPEN_DISCOVER' }));
        break;
    }
  };

  const createFirstCommunity = (): void => {
    if (creating.current || busy !== null || target) return;
    creating.current = true;
    setBusy('create');
    try {
      const draft = buildOnboardingExperience(communityName, experienceId, themeId);
      const result = m.createCommunityFromTemplate({
        name: draft.name, description: null, accent: null, themeBlob: draft.themeBlob,
        layout: draft.template.layout, layoutBlob: draft.layoutBlob,
        categories: [], chatChannels: draft.channels, libraries: draft.template.libraries,
        completeOnboarding: true,
        ...(useAsDefault ? { localLayoutDefault: { profile: deviceLayout.profile, choice: experienceId } } : {}),
      });
      if (!result.ok) throw new Error(result.error);
      setTarget({ communityId: result.communityId, channelId: result.firstChannelId ?? 'general', communityName: draft.name });
      setFirstMessage('Hi everyone');
      setNotice('Community created. Send a first message or open your community.');
      setStep('message');
    } catch (error) {
      creating.current = false;
      setNotice(error instanceof Error ? error.message : 'Could not create that community.');
    } finally {
      setBusy(null);
    }
  };

  const sendFirstMessage = (): void => {
    if (!target || !trimmedFirstMessage) return;
    setBusy('message');
    try {
      const result = m.sendChannelMessage(target.communityId, target.channelId, trimmedFirstMessage);
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      void finish(target).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not save. Open your community to try again.'));
    } finally {
      setBusy(null);
    }
  };

  const openChannel = (): void => {
    if (!target || busy !== null) return;
    setBusy('open');
    void m.completeOnboarding().then(() => {
      if (deviceLayout.choice !== 'community') dispatch({ type: 'OPEN_COMMUNITY_HOME', communityId: target.communityId });
      else if (experienceId === 'library') dispatch({ type: 'OPEN_LIBRARY_HOME', workspaceId: target.communityId });
      else if (experienceId === 'standard') dispatch({ type: 'SELECT_COMMUNITY', communityId: target.communityId, channelId: target.channelId });
      else dispatch({ type: 'OPEN_COMMUNITY_HOME', communityId: target.communityId });
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not save. Try again.')).finally(() => setBusy(null));
  };

  const trimmedRestoreKey = restoreKey.trim();
  const trimmedRestoreBackup = restoreBackup.trim();

  // Restore an existing identity from a recovery key + encrypted backup. On
  // success the page reloads on the restored identity (handled in the provider);
  // only a failure returns control here. Fail-closed: an honest reason, no change.
  const restoreFromBackup = (): void => {
    if (busy !== null || !trimmedRestoreKey || !trimmedRestoreBackup) return;
    setBusy('restore');
    setRestoreError(null);
    void m.restoreIdentity(trimmedRestoreKey, trimmedRestoreBackup).then((result) => {
      if (!result.ok) {
        setRestoreError(
          result.reason === 'bad_key'
            ? 'That recovery key is not valid. Check for typos; it starts with MKR1.'
            : 'That backup could not be opened with this key. The key may be wrong, or the backup may be corrupt or from a different identity.',
        );
      }
    }).finally(() => setBusy(null));
  };

  // The Join door: the paste box + the ONE preview sheet. Joining from the sheet
  // completes onboarding and selects the community.
  if (previewLink !== null) {
    return (
      <InvitePreviewSheet
        link={previewLink}
        onClose={() => setPreviewLink(null)}
        onJoined={() => { void m.completeOnboarding(); }}
      />
    );
  }

  return (
    <Modal title="Welcome to Meerkat" onClose={() => undefined} locked wide={step === 'layout' || step === 'theme'}>
      <div className="mk-onboarding-step">{progressText}</div>
      {(step === 'name' || step === 'start') && <p className="mk-muted" style={{ marginTop: 0 }}>
        Private social, controlled by you. Pick a name, start with people you trust, then say hello
        in a private space.
      </p>}

      {step === 'name' && (
        <>
          <TextField
            label="Your name"
            value={name}
            placeholder="My Meerkat"
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') continueWithName();
            }}
          />
          {trimmedName !== suggestion ? (
            <Button variant="ghost" small onClick={() => setName(suggestion)}>
              Use "{suggestion}"
            </Button>
          ) : null}
          <div className="mk-label" style={{ marginTop: 12 }}>
            Safety code
          </div>
          <CopyRow value={fingerprint} label="Copy" />
          <p className="mk-muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Friends can compare this to be 100% sure it is really you. Your name is just a label,
            so it is not proof of who you are.
          </p>
          <div style={{ marginTop: 16 }}>
            <Button onClick={continueWithName} disabled={!trimmedName || busy !== null}>
              Continue
            </Button>
          </div>
          <Button variant="ghost" small onClick={() => { setRestoreError(null); setStep('restore'); }}>
            Already have a backup? Restore your identity
          </Button>
        </>
      )}

      {step === 'restore' && (
        <section className="mk-onboarding-card">
          <h3 className="mk-onboarding-card-title">Restore your identity</h3>
          <p className="mk-muted">
            Paste your recovery key and its encrypted backup to bring back the SAME identity on this
            device.
          </p>
          <TextField
            label="Recovery key"
            value={restoreKey}
            onChange={(e) => setRestoreKey(e.target.value)}
            placeholder="MKR1-XXXXX-XXXXX-..."
            autoComplete="off"
            spellCheck={false}
          />
          <TextArea
            label="Encrypted identity backup"
            value={restoreBackup}
            onChange={(e) => setRestoreBackup(e.target.value)}
            placeholder="Paste the encrypted backup"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="mk-btn-row">
            <Button onClick={restoreFromBackup} disabled={!trimmedRestoreKey || !trimmedRestoreBackup || busy !== null}>
              {busy === 'restore' ? 'Restoring...' : 'Restore identity'}
            </Button>
            <Button variant="ghost" onClick={() => { setRestoreError(null); setStep('name'); }}>
              Back
            </Button>
          </div>
          {restoreError && (
            <div className="mk-box is-error" role="alert">{restoreError}</div>
          )}
          <HonestNotice>
            Restoring rebuilds the SAME identity from your recovery key and its encrypted backup:
            same device id and pairings. It restores identity keys, not your synced data, which
            re-flows from peers as you reconnect. A wrong key or a tampered backup fails closed and
            changes nothing.
          </HonestNotice>
        </section>
      )}

      {step === 'start' && unlocked && <AutoConnectCard />}
      {step === 'start' && (
        <div className="mk-onboarding-actions">
          {ONBOARDING_START_ROWS.map((row) => (
            <button
              key={row.option}
              type="button"
              className="mk-onboarding-choice"
              disabled={busy !== null}
              onClick={() => onChoose(row.option)}
            >
              <span className="mk-onboarding-choice-title">{row.title}</span>
              <span className="mk-muted">{row.detail}</span>
            </button>
          ))}
        </div>
      )}

      {(step === 'create' || step === 'layout' || step === 'theme') && (
        <section className="mk-onboarding-card">
          {step === 'create' && <TextField label="Community name" value={communityName} maxLength={80} onChange={(event) => setCommunityName(event.target.value)} placeholder="Community name" />}
          <ExperienceChooser stage={step === 'create' ? 'intro' : step} name={communityName} experienceId={experienceId} themeId={themeId} onExperienceChange={setExperienceId} onThemeChange={setThemeId} />
          {step === 'layout' && <label className="mk-onboarding-default"><input type="checkbox" checked={useAsDefault} onChange={(event) => setUseAsDefault(event.target.checked)} />Use this layout by default on this device ({deviceLayout.profile})</label>}
          {step === 'theme' && <p className="mk-muted">Create “{trimmedCommunityName}” with {findOnboardingExperience(experienceId)?.name}. You can invite people after creating it.</p>}
          <div className="mk-btn-row">
            <Button variant="ghost" disabled={busy !== null} onClick={() => { setNotice(null); setStep(step === 'create' ? 'start' : step === 'layout' ? 'create' : 'layout'); }}>Back</Button>
            {step === 'create' && <Button onClick={() => setStep('layout')} disabled={!visibleCommunityName(communityName)}>Choose a layout</Button>}
            {step === 'layout' && <Button onClick={() => setStep('theme')} disabled={!findOnboardingExperience(experienceId)}>Choose a theme</Button>}
            {step === 'theme' && <Button onClick={createFirstCommunity} disabled={busy !== null}>{busy === 'create' ? 'Creating...' : 'Create community'}</Button>}
          </div>
        </section>
      )}

      {step === 'join' && (
        <section className="mk-onboarding-card">
          <h3 className="mk-onboarding-card-title">Join with an invite</h3>
          <p className="mk-muted">Paste a link from a community owner or admin. You preview before joining.</p>
          <TextArea
            label="Invite link"
            value={inviteLink}
            onChange={(e) => setInviteLink(e.target.value)}
            placeholder="meerkat://community/join#..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="mk-btn-row">
            <Button onClick={() => setPreviewLink(inviteLink.trim())} disabled={inviteLink.trim().length === 0}>
              Preview invite
            </Button>
            <Button variant="ghost" onClick={() => setStep('start')}>
              Back
            </Button>
          </div>
        </section>
      )}

      {step === 'message' && target && (
        <section className="mk-onboarding-card">
          <h3 className="mk-onboarding-card-title">Say hello in {target.communityName}</h3>
          <p className="mk-muted">This message stays inside the community channel.</p>
          <TextArea
            label="First message"
            value={firstMessage}
            onChange={(e) => setFirstMessage(e.target.value)}
            placeholder="Write a first message"
          />
          <div className="mk-btn-row">
            <Button onClick={sendFirstMessage} disabled={!trimmedFirstMessage || busy !== null}>
              {busy === 'message' ? 'Sending...' : 'Send first message'}
            </Button>
            <Button variant="ghost" onClick={openChannel} disabled={busy !== null}>
              Open community
            </Button>
          </div>
        </section>
      )}

      {notice && (
        <div className="mk-box is-info" role="status">
          {notice}
        </div>
      )}
      <HonestNotice>
        Onboarding does not ask you to set up connection details. If a connection is not available
        yet, Meerkat says it is waiting instead of pretending delivery happened.
      </HonestNotice>
    </Modal>
  );
}
