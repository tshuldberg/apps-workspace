// Plan 30 Phase 4 (web twin of the mobile ChannelSegmentedTabs): a two-segment
// Chat | Posts control under the channel header. Accent underline on the active
// segment, tablist semantics. Props-only; the caller owns the value.

export type ChannelSegment = 'chat' | 'posts';

export function ChannelSegmentedTabs({
  value,
  onChange,
  chatLabel = 'Chat',
  postsLabel = 'Posts',
}: {
  value: ChannelSegment;
  onChange: (segment: ChannelSegment) => void;
  /** Optional relabels (library channels: Library | Chat; block channels: <name> | Chat). */
  chatLabel?: string;
  postsLabel?: string;
}): React.ReactElement {
  return (
    <div className="mk-channel-segments" role="tablist" aria-label="Channel views">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'chat'}
        className={`mk-channel-segment ${value === 'chat' ? 'is-active' : ''}`}
        onClick={() => onChange('chat')}
      >
        {chatLabel}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'posts'}
        className={`mk-channel-segment ${value === 'posts' ? 'is-active' : ''}`}
        onClick={() => onChange('posts')}
      >
        {postsLabel}
      </button>
    </div>
  );
}
