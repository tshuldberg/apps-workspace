import { InvitationResume } from './community/InvitationResume';
// Meerkat web shell. View-state reducer (no router); 3-pane Discord layout; a
// first-run onboarding gate. Slice 2 adds the community rail, channel sidebar,
// and a working channel view; files/settings fill later slices. Honesty: status
// comes only from the real engine; web is relay-only; descriptors do not sync.

import { lazy, Suspense, useCallback, useEffect, useReducer, useState } from 'react';
import { HonestNotice } from './shell/HonestNotice';
import { useMeerkat } from '../lib/MeerkatProvider';
import { ViewContext } from './navigation/useView';
import { useView } from './navigation/useView';
import { INITIAL_VIEW, viewReducer } from './navigation/view-state';
import { AppShell } from './shell/AppShell';
import { MobilePrimaryNav } from './shell/MobilePrimaryNav';
import { useKeyboardShortcuts } from './shell/useKeyboardShortcuts';
import { OverlayHost } from './shell/OverlayHost';
import { StatusPill } from './shell/StatusPill';
import { OnboardingOverlay } from './onboarding/OnboardingOverlay';
import { AgeGateOverlay } from './onboarding/AgeGateOverlay';
import { isAgeGatePassed } from '../lib/age-gate';
import { CallOverlay } from './call/CallOverlay';
import { IdentityCard } from './onboarding/IdentityCard';
import { CommunityRail } from './community/CommunityRail';
import { ChannelSidebar } from './community/ChannelSidebar';
import { CommunityThemeBoundary } from './community/CommunityThemeBoundary';
import {
  hasPendingWebShare,
  registerWebShareTarget,
} from '../lib/web-share-target';
import { hasPendingPushWake, WEB_PUSH_WAKE_MESSAGE } from '../lib/web-push-sw-core';
import { rotateWebPushSubscription } from '../lib/web-push-registration';
import { webActionRequiresAppUnlock, webPaneRequiresAppUnlock } from '../lib/app-access-policy';
import type { ViewAction } from './navigation/view-state';
import { Button } from './shell/Button';

const ChannelView = lazy(() => import('./channel/ChannelView').then((module) => ({ default: module.ChannelView })));
const FilesView = lazy(() => import('./files/FilesView').then((module) => ({ default: module.FilesView })));
const DownloadsView = lazy(() => import('./files/DownloadsView').then((module) => ({ default: module.DownloadsView })));
const FeedView = lazy(() => import('./feed/FeedView').then((module) => ({ default: module.FeedView })));
const DiscoverView = lazy(() => import('./discover/DiscoverView').then((module) => ({ default: module.DiscoverView })));
const PublicView = lazy(() => import('./public/PublicView').then((module) => ({ default: module.PublicView })));
const MessagesView = lazy(() => import('./messages/MessagesView').then((module) => ({ default: module.MessagesView })));
const LibraryPane = lazy(() => import('./library/LibraryPane').then((module) => ({ default: module.LibraryPane })));
const CommunityHomeView = lazy(() => import('./community/CommunityHomeView').then((module) => ({ default: module.CommunityHomeView })));
const MemberProfileView = lazy(() => import('./community/MemberProfileView').then((module) => ({ default: module.MemberProfileView })));
const PagesView = lazy(() => import('./canvas/PagesView').then((module) => ({ default: module.PagesView })));
const CommunityPageView = lazy(() => import('./canvas/PagesView').then((module) => ({ default: module.CommunityPageView })));

