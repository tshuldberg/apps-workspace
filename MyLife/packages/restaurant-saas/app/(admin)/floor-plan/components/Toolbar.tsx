'use client';

interface ToolbarProps {
  zoom: number;
  snapEnabled: boolean;
  snapSize: 8 | 16;
  serviceLocked: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleSnap: () => void;
  onToggleSnapSize: () => void;
  onToggleLock: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

export function Toolbar({
  zoom,
  snapEnabled,
  snapSize,
  serviceLocked,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onToggleSnap,
  onToggleSnapSize,
  onToggleLock,
  onUndo,
  onRedo,
}: ToolbarProps) {
  const btnStyle = (active?: boolean): React.CSSProperties => ({
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    background: active ? 'var(--accent-dim)' : 'var(--glass)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <button onClick={onZoomOut} style={btnStyle()}>-</button>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '40px', textAlign: 'center' }}>
        {Math.round(zoom * 100)}%
      </span>
      <button onClick={onZoomIn} style={btnStyle()}>+</button>

      <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

      <button onClick={onToggleSnap} style={btnStyle(snapEnabled)}>
        Snap {snapEnabled ? 'ON' : 'OFF'}
      </button>
      {snapEnabled && (
        <button onClick={onToggleSnapSize} style={btnStyle()}>
          {snapSize}px
        </button>
      )}

      <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

      <button onClick={onUndo} disabled={!canUndo} style={{ ...btnStyle(), opacity: canUndo ? 1 : 0.4 }}>
        Undo
      </button>
      <button onClick={onRedo} disabled={!canRedo} style={{ ...btnStyle(), opacity: canRedo ? 1 : 0.4 }}>
        Redo
      </button>

      <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />

      <button onClick={onToggleLock} style={btnStyle(serviceLocked)}>
        {serviceLocked ? 'Locked' : 'Unlocked'}
      </button>
    </div>
  );
}
