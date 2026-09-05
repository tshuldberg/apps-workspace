// Plan 32 T4.1 (web twin of mobile components/feed/FeedMediaImage.tsx): inline
// first-image media on a feed card. The bytes come ONLY from the LOCAL,
// hash-verified blob store (m.blobPreviewDataUri), which returns null when this
// device does not hold them yet, so nothing renders (no fabricated placeholder, no
// fetch). feed-core.firstImageMedia already restricts media to image/* mimes; the
// data: URI is rendered ONLY via <img src>, never dangerouslySetInnerHTML and
// never an inline SVG element built from blob bytes, so an image/svg+xml blob is
// treated as a passive raster (browsers do not run scripts in an <img>-loaded SVG).

import { useEffect, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';

export function FeedMediaImage({
  media,
  onOpen,
  alt,
}: {
  media: { blobHash: string; mimeType: string };
  onOpen: () => void;
  alt: string;
}): React.ReactElement | null {
  const m = useMeerkat();
  const revision = m.revision;
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUri(null);
    void (async () => {
      const dataUri = await m.blobPreviewDataUri(media.blobHash, media.mimeType);
      if (!cancelled) setUri(dataUri);
    })();
    return () => {
      cancelled = true;
    };
  }, [m, media.blobHash, media.mimeType, revision]);

  // No local bytes -> render nothing. The body + engagement row still describe the
  // post honestly; we never claim an image is present when it is not on device.
  if (!uri) return null;

  return (
    <button type="button" className="mk-feed-media" onClick={onOpen} aria-label={alt}>
      {/* Local, hash-verified image bytes only, rendered as a passive raster. */}
      <img className="mk-feed-media-img" src={uri} alt="" aria-hidden />
    </button>
  );
}
