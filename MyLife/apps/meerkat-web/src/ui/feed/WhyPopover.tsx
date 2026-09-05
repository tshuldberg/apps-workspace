// Plan 32 T4.1 (web twin of mobile components/feed/WhySheet.tsx, design decision
// 2): the "Why am I seeing this?" popover. The explainability that used to sit on
// every card (kind, audience, reason) moves here, one tap behind the context-line
// info button. Nothing about the ranking becomes less inspectable: the REAL
// feed-core reason string, the item kind, its audience rule line, and the exact
// source toggle that controls it all render here, with a jump to the filter panel.
// No new claims, no fabricated data.

import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { AudienceRuleSummary } from '../audience/AudienceRule';
import {
  FEED_CONTROL_LABELS,
  type FeedControls,
  type FeedItem,
} from '../../lib/feed-core';
import { FEED_KIND_CONTROL, FEED_KIND_LABEL } from './feed-view-core';

export function WhyPopover({
  item,
  controls,
  onClose,
  onOpenFilters,
}: {
  /** The item being explained, or null when the popover is closed. */
  item: FeedItem | null;
  controls: FeedControls;
  onClose: () => void;
  onOpenFilters: () => void;
}): React.ReactElement | null {
  if (!item) return null;
  const controlKey = FEED_KIND_CONTROL[item.kind];
  const controlOn = controls[controlKey];

  return (
    <Modal title="Why am I seeing this?" onClose={onClose}>
      <div className="mk-why">
        <p className="mk-why-reason">{item.reason}</p>

        <div className="mk-why-meta">
          <span className="mk-why-label">Kind</span>
          <span className="mk-feed-kind">{FEED_KIND_LABEL[item.kind]}</span>
        </div>

        <AudienceRuleSummary rule={item.audienceRule} />

        <div className="mk-why-source">
          <span className="mk-why-label">Controlled by the source toggle</span>
          <span className="mk-why-source-value">
            {FEED_CONTROL_LABELS[controlKey]} is {controlOn ? 'on' : 'off'}.
          </span>
        </div>

        <Button variant="ghost" small onClick={onOpenFilters}>
          Open feed filters
        </Button>
      </div>
    </Modal>
  );
}
