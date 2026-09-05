// UnreadBadge: a small pill showing an unread count (1..99, then 99+). Renders
// null when count <= 0. Slice 2 always passes 0 (real per-channel unread counts
// arrive in slice 3); the component is built now so wiring is additive.

export function UnreadBadge({ count }: { count: number }): React.ReactElement | null {
  if (count <= 0) return null;
  return <span className="mk-unread">{count > 99 ? '99+' : count}</span>;
}
