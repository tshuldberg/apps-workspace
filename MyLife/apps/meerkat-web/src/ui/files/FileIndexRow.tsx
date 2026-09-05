// FileIndexRow: one aggregated file in the per-community Files index. Shows the
// file name, the channel it was shared in, the signed size, and live on-device
// presence (on device vs removed), plus the Save/removed action. Presence is
// resolved live by the parent (a real has() pass); this row only renders it.

import { formatBytes } from '../format';
import { FileActions } from './FileActions';
import type { PresentFile } from '../../lib/meerkat-data';

function fileGlyph(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType.startsWith('video/')) return '🎞';
  return '📄';
}

export function FileIndexRow({
  file,
  authorName,
  communityId,
  onReport,
}: {
  file: PresentFile;
  authorName: string;
  communityId: string;
  onReport: () => void;
}): React.ReactElement {
  return (
    <li className={`mk-file-row${file.present ? '' : ' is-removed'}`}>
      <span className="mk-file-icon" aria-hidden>{fileGlyph(file.mimeType)}</span>
      <div className="mk-file-row-text">
        <div className="mk-file-row-name" title={file.name}>{file.name}</div>
        <div className="mk-file-row-meta">
          {`#${file.channelName} · by ${authorName} · ${formatBytes(file.size)} · ${file.present ? 'on device' : 'removed'}`}
        </div>
      </div>
      <FileActions file={file} communityId={communityId} onReport={onReport} />
    </li>
  );
}
