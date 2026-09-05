// Plan 38 Phase 1c (web, D.2): the member's per-community theme control. It shows
// an HONEST source line derived ONLY from the resolveActiveTheme source tag (never
// invented) and a device-local toggle between the community theme and the member's
// own theme. It renders nothing when the community has no theme AND the member has
// not opted out AND high contrast is off (there is nothing to say). High contrast
// always wins upstream, so the toggle is disabled and the line reads "High contrast".
//
// Plan 38 Phase 7 (amendment C.4): when the community carries a theme blob, a
// member can "Share theme" (export the owner-signed theme blob byte-for-byte
// through the Plan 18 codec, as copyable text) or "Adopt this theme" (import that
// same blob as their OWN personal theme -- an explicit, device-local act).

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useThemeLibrary } from '../theme/ThemeProvider';
import { useCommunityActiveTheme } from './CommunityThemeBoundary';
import {
  communityThemeSourceLabel,
  communityThemeToggleLabel,
} from '../../lib/community-theme-view';
import { Button } from '../shell/Button';
import { CopyRow } from '../shell/CopyRow';

export function CommunityThemeToggle({ communityId }: { communityId: string }): React.ReactElement | null {
  const m = useMeerkat();
  const themeLib = useThemeLibrary();
  void m.revision;
  const identity = m.communityIdentity(communityId);
  const mode = m.communityThemeMode(communityId);
  const active = useCommunityActiveTheme(communityId);
  const label = communityThemeSourceLabel(active.source);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const hasCommunityLook = Boolean(identity?.themeBlob || identity?.accentColor);
  // Nothing to show: no community look, member has not opted out, high contrast off.
  if (!hasCommunityLook && mode === 'community' && active.source === 'base') return null;
  if (!label) return null;

  const highContrast = active.source === 'high_contrast';
  const themeBlob = identity?.themeBlob ?? null;

  const adopt = (): void => {
    if (!themeBlob) return;
    const imported = themeLib.importThemeBlob(themeBlob);
    if (imported.success && imported.id) {
      themeLib.applyTheme(imported.id);
      setNotice('Saved to your themes and applied on this device.');
    } else {
      setNotice('That theme could not be read.');
    }
  };

  return (
    <div className="mk-community-theme-toggle" aria-label="Community theme">
      <span className="mk-muted" style={{ fontSize: 12 }}>{label}</span>
      {hasCommunityLook && !highContrast ? (
        <Button
          variant="ghost"
          small
          onClick={() => m.setCommunityThemeMode(communityId, mode === 'community' ? 'mine' : 'community')}
        >
          {communityThemeToggleLabel(mode)}
        </Button>
      ) : null}
      {themeBlob ? (
        <>
          <Button variant="ghost" small onClick={adopt}>Adopt this theme</Button>
          <Button variant="ghost" small onClick={() => setSharing((v) => !v)}>Share theme</Button>
        </>
      ) : null}
      {sharing && themeBlob ? (
        <div className="mk-community-theme-share">
          <p className="mk-muted" style={{ fontSize: 12, margin: '4px 0' }}>
            Copy this theme code. Anyone can paste it into Appearance to use the same look.
          </p>
          <CopyRow value={themeBlob} label="Copy theme" />
        </div>
      ) : null}
      {notice ? <p className="mk-muted" style={{ fontSize: 12, margin: '4px 0 0' }}>{notice}</p> : null}
    </div>
  );
}
