// PublicDirectorySection (Plan 19 P6, web): configure the public directory host
// the Discover pane + Feed public source probe against. Persisted device-local in
// mk_settings under PUBLIC_DIRECTORY_URL_SETTING via the shared getSetting/setSetting
// helpers. Empty by default, so Discover shows its honest Error state and the Feed
// Public control stays hidden until a real directory is configured (TC-5).

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { PUBLIC_DIRECTORY_URL_SETTING, getSetting, setSetting } from '../../lib/meerkat-data';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

export function PublicDirectorySection(): React.ReactElement {
  const m = useMeerkat();
  const [value, setValue] = useState<string>(() => getSetting(m.db, PUBLIC_DIRECTORY_URL_SETTING) ?? '');
  const [saved, setSaved] = useState(false);

  const save = (): void => {
    setSetting(m.db, PUBLIC_DIRECTORY_URL_SETTING, value.trim());
    setSaved(true);
    // Re-render Discover + Feed so a freshly set/cleared URL re-probes.
    m.refresh();
  };

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Public directory</h3>
      <div className="mk-settings-field">
        <input
          className="mk-input"
          type="url"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="wss://your-directory.example"
          aria-label="Public directory URL"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button small onClick={save} disabled={saved}>
          {saved ? 'Saved' : 'Save'}
        </Button>
      </div>
      <HonestNotice>
        Set the connection server that runs a public directory to browse and read public communities.
        Leave it empty to keep Discover and the Feed Public control hidden; nothing public is reachable
        without a real directory host.
      </HonestNotice>
    </section>
  );
}
