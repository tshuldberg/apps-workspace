import './device-layout.css';
import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { ONBOARDING_EXPERIENCES, findOnboardingExperience } from '../../lib/onboarding-experience-core';
import { setDeviceLayoutDefault, setLayoutDeviceClass, type DeviceLayoutChoice, type LayoutDeviceClass } from '../../lib/device-layout-core';
import { useDeviceLayout } from '../onboarding/useDeviceLayout';

export function DeviceLayoutSection(): React.ReactElement {
  const m = useMeerkat();
  const { profile, choice } = useDeviceLayout(m.db);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const save = (change: () => void) => {
    setBusy(true);
    setNotice('');
    void (async () => {
      try { change(); await m.db.flush(); setNotice('Device layout saved. Open a community to use it.'); }
      catch { setNotice('Could not save the device layout. Try again before closing this tab.'); }
      finally { setBusy(false); }
    })();
  };
  const experience = findOnboardingExperience(choice);
  return <section className="mk-settings-section mk-device-layout">
    <h3>Default layout on this device</h3>
    <p className="mk-muted">Choose how community homes open here. Desktop and mobile keep separate defaults on this device. These settings do not sync or change anyone else’s layout.</p>
    <label className="mk-label">Use settings for
      <select aria-label="Layout device profile" value={profile} disabled={busy} onChange={(event) => save(() => setLayoutDeviceClass(m.db, event.target.value as LayoutDeviceClass))}>
        <option value="desktop">Desktop</option><option value="mobile">Mobile</option>
      </select>
    </label>
    <label className="mk-label">Default community home
      <select aria-label="Default community home" value={choice} disabled={busy} onChange={(event) => save(() => setDeviceLayoutDefault(m.db, profile, event.target.value as DeviceLayoutChoice))}>
        <option value="community">Use community layout</option>
        {ONBOARDING_EXPERIENCES.map((item) => <option key={item.id} value={item.id}>{item.name}{item.ready ? '' : ' (media unfinished)'}</option>)}
      </select>
    </label>
    {experience && <p className="mk-muted">{experience.description}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
