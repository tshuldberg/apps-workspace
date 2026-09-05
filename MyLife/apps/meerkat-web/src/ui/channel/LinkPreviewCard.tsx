// Plan 32 T3.3 (web twin): receiver-passive link preview card (Signal model).
//
// NC-2 (the Signal rule): this component NEVER fetches anything. It imports no
// fetch/network primitive. Its bytes come ONLY from the hash-verified attachment
// blob already stored in this browser (m.getBlob), decoded with the pure
// parseLinkPreviewAttachment (the web twin of the mobile module). The image is a
// data: URI built from the preview's OWN base64 (which rode the verified blob
// pipeline), NEVER a remote <img src={preview.url}>. A malformed/oversized/
// unparseable blob degrades to the plain file card (InChannelFileCard).
//
// Tapping the card confirms with the FULL url before window.open hands off, so a
// receiver always sees where a click will go. Mirrors the native
// apps/meerkat/app/(root)/components/LinkPreviewCard.tsx.

import { useEffect, useMemo, useState } from 'react';
import { type ChannelMessageAttachment } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { parseLinkPreviewAttachment, type LinkPreview } from '../../lib/link-preview';

/** True when an attachment is a link-preview payload (not a normal file). */
export function isLinkPreviewAttachment(attachment: ChannelMessageAttachment): boolean {
  return attachment.mimeType === 'application/x-meerkat-link-preview+json';
}

/** Best-effort host label for the confirm sheet + card domain line. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export function LinkPreviewCard({
  blobHash,
  fallback = null,
}: {
  blobHash: string;
  /** Rendered when the blob is missing/malformed. Chat passes the file card; the
   *  feed passes nothing (null), so a bad preview renders no extra card. */
  fallback?: React.ReactNode;
}): React.ReactElement | null {
  const m = useMeerkat();
  const revision = m.revision;

  // null => still reading the local blob; then a parsed preview or false (bad).
  const [preview, setPreview] = useState<LinkPreview | null | false>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    void (async () => {
      // Bytes come ONLY from the verified local blob, never a network call.
      const bytes = await m.getBlob(blobHash);
      if (cancelled) return;
      if (!bytes) {
        setPreview(false);
        return;
      }
      const parsed = parseLinkPreviewAttachment(bytes);
      if (!cancelled) setPreview(parsed ?? false);
    })();
    return () => {
      cancelled = true;
    };
  }, [m, blobHash, revision]);

  const imageUri = useMemo(
    () => (preview && preview.imageBase64 ? `data:image/jpeg;base64,${preview.imageBase64}` : null),
    [preview],
  );

  // Not yet resolved: render nothing (the message body still shows the URL text).
  if (preview === null) return null;

  // Unknown / malformed / missing blob: degrade to the caller's fallback (the chat
  // file card) or nothing (the feed). Either way it never fetches.
  if (preview === false) {
    return <>{fallback}</>;
  }

  const confirmOpen = () => {
    const url = preview.url;
    if (window.confirm(`Open this link?\n\n${url}`)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <button type="button" className="mk-link-card" onClick={confirmOpen} aria-label={`Open link: ${preview.title}`}>
      {imageUri ? (
        <img className="mk-link-card-image" src={imageUri} alt="" />
      ) : null}
      <span className="mk-link-card-body">
        <span className="mk-link-card-domain">{hostOf(preview.url)}</span>
        <span className="mk-link-card-title">{preview.title}</span>
        {preview.description ? (
          <span className="mk-link-card-desc">{preview.description}</span>
        ) : null}
      </span>
    </button>
  );
}
