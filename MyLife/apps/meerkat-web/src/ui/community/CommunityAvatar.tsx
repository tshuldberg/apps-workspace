// CommunityAvatar: a rail avatar button. Shows the community's VERIFIED icon
// (Plan 38 Phase 1c) when one is set, else its initials. Active state via
// .is-active. An optional accent (owner-signed, verified) tints the active ring.
// An optional unread dot rides the corner.

import { UnreadBadge } from './UnreadBadge';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function CommunityAvatar({
  name,
  title,
  active,
  unread = 0,
  iconImage = null,
  accent = null,
  onClick,
}: {
  name: string;
  title: string;
  active: boolean;
  unread?: number;
  /** Verified owner-signed base64 JPEG icon, or null (renders initials). */
  iconImage?: string | null;
  /** Verified owner-signed accent (#rrggbb), or null. Tints the active ring. */
  accent?: string | null;
  onClick: () => void;
}): React.ReactElement {
  const classes = ['mk-avatar', active ? 'is-active' : '', iconImage ? 'has-image' : ''].filter(Boolean).join(' ');
  const style = accent && active ? ({ borderColor: accent, boxShadow: `0 0 0 2px ${accent}` } as React.CSSProperties) : undefined;
  return (
    <button type="button" className={classes} title={title} onClick={onClick} style={style}>
      {iconImage ? (
        <img className="mk-avatar-img" src={`data:image/jpeg;base64,${iconImage}`} alt="" aria-hidden />
      ) : (
        initialsFor(name)
      )}
      {unread > 0 && (
        <span className="mk-rail-dot" aria-hidden>
          <UnreadBadge count={unread} />
        </span>
      )}
    </button>
  );
}
