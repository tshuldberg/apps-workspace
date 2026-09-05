// Plan 32 T4.2 (web twin of mobile components/Avatar.tsx): the one place avatar
// precedence lives on web (image -> initial -> `?`). Feed cards and community
// member rows render through this so the precedence never forks. The image path
// is ALWAYS an <img src={dataUri}> off the member's OWN signed, size + JPEG-magic
// gated base64 (never dangerouslySetInnerHTML, never inline SVG markup, never a
// remote src), so a corrupt-but-in-cap image renders blank by design, never as a
// script-execution surface.

import type { CSSProperties } from 'react';

/** Wrap a stored base64 JPEG avatar as a renderable data URI (or null). */
export function avatarImageUri(imageBase64: string | null | undefined): string | null {
  if (!imageBase64) return null;
  return `data:image/jpeg;base64,${imageBase64}`;
}

export function Avatar({
  imageBase64,
  initial,
  size = 32,
  className,
}: {
  imageBase64?: string | null;
  initial?: string | null;
  size?: number;
  className?: string;
}): React.ReactElement {
  const uri = avatarImageUri(imageBase64);
  const dims: CSSProperties = { width: size, height: size };
  const classes = ['mk-user-avatar', className ?? ''].filter(Boolean).join(' ');
  if (uri) {
    return <img className={classes} src={uri} alt="" style={dims} aria-hidden />;
  }
  const label = (initial && initial.trim()) || '?';
  return (
    <span
      className={`${classes} mk-user-avatar-fallback`}
      style={{ ...dims, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {label}
    </span>
  );
}
