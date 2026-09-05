// Plan 32 T4.1 (web twin of mobile components/feed/FeedFilterSheet.tsx, design
// decision 3): the feed filter panel. The source toggles that used to sit inline
// on the feed move here, together with the relocated "Not in this feed yet"
// excluded-sources list and the honesty note that used to be a standing paragraph.
// getVisibleFeedControls (including the TC-5 public-probe gating) is unchanged:
// 'public' only appears when a real public source responded. A link jumps to
// Settings (Connection status + What works today) for the full connection picture.

import { Modal } from '../shell/Modal';
import {
  FEED_CONTROL_LABELS,
  getVisibleFeedControls,
  type FeedControlKey,
  type FeedControls,
} from '../../lib/feed-core';

export function FeedFilterPanel({
  open,
  controls,
  publicSourcesAvailable,
  excludedSources,
  onToggle,
  onClose,
  onOpenStatus,
}: {
  open: boolean;
  controls: FeedControls;
  publicSourcesAvailable: boolean;
  excludedSources: readonly string[];
  onToggle: (key: FeedControlKey) => void;
  onClose: () => void;
  onOpenStatus: () => void;
}): React.ReactElement | null {
  if (!open) return null;
  const visibleControls = getVisibleFeedControls(publicSourcesAvailable);

  return (
    <Modal title="Feed filters" onClose={onClose}>
      <div className="mk-feed-filters">
        <h3 className="mk-feed-filters-title">Sources</h3>
        <p className="mk-muted mk-feed-filters-hint">Changes apply immediately.</p>
        <div className="mk-feed-controls" aria-label="Feed sources">
          {visibleControls.map((key) => (
            <button
              key={key}
              type="button"
              className={`mk-feed-toggle ${controls[key] ? 'is-active' : ''}`}
              role="switch"
              aria-checked={controls[key]}
              aria-label={`${FEED_CONTROL_LABELS[key]} source`}
              onClick={() => onToggle(key)}
            >
              {FEED_CONTROL_LABELS[key]}
            </button>
          ))}
        </div>

        <h3 className="mk-feed-filters-title mk-feed-filters-spacer">Not in this feed yet</h3>
        {excludedSources.map((source) => (
          <p key={source} className="mk-feed-filters-excluded">{source}</p>
        ))}

        <button type="button" className="mk-feed-filters-status" onClick={onOpenStatus}>
          See connection status and capabilities ›
        </button>
      </div>
    </Modal>
  );
}
