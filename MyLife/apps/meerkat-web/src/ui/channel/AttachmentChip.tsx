// AttachmentChip: a file the user picked in the composer but has not sent yet.
// Shows the name + size with a remove-before-send control. No bytes are sealed
// until the message is sent (attachAndSend), so removing here is purely local
// composer state.

import { formatBytes } from '../format';
import type { ComposerFile } from '../../lib/MeerkatProvider';

export function AttachmentChip({
  file,
  onRemove,
}: {
  file: ComposerFile;
  onRemove: () => void;
}): React.ReactElement {
  return (
    <div className="mk-attach-chip">
      <span className="mk-file-icon" aria-hidden>📎</span>
      <span className="mk-attach-chip-name" title={file.name}>{file.name}</span>
      <span className="mk-attach-chip-size">{formatBytes(file.bytes.length)}</span>
      <button
        type="button"
        className="mk-attach-chip-remove"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
