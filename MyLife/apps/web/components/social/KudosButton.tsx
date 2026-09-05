'use client';

interface KudosButtonProps {
  count: number;
  active: boolean;
  onClick: () => void;
}

export function KudosButton({ count, active, onClick }: KudosButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.button,
        color: active ? 'var(--accent-social)' : 'var(--text-tertiary)',
      }}
    >
      <span style={styles.icon}>{active ? '\u2764\uFE0F' : '\u2661'}</span>
      {count > 0 && <span style={styles.count}>{count}</span>}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  button: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 0',
    font: 'inherit',
    fontSize: '13px',
    transition: 'color 0.15s',
  },
  icon: {
    fontSize: '16px',
  },
  count: {
    fontSize: '13px',
    fontWeight: 500,
  },
};
