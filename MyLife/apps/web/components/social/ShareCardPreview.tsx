'use client';

interface ShareCardPreviewProps {
  title: string;
  subtitle: string;
  moduleIcon: string;
  moduleAccentColor: string;
  stat?: string;
  statLabel?: string;
}

export function ShareCardPreview({
  title,
  subtitle,
  moduleIcon,
  moduleAccentColor,
  stat,
  statLabel,
}: ShareCardPreviewProps) {
  return (
    <div
      style={{
        ...styles.card,
        borderColor: moduleAccentColor,
      }}
    >
      <div style={styles.cardInner}>
        <div style={styles.header}>
          <div
            style={{
              ...styles.iconBadge,
              backgroundColor: `${moduleAccentColor}1A`,
            }}
          >
            <span style={styles.icon}>{moduleIcon}</span>
          </div>
          <div style={styles.brandMark}>
            <span style={styles.brandLogo}>M</span>
            <span style={styles.brandText}>MyLife</span>
          </div>
        </div>

        <div style={styles.body}>
          <h3 style={styles.title}>{title}</h3>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>

        {stat && (
          <div
            style={{
              ...styles.statContainer,
              backgroundColor: `${moduleAccentColor}1A`,
            }}
          >
            <span
              style={{
                ...styles.statValue,
                color: moduleAccentColor,
              }}
            >
              {stat}
            </span>
            {statLabel && <span style={styles.statLabel}>{statLabel}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    width: '320px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid',
    overflow: 'hidden',
  },
  cardInner: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBadge: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: '22px',
  },
  brandMark: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  brandLogo: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    background: 'linear-gradient(135deg, #C9894D, #F97316)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '12px',
    color: '#0E0C09',
  },
  brandText: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  title: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: '1.4',
  },
  statContainer: {
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
  },
  statLabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
};