export function App(): React.ReactElement {
  const [view, dispatch] = useReducer(viewReducer, INITIAL_VIEW);
  const m = useMeerkat();
  const [agePassed, setAgePassed] = useState(() => isAgeGatePassed(m.db));
  const { onboardingComplete, lastCommunityId, lastChannelId, rememberLocation } = m;
  // The validated unlock machine lives in MeerkatProvider (single source of
  // truth for the shell AND settings, so the two can never contradict each
  // other). 'cannot_verify' stays locked (fail-closed) but renders honestly.
  const unlocked = m.appUnlock.status === 'unlocked';

  const guardedDispatch = useCallback((action: ViewAction): void => {
    if (unlocked || !webActionRequiresAppUnlock(action)) {
      dispatch(action);
      return;
    }
    dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } });
  }, [unlocked]);

  // Register the optional Web Share Target service worker (no-op when the browser
  // cannot host it), and open the Share Inbox when the OS shared INTO the PWA.
  useEffect(() => {
    void registerWebShareTarget();
    if (hasPendingWebShare()) {
      guardedDispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'share-inbox' } });
    }
  }, [guardedDispatch]);

  // Web Push drain-on-open (Plan 42 P6). A push to a CLOSED page can only show a
  // notification and queue a drain; the real mailbox drain runs HERE, in the page,
  // when the app opens with ?push-wake=1, or when the service worker posts a wake
  // message to this open client. The SW never mutates the DB itself (AC-42.10). A
  // pushsubscriptionchange wake also re-registers the rotated subscription.
  useEffect(() => {
    if (hasPendingPushWake()) {
      void m.runForegroundDrain().catch(() => undefined);
    }
    const nav = navigator as unknown as {
      serviceWorker?: {
        addEventListener?: (t: string, l: (e: MessageEvent) => void) => void;
        removeEventListener?: (t: string, l: (e: MessageEvent) => void) => void;
      };
    };
    const sw = nav.serviceWorker;
    if (!sw?.addEventListener) return;
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { type?: string; reason?: string } | undefined;
      if (data?.type !== WEB_PUSH_WAKE_MESSAGE) return;
      void m.runForegroundDrain().catch(() => undefined);
      if (data.reason === 'subscriptionchange') {
        void rotateWebPushSubscription(m.db).catch(() => undefined);
      }
    };
    sw.addEventListener('message', onMessage);
    return () => sw.removeEventListener?.('message', onMessage);
  }, [m]);

  // Restore the last viewed community/channel once, if it still exists. Runs
  // only while nothing is selected so it never fights a user selection.
  useEffect(() => {
    if (view.main.pane !== 'channel' && view.main.pane !== 'files') return;
    if (view.main.communityId || !lastCommunityId) return;
    const community = m.listCommunities().find((c) => c.communityId === lastCommunityId);
    if (!community) return;
    const channelId =
      lastChannelId && community.descriptor.channels.some((c) => c.id === lastChannelId)
        ? lastChannelId
        : community.descriptor.channels[0]?.id ?? null;
    guardedDispatch({ type: 'SELECT_COMMUNITY', communityId: lastCommunityId, channelId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardedDispatch, lastCommunityId, lastChannelId]);

  // Persist the current location whenever it changes.
  useEffect(() => {
    if (view.main.pane !== 'channel' && view.main.pane !== 'files') return;
    rememberLocation(view.main.communityId || null, view.main.channelId || null);
  }, [view.main.communityId, view.main.channelId, view.main.pane, rememberLocation]);

  // Global keyboard shortcuts (Cmd/Ctrl+, , Alt+Arrow channel switch, Cmd/Ctrl+K).
  useKeyboardShortcuts(view, guardedDispatch);

  const community = view.main.communityId
    ? m.listCommunities().find((c) => c.communityId === view.main.communityId) ?? null
    : null;
  const showFeed = view.main.pane === 'feed';
  const showPublic = view.main.pane === 'public';
  const showDiscover = view.main.pane === 'discover';
  const showMessages = view.main.pane === 'messages';
  const showLibrary = view.main.pane === 'library';
  const showDownloads = view.main.pane === 'downloads';
  const showFiles = Boolean(community && view.main.pane === 'files');
  const showChannel = Boolean(community && view.main.channelId && view.main.pane === 'channel');
  const showHome = Boolean(community && view.main.pane === 'home');
  const showPages = Boolean(community && view.main.pane === 'pages');
  const showCanvasPage = Boolean(community && view.main.canvasId && view.main.pane === 'canvas-page');
  const showMemberProfile = Boolean(community && view.main.memberDeviceId && view.main.pane === 'member-profile');
  const privatePaneLocked = !unlocked && webPaneRequiresAppUnlock(view.main.pane);
  // Narrow viewport: the main pane is foregrounded only when something is open.
  const activePane: 'sidebar' | 'main' =
    showFeed || showPublic || showDiscover || showMessages || showLibrary || showDownloads || showFiles || showChannel || showHome || showPages || showCanvasPage || showMemberProfile ? 'main' : 'sidebar';

  return (
    <ViewContext.Provider value={{ view, dispatch: guardedDispatch }}>
      <AppShell
        activePane={activePane}
        rail={unlocked ? <CommunityRail /> : <FreeRail />}
        sidebar={unlocked ? <ChannelSidebar /> : null}
        mobileNav={unlocked ? <MobilePrimaryNav /> : <FreeMobileNav />}
        main={<Suspense fallback={<div className="mk-main-scroll"><div className="mk-welcome">Loading…</div></div>}>
          {
          privatePaneLocked ? (
            <UnlockRequired />
          ) : showFeed ? (
            <FeedView />
          ) : showPublic ? (
            <PublicView />
          ) : showDiscover ? (
            <DiscoverView />
          ) : showMessages ? (
            <MessagesView />
          ) : showLibrary ? (
            <LibraryPane />
          ) : showDownloads ? (
            <DownloadsView />
          ) : showFiles ? (
            <CommunityThemeBoundary communityId={view.main.communityId as string} contents>
              <FilesView communityId={view.main.communityId as string} />
            </CommunityThemeBoundary>
          ) : showHome ? (
            <CommunityThemeBoundary communityId={view.main.communityId as string} contents>
              <CommunityHomeView communityId={view.main.communityId as string} />
            </CommunityThemeBoundary>
          ) : showPages ? (
            <CommunityThemeBoundary communityId={view.main.communityId as string} contents>
              <PagesView communityId={view.main.communityId as string} />
            </CommunityThemeBoundary>
          ) : showCanvasPage ? (
            <CommunityThemeBoundary communityId={view.main.communityId as string} contents>
              <CommunityPageView communityId={view.main.communityId as string} canvasId={view.main.canvasId as string} />
            </CommunityThemeBoundary>
          ) : showMemberProfile ? (
            <CommunityThemeBoundary communityId={view.main.communityId as string} contents>
              <MemberProfileView communityId={view.main.communityId as string} memberDeviceId={view.main.memberDeviceId as string} />
            </CommunityThemeBoundary>
          ) : showChannel ? (
            <CommunityThemeBoundary communityId={view.main.communityId as string} channelId={view.main.channelId} contents>
              <ChannelView
                communityId={view.main.communityId as string}
                channelId={view.main.channelId as string}
                postId={view.main.postId}
                onPostBack={() =>
                  guardedDispatch({
                    type: 'OPEN_CHANNEL',
                    communityId: view.main.communityId as string,
                    channelId: view.main.channelId as string,
                  })
                }
              />
            </CommunityThemeBoundary>
          ) : (
            <WelcomeArea />
          )
          }
        </Suspense>}
      />
      <InvitationResume ready={agePassed && unlocked && onboardingComplete && !view.overlay} />
      <OverlayHost unlocked={unlocked} />
      {unlocked ? <CallOverlay /> : null}
      {/* The neutral age gate mounts first; onboarding mounts only after it
          passes, so the two overlays never co-present. */}
      {!agePassed && <AgeGateOverlay onPassed={() => setAgePassed(true)} />}
      {agePassed && !onboardingComplete && <OnboardingOverlay unlocked={unlocked} />}
    </ViewContext.Provider>
  );
}

function UnlockRequired(): React.ReactElement {
  const { dispatch } = useView();
  const { appUnlock } = useMeerkat();
  if (appUnlock.status === 'checking') {
    return (
      <div className="mk-main-scroll">
        <div className="mk-welcome">
          <h1 className="mk-h1">Checking your purchase…</h1>
          <p className="mk-muted">Verifying the saved unlock with the connection server.</p>
        </div>
      </div>
    );
  }
  if (appUnlock.status === 'cannot_verify') {
    return (
      <div className="mk-main-scroll">
        <div className="mk-welcome">
          <h1 className="mk-h1">Purchase could not be verified</h1>
          {appUnlock.detail ? <HonestNotice>{appUnlock.detail}</HonestNotice> : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={() => appUnlock.revalidate()}>Try again</Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}>
              Open settings
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mk-main-scroll">
      <div className="mk-welcome">
        <h1 className="mk-h1">Unlock private Meerkat</h1>
        <p className="mk-muted">
          Public browsing is free. Private feeds, messages, communities, files, libraries, sync,
          and self-hosting require the one-time app unlock.
        </p>
        <Button onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}>
          Buy or restore unlock
        </Button>
      </div>
    </div>
  );
}

function FreeRail(): React.ReactElement {
  const { dispatch } = useView();
  return (
    <div style={{ display: 'grid', gap: 8, padding: 8 }}>
      <Button small onClick={() => dispatch({ type: 'OPEN_PUBLIC' })}>Public</Button>
      <Button small variant="ghost" onClick={() => dispatch({ type: 'OPEN_DISCOVER' })}>Discover</Button>
      <Button small variant="ghost" onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}>Unlock</Button>
    </div>
  );
}

function FreeMobileNav(): React.ReactElement {
  const { dispatch } = useView();
  return (
    <div className="mk-mobile-primary-nav-inner">
      <Button small variant="ghost" onClick={() => dispatch({ type: 'OPEN_PUBLIC' })}>Public</Button>
      <Button small variant="ghost" onClick={() => dispatch({ type: 'OPEN_DISCOVER' })}>Discover</Button>
      <Button small variant="ghost" onClick={() => dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })}>Unlock</Button>
    </div>
  );
}

function WelcomeArea(): React.ReactElement {
  const { displayName, status } = useMeerkat();
  return (
    <div className="mk-main-scroll">
      <div className="mk-welcome">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <h1 className="mk-h1" style={{ margin: 0 }}>
            Welcome, {displayName}
          </h1>
          <StatusPill status={status} />
        </div>
        <p className="mk-muted">
          Meerkat is private social space for communities, messages, and files. This browser keeps
          your identity here, shows only real saved activity, and connects only when you choose to
          connect.
        </p>
        <IdentityCard />
      </div>
    </div>
  );
}
