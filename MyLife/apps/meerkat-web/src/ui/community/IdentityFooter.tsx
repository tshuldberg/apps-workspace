// IdentityFooter: the device name + short fingerprint at the bottom of the
// channel sidebar, plus a gear that opens Settings (slice 5).

import { NavigationIcon } from '../shell/NavigationIcon';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';

export function IdentityFooter(): React.ReactElement {
  const { displayName, fingerprint } = useMeerkat();
  const { dispatch } = useView();
  return (
    <div className="mk-identity-footer">
      <div>
        <div className="mk-name">{displayName}</div>
        <div className="mk-mono">{fingerprint}</div>
      </div>
      <button
        className="mk-gear"
        aria-label="Settings"
        title="Settings"
        onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}
      >
        <NavigationIcon name="settings" />
      </button>
    </div>
  );
}
