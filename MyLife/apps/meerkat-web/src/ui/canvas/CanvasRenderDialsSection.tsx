// Plan 56 C1 (3.6, WEB): the receiver-side render dials. DEVICE-LOCAL
// (mk_render_prefs): what THIS member renders is their private choice; nothing
// here touches the community or replicates. OS high-contrast/reduced-motion
// always win over these dials in the renderer.

import { useCallback, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  getRenderPrefs,
  setCanvasAuthorMuted,
  setRenderPref,
  type RenderDialKey,
} from '../../lib/canvas-core';
import { resolveCommunityDisplayName } from '../../lib/meerkat-data';
import { shortHex } from '../format';

const DIALS: ReadonlyArray<{ key: RenderDialKey; label: string; values: readonly string[]; valueLabels: Record<string, string> }> = [
  { key: 'animations', label: 'Animations', values: ['on', 'reduced', 'off'], valueLabels: { on: 'On', reduced: 'Reduced', off: 'Off' } },
  { key: 'sounds', label: 'Sounds', values: ['on', 'tap_only', 'off'], valueLabels: { on: 'On', tap_only: 'Tap only', off: 'Off' } },
  { key: 'backgrounds', label: 'Backgrounds', values: ['on', 'dimmed', 'off'], valueLabels: { on: 'On', dimmed: 'Dimmed', off: 'Off' } },
  { key: 'member_decorations', label: 'Member stickers and drawings', values: ['on', 'off'], valueLabels: { on: 'On', off: 'Off' } },
  { key: 'external_links', label: 'Link cards', values: ['on', 'off'], valueLabels: { on: 'On', off: 'Off' } },
  { key: 'effects', label: 'Effects', values: ['on', 'off'], valueLabels: { on: 'On', off: 'Off' } },
];

const PREF_TO_FIELD: Record<RenderDialKey, 'animations' | 'sounds' | 'backgrounds' | 'memberDecorations' | 'externalLinks' | 'effects'> = {
  animations: 'animations',
  sounds: 'sounds',
  backgrounds: 'backgrounds',
  member_decorations: 'memberDecorations',
  external_links: 'externalLinks',
  effects: 'effects',
};

export function CanvasRenderDialsSection({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const [revision, setRevision] = useState(0);
  const prefs = useMemo(() => { void revision; return getRenderPrefs(m.db, communityId); }, [m.db, communityId, revision]);

  const setDial = useCallback((key: RenderDialKey, value: string) => {
    setRenderPref(m.db, communityId, key, value);
    void m.db.flush().catch(() => undefined);
    setRevision((v) => v + 1);
  }, [m, communityId]);

  return (
    <section className="mk-settings-section">
      <h3>Canvas rendering</h3>
      <p className="mk-muted">
        What YOUR device renders on this community's canvases. Only you see these choices; nothing is removed for anyone else. Your system high-contrast and reduced-motion settings always win.
      </p>
      {DIALS.map((dial) => (
        <div key={dial.key} className="mk-layout-cap-row">
          <div className="mk-layout-cap-copy">{dial.label}</div>
          <div className="mk-layout-editor-chips" style={{ margin: 0 }}>
            {dial.values.map((value) => {
              const active = prefs[PREF_TO_FIELD[dial.key]] === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`mk-layout-chip ${active ? 'active' : ''}`}
                  onClick={() => setDial(dial.key, value)}
                >
                  {dial.valueLabels[value]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {prefs.mutedAuthors.length > 0 ? (
        <div>
          <div className="mk-canvas-panel-title">Hidden decorators</div>
          {prefs.mutedAuthors.map((deviceId) => (
            <div key={deviceId} className="mk-layout-cap-row">
              <span className="mk-muted" style={{ flex: 1 }}>
                {resolveCommunityDisplayName(m.db, communityId, deviceId) ?? shortHex(deviceId)}
              </span>
              <button
                type="button"
                className="mk-layout-chip"
                onClick={() => { setCanvasAuthorMuted(m.db, communityId, deviceId, false); void m.db.flush().catch(() => undefined); setRevision((v) => v + 1); }}
              >
                Show again
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
