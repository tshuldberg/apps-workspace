// Plan 38 Phase 5 (WEB): the library pane router. Reads the library view state
// (workspace / channel / item) and renders the "My Library" hub, one library's
// browse surface, or item detail. A community workspace routes through a theme
// boundary; the personal workspace has no community theme.

import { useView } from '../navigation/useView';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { CommunityThemeBoundary } from '../community/CommunityThemeBoundary';
import { HonestNotice } from '../shell/HonestNotice';
import { LibraryHome } from './LibraryHome';
import { LibraryView } from './LibraryView';
import { LibraryItemDetail } from './LibraryItemDetail';

export function LibraryPane(): React.ReactElement {
  const { view } = useView();
  const m = useMeerkat();
  const workspaceId = view.main.libraryWorkspaceId ?? m.personalWorkspaceId;
  const channelId = view.main.libraryChannelId ?? null;
  const itemId = view.main.libraryItemId ?? null;

  if (!workspaceId) {
    return (
      <div className="mk-main-scroll">
        <HonestNotice>The personal library is still starting up on this device.</HonestNotice>
      </div>
    );
  }

  const isCommunity = m.listCommunities().some((c) => c.communityId === workspaceId);

  let content: React.ReactElement;
  if (channelId && itemId) {
    content = <LibraryItemDetail workspaceId={workspaceId} channelId={channelId} itemId={itemId} />;
  } else if (channelId) {
    content = <LibraryView workspaceId={workspaceId} channelId={channelId} />;
  } else {
    content = <LibraryHome workspaceId={workspaceId} />;
  }

  return isCommunity ? (
    <CommunityThemeBoundary communityId={workspaceId} contents>{content}</CommunityThemeBoundary>
  ) : (
    content
  );
}
