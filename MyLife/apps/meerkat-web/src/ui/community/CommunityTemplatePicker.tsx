// Plan 38 Phase 7 (amendment C.1, WEB): the "Start from a template" section of the
// create-community flow. A grid of six presets (Family Space, Media Library, Club,
// Course Hub, Newsroom, Blank), each composing ONLY the shipped chat + library
// kinds plus a theme/identity/category/layout preset. Picking one opens a detail
// step: the community name, a plain-language summary of what it creates, an
// optional "Adopt this theme" for the creator's own device, and a Create button
// that runs the all-or-nothing staged commit (m.createCommunityFromTemplate). On
// success it navigates honoring the template's layout; on failure NOTHING
// persisted and the honest error shows. Theme blobs are resolved here from each
// preset id through the shipped Plan 18 codec (themeLib.exportThemeBlob).

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { useThemeLibrary } from '../theme/ThemeProvider';
import { Button } from '../shell/Button';
import { TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';
import { MEDIA_TYPE_META } from '../library/media-meta';
import {
  COMMUNITY_TEMPLATES,
  TEMPLATE_PICKER_HEADING,
  templateGenesisCategories,
  templateGenesisChannels,
  type CommunityTemplate,
} from '../../lib/community-templates';

export function CommunityTemplatePicker({ onClose }: { onClose: () => void }): React.ReactElement {
  const [selected, setSelected] = useState<CommunityTemplate | null>(null);

  if (selected) {
    return <TemplateDetail template={selected} onBack={() => setSelected(null)} onClose={onClose} />;
  }

  return (
    <div className="mk-template-picker">
      <div className="mk-h2">{TEMPLATE_PICKER_HEADING}</div>
      <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Pick a starting point. You can rename channels, add libraries, and change the look any time.
      </p>
      <div className="mk-template-grid">
        {COMMUNITY_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="mk-template-card"
            onClick={() => setSelected(template)}
          >
            <span className="mk-template-card-name">{template.name}</span>
            <span className="mk-template-card-blurb mk-muted">{template.blurb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplateDetail({
  template,
  onBack,
  onClose,
}: {
  template: CommunityTemplate;
  onBack: () => void;
  onClose: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const themeLib = useThemeLibrary();
  const [name, setName] = useState(template.name);
  const [adopt, setAdopt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasTheme = template.themePresetId !== null;

  const onCreate = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the community a name.');
      return;
    }
    setBusy(true);
    setError(null);
    // Resolve the preset id into the codec theme blob (null when the preset is
    // gone or the theme system is unavailable -- the community still creates,
    // just without a theme).
    const themeBlob = template.themePresetId ? themeLib.exportThemeBlob(template.themePresetId) : null;
    // A THROW here (e.g. the signing key is unavailable in secure storage) must
    // surface honestly and release the button. Without this the UI sat on
    // "Creating…" forever, implying work in progress after it had already failed.
    let result: ReturnType<typeof m.createCommunityFromTemplate>;
    try {
      result = m.createCommunityFromTemplate({
        name: trimmed,
        description: template.description || null,
        accent: template.accent,
        themeBlob,
        layout: template.layout,
        categories: templateGenesisCategories(template),
        chatChannels: templateGenesisChannels(template),
        libraries: template.libraries.map((l) => ({ name: l.name, mediaType: l.mediaType })),
      });
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error && err.message ? err.message : 'Could not create the community.');
      return;
    }
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }
    // Adopt-on-create: import the community theme as THIS device's personal theme
    // (explicit, device-local). A failed import never blocks the created community.
    if (adopt && themeBlob) {
      const imported = themeLib.importThemeBlob(themeBlob);
      if (imported.success && imported.id) themeLib.applyTheme(imported.id);
    }
    if (template.layout === 'library_first') {
      dispatch({ type: 'OPEN_LIBRARY_HOME', workspaceId: result.communityId });
    } else {
      dispatch({ type: 'SELECT_COMMUNITY', communityId: result.communityId, channelId: result.firstChannelId });
    }
    onClose();
  };

  return (
    <div className="mk-template-detail">
      <div className="mk-template-detail-head">
        <Button variant="ghost" small onClick={onBack}>← Templates</Button>
        <div className="mk-h2" style={{ margin: 0 }}>{template.name}</div>
      </div>
      {template.description ? (
        <p className="mk-muted" style={{ fontSize: 13, marginTop: 0 }}>{template.description}</p>
      ) : null}

      <TextField
        label="Community name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Community name"
        autoFocus
      />

      <div className="mk-template-summary">
        <div className="mk-template-summary-block">
          <span className="mk-label">Channels</span>
          <ul className="mk-template-summary-list">
            {template.chatChannels.map((c) => (
              <li key={c.id}>💬 {c.name}</li>
            ))}
          </ul>
        </div>
        {template.libraries.length > 0 ? (
          <div className="mk-template-summary-block">
            <span className="mk-label">Libraries</span>
            <ul className="mk-template-summary-list">
              {template.libraries.map((l) => (
                <li key={l.name}>{MEDIA_TYPE_META[l.mediaType].icon} {l.name}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mk-template-summary-block">
          <span className="mk-label">Opens on</span>
          <span className="mk-muted">
            {template.layout === 'library_first' ? 'Libraries (Chat one tap away)' : 'Chat'}
          </span>
        </div>
      </div>

      {hasTheme ? (
        <label className="mk-template-adopt">
          <input type="checkbox" checked={adopt} onChange={(e) => setAdopt(e.currentTarget.checked)} />
          <span>Also use this theme on this device</span>
        </label>
      ) : null}

      {error ? <div className="mk-box is-error" role="alert">{error}</div> : null}

      <Button onClick={onCreate} disabled={busy || name.trim().length === 0}>
        {busy ? 'Creating…' : 'Create community'}
      </Button>
      <HonestNotice>
        Everything is created on this device in one step. Nothing leaves this browser until you choose
        to connect with another device or server.
      </HonestNotice>
    </div>
  );
}
