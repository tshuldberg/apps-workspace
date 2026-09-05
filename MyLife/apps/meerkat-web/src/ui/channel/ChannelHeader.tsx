// ChannelHeader: "# channelName" plus the community name, the real engine
// StatusPill, and a Sync button that opens the manual relay session dialog.

import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { StatusPill } from '../shell/StatusPill';

export function ChannelHeader({
  channelName,
  communityName,
  onOpenRoom,
}: {
  channelName: string;
  communityName: string;
  onOpenRoom?: () => void;
}): React.ReactElement {
  const { status } = useMeerkat();
  const { dispatch } = useView();
  return (
    <header className="mk-channel-header">
      <div className="mk-channel-header-title">
        <button
          type="button"
          className="mk-channel-back mk-narrow-only"
          aria-label="Back to channels"
          onClick={() => dispatch({ type: 'SHOW_SIDEBAR' })}
        >
          ←
        </button>
        <span className="mk-channel-hash" aria-hidden>
          #
        </span>
        <span className="mk-channel-header-name">{channelName}</span>
        <span className="mk-channel-header-sep" aria-hidden>
          ·
        </span>
        <span className="mk-channel-header-community">{communityName}</span>
      </div>
      <div className="mk-channel-header-actions">
        <StatusPill status={status} />
        {onOpenRoom ? (
          <Button variant="ghost" small onClick={onOpenRoom} aria-label="Join voice room">
            Room
          </Button>
        ) : null}
        <Button variant="ghost" small onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'sync' } })}>
          Sync
        </Button>
      </div>
    </header>
  );
}
