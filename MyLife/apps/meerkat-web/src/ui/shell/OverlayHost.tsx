// OverlayHost: renders the active overlay (if any) from view state. Each slice
// registers its dialogs here. Onboarding is gated separately in App (it is a
// hard first-run gate, not a dismissable dialog), so it is not handled here.

import { useView } from '../navigation/useView';
import { CreateCommunityDialog } from '../community/CreateCommunityDialog';
import { InviteDialog } from '../community/InviteDialog';
import { AddChannelDialog } from '../community/AddChannelDialog';
import { CommunitySettings } from '../community/CommunitySettings';
import { OrganizeCommunitiesDialog } from '../community/OrganizeCommunitiesDialog';
import { AddFriendOverlay } from '../friends/AddFriendOverlay';
import { PublishSheet } from '../publish/PublishSheet';
import { SyncDialog } from '../sync/SyncDialog';
import { SettingsOverlay } from '../settings/SettingsOverlay';
import { StorageOverlay } from '../settings/StorageOverlay';
import { ShareInbox } from '../inbox/ShareInbox';
import { LockedSettingsOverlay } from '../settings/LockedSettingsOverlay';

export function OverlayHost({ unlocked = true }: { unlocked?: boolean }): React.ReactElement | null {
  const { view } = useView();
  if (!view.overlay) return null;
  if (!unlocked) {
    return view.overlay.kind === 'settings' ? <LockedSettingsOverlay /> : null;
  }
  switch (view.overlay.kind) {
    case 'create-community':
      return <CreateCommunityDialog />;
    case 'invite':
      return view.overlay.communityId ? (
        <InviteDialog communityId={view.overlay.communityId} />
      ) : null;
    case 'add-channel':
      return view.overlay.communityId ? (
        <AddChannelDialog communityId={view.overlay.communityId} />
      ) : null;
    case 'community-settings':
      return view.overlay.communityId ? (
        <CommunitySettings communityId={view.overlay.communityId} />
      ) : null;
    case 'organize-communities':
      return <OrganizeCommunitiesDialog />;
    case 'add-friend':
      return <AddFriendOverlay />;
    case 'publish':
      return view.overlay.communityId ? (
        <PublishSheet
          communityId={view.overlay.communityId}
          channelId={view.overlay.channelId}
          postId={view.overlay.postId}
        />
      ) : null;
    case 'sync':
      return <SyncDialog />;
    case 'settings':
      return <SettingsOverlay />;
    case 'storage':
      return <StorageOverlay />;
    case 'share-inbox':
      return <ShareInbox />;
    default:
      return null;
  }
}
