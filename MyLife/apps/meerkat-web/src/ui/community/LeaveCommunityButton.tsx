// LeaveCommunityButton: a danger button that confirms, then leaves the community
// locally (removes the stored descriptor + this device's membership row). After
// leaving it selects another community if one remains, else clears the view.

import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';

export function LeaveCommunityButton({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const onLeave = (): void => {
    if (!window.confirm('Leave this community? It is removed from this device. You can rejoin from a fresh invite link.')) {
      return;
    }
    m.leaveCommunity(communityId);
    const remaining = m.listCommunities().filter((c) => c.communityId !== communityId);
    const next = remaining[0];
    // Close the settings overlay if this button is rendered inside it (a no-op
    // when it is rendered anywhere else, since there is no overlay open).
    dispatch({ type: 'CLOSE_OVERLAY' });
    if (next) {
      dispatch({
        type: 'SELECT_COMMUNITY',
        communityId: next.communityId,
        channelId: next.descriptor.channels[0]?.id ?? null,
      });
    } else {
      dispatch({ type: 'SELECT_COMMUNITY', communityId: '', channelId: null });
    }
  };
  return (
    <Button variant="danger" small onClick={onLeave}>
      Leave
    </Button>
  );
}
