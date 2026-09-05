// Explore (Plan 39 P10/P11, screen S10). WEB twin: Discover, re-homed inside the
// Public tab. Browse the Commons topics (each opens its topic channel) and the
// public communities directory. Hosted-by-Meerkat surfaces are verified-members
// only; owner-hosted feeds may be reachable outside Meerkat, and the honesty note
// says so (NC-P4). The existing Discover directory stays functional and is reached
// from here.

import { PUBLIC_FEED_TOPICS } from '../../lib/public-feed';
import { HonestNotice } from '../shell/HonestNotice';

// Verbatim Explore copy (mockup S10), parity-locked against the native twin.
export const EXPLORE_TITLE = 'Explore';
export const EXPLORE_TOPICS_TITLE = 'Commons topics';
export const EXPLORE_COMMUNITIES_TITLE = 'Public communities';
export const EXPLORE_COMMUNITIES_CTA = 'Browse public communities';
export const EXPLORE_HONESTY_NOTE = 'Community feeds hosted by their owners may be reachable outside Meerkat. The Commons and everything marked "hosted by Meerkat" is verified-members only.';

export function PublicExploreView({
  onBack,
  onOpenTopic,
  onBrowseCommunities,
}: {
  onBack: () => void;
  onOpenTopic: (channelId: string) => void;
  onBrowseCommunities: () => void;
}): React.ReactElement {
  return (
    <section className="mk-main-scroll" style={{ padding: 'var(--mk-space-md)', display: 'flex', flexDirection: 'column', gap: 'var(--mk-space-sm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="mk-chip" onClick={onBack}>‹ Back</button>
        <h2 className="mk-view-title" style={{ margin: 0 }}>{EXPLORE_TITLE}</h2>
      </div>

      <div className="mk-settings-section-title">{EXPLORE_TOPICS_TITLE}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {PUBLIC_FEED_TOPICS.map((t) => (
          <button key={t.channelId} type="button" className="mk-chip" onClick={() => onOpenTopic(t.channelId)}>{t.emoji} {t.title}</button>
        ))}
      </div>

      <div className="mk-settings-section-title">{EXPLORE_COMMUNITIES_TITLE}</div>
      <button
        type="button"
        className="mk-box"
        onClick={onBrowseCommunities}
        style={{ display: 'flex', alignItems: 'center', textAlign: 'left', cursor: 'pointer', width: '100%' }}
      >
        <span style={{ flex: 1, fontWeight: 600 }}>{EXPLORE_COMMUNITIES_CTA}</span>
        <span className="mk-muted" style={{ fontSize: 20 }}>›</span>
      </button>

      <HonestNotice>{EXPLORE_HONESTY_NOTE}</HonestNotice>
    </section>
  );
}
