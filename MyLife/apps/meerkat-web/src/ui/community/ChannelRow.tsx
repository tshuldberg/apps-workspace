// ChannelRow: a "# name" row in the channel sidebar. Active highlight when it is
// the selected channel; optional unread badge on the right (always 0 in slice 2).

import { UnreadBadge } from './UnreadBadge';

export function ChannelRow({
  name,
  active,
  unread = 0,
  onClick,
}: {
  name: string;
  active: boolean;
  unread?: number;
  onClick: () => void;
}): React.ReactElement {
  const classes = ['mk-channel-row', active ? 'is-active' : ''].filter(Boolean).join(' ');
  return (
    <button type="button" className={classes} onClick={onClick}>
      <span className="mk-channel-hash" aria-hidden>
        #
      </span>
      <span className="mk-channel-name">{name}</span>
      <UnreadBadge count={unread} />
    </button>
  );
}
