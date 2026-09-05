import { useCallback, useState } from 'react';
import { Button } from './Button';

// CopyRow: a monospace value plus a copy button. Used for fingerprints, keys,
// invite links, ids. Copy feedback flips the label for 1.5s.

export function CopyRow({ value, label = 'Copy' }: { value: string; label?: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    void navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  }, [value]);
  return (
    <div className="mk-copyrow">
      <span className="mk-mono">{value}</span>
      <Button variant="ghost" small onClick={onCopy}>
        {copied ? 'Copied' : label}
      </Button>
    </div>
  );
}
