'use client';

const ACCENT = 'var(--accent-notes)';

interface ChecklistItemProps {
  text: string;
  checked: boolean;
  indent: number;
  onToggle: () => void;
}

export function ChecklistItem({ text, checked, indent, onToggle }: ChecklistItemProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-[rgba(255,255,255,0.04)]"
      style={{ paddingLeft: `${indent * 24}px` }}
    >
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{
          border: checked ? `1.5px solid ${ACCENT}` : '1.5px solid rgba(255,255,255,0.10)',
          backgroundColor: checked ? ACCENT : 'transparent',
        }}
      >
        {checked && <span className="text-xs font-bold text-white">{'\u2713'}</span>}
      </span>
      <span
        className="flex-1 text-sm"
        style={{
          color: checked ? 'rgba(240,240,245,0.45)' : 'var(--color-text)',
          textDecoration: checked ? 'line-through' : 'none',
        }}
      >
        {text}
      </span>
    </button>
  );
}

interface ChecklistProgressBadgeProps {
  checked: number;
  total: number;
}

export function ChecklistProgressBadge({ checked, total }: ChecklistProgressBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-semibold"
      style={{ color: ACCENT, backgroundColor: 'rgba(100,116,139,0.15)' }}
    >
      {checked}/{total}
    </span>
  );
}
