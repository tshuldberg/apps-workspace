// Community home: verified owner composition, or an explicit built-in local
// default. Local defaults cannot grant owner capabilities. Legacy owner homes
// route back to their chat/library surface; channels and settings stay outside
// the block stack.

import { useEffect, useMemo } from 'react';
import { communityLayout } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { openCommunityAction } from '../navigation/view-state';
import { useView } from '../navigation/useView';
import { useDeviceLayout, browserLayoutClass } from '../onboarding/useDeviceLayout';
import { deviceHomeLayout } from '../../lib/device-layout-core';
import { resolveActiveLayout } from '../../lib/community-layout-core';
import { listCommunityLayoutEvents } from '../../lib/meerkat-data';
import { buildBlockQueries } from '../../lib/block-queries';
import { BlockStack } from '../blocks/BlockStack';
import type { BlockHostContext } from '../blocks/registry';
import { HonestNotice } from '../shell/HonestNotice';

export function CommunityHomeView({ communityId }: { communityId: string }): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const deviceLayout = useDeviceLayout(m.db);

  const community = useMemo(
    () => m.listCommunities().find((c) => c.communityId === communityId) ?? null,
    [m, communityId],
  );

  const active = useMemo(() => {
    if (!community) return null;
    return resolveActiveLayout({
      events: listCommunityLayoutEvents(m.db, communityId),
      ownerDeviceId: community.descriptor.ownerDeviceId,
      legacyLayout: communityLayout(community.descriptor),
    });
  }, [m.db, community, communityId]);

  const ctx = useMemo<BlockHostContext | null>(() => {
    if (!community) return null;
    return {
      communityId,
      communityName: community.descriptor.name,
      channels: community.descriptor.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        kind: channel.kind ?? 'chat',
      })),
      queries: buildBlockQueries(m.db, community.descriptor),
      onOpenChannel: (channelId) =>
        dispatch({ type: 'OPEN_CHANNEL', communityId, channelId }),
      onOpenFiles: () => dispatch({ type: 'OPEN_FILES', communityId }),
      revision: 0,
    };
  }, [m.db, community, communityId, dispatch]);

  useEffect(() => {
    if (community && deviceLayout.choice === 'community' && active?.source === 'legacy') {
      dispatch(openCommunityAction(community.descriptor));
    }
  }, [community, deviceLayout.choice, active, dispatch]);

  if (!community) {
    return (
      <div className="mk-home-scroll">
        <HonestNotice>This community is not on this device.</HonestNotice>
      </div>
    );
  }

  const localHome = deviceHomeLayout(m.db, browserLayoutClass(), community.descriptor.name, community.descriptor.channels.find((channel) => !channel.kind || channel.kind === 'chat')?.id, active?.source === 'layout_document' ? active.document.capabilities : []);
  const document = localHome ?? (active?.source === 'layout_document' ? active.document : null);
  if (!document || !ctx) {
    return (
      <div className="mk-home-scroll">
        <HonestNotice>
          This community has no composed home on this device yet. Pick a channel from the sidebar.
        </HonestNotice>
      </div>
    );
  }

  return (
    <div className="mk-home-scroll">
      {localHome && <HonestNotice>Using your device default. Change it in Settings → Appearance, or choose Use community layout to follow the owner.</HonestNotice>}
      <BlockStack
        nodes={document.home}
        declaredCapabilities={document.capabilities}
        ctx={ctx}
      />
    </div>
  );
}
