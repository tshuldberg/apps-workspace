import replaceRingManifest from '@/public/marketing/replace-ring/manifest.json';

type ReplaceRingManifest = {
  generatedAt: string;
  basePath: string;
  selectionMethod: string;
  logos: Array<{
    rank: number;
    slug: string;
    name: string;
    moduleId: string;
    assetPath: string;
    format: string;
    logoSourceType: string;
    logoSourceUrl: string;
  }>;
};

const manifest = replaceRingManifest as ReplaceRingManifest;
const logos = manifest.logos.map((logo, index, all) => {
  const angle = (-90 + (360 / all.length) * index) * (Math.PI / 180);
  return {
    ...logo,
    left: 50 + Math.cos(angle) * 42,
    top: 50 + Math.sin(angle) * 42,
  };
});

const representedModules = new Set(manifest.logos.map((logo) => logo.moduleId)).size;

export function ReplaceCompetitorRing() {
  return (
    <section className="replace-ring-section" style={styles.section}>
      <div style={styles.copyColumn}>
        <div style={styles.eyebrow}>Replace the apps you already know</div>
        <h2 style={styles.title}>One private life hub instead of twenty separate products.</h2>
        <p style={styles.description}>
          MyLife already spans books, budgets, notes, workouts, nutrition, meds, events,
          trails, surf, voice, and more. This ring uses the logo pack we collected to show
          the category leaders users can eventually consolidate into one place.
        </p>

        <div className="replace-ring-stats" style={styles.statGrid}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{manifest.logos.length}</div>
            <div style={styles.statLabel}>competitors in the ring</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{representedModules}</div>
            <div style={styles.statLabel}>module categories covered</div>
          </div>
          <div style={styles.statCard}>
            <div style={styles.statValue}>1</div>
            <div style={styles.statLabel}>hub to replace the sprawl</div>
          </div>
        </div>

        <div style={styles.nameRail} aria-label="Highlighted competitors">
          {manifest.logos.slice(0, 8).map((logo) => (
            <span key={logo.slug} style={styles.nameChip}>
              {logo.name}
            </span>
          ))}
          <span style={styles.nameChipMuted}>+{manifest.logos.length - 8} more</span>
        </div>
      </div>

      <div style={styles.visualColumn}>
        <div className="replace-ring-shell" style={styles.visualShell}>
          <div style={styles.glowA} />
          <div style={styles.glowB} />
          <div style={styles.outerHalo} />
          <div className="replace-ring-orbit" style={styles.orbit}>
            {logos.map((logo) => (
              <div
                key={logo.slug}
                style={{
                  ...styles.position,
                  left: `${logo.left}%`,
                  top: `${logo.top}%`,
                }}
              >
                <div className="replace-ring-chip" style={styles.logoChip} title={logo.name}>
                  <img
                    src={logo.assetPath}
                    alt={`${logo.name} logo`}
                    style={styles.logoImage}
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="replace-ring-center-card" style={styles.centerCard}>
            <div style={styles.centerKicker}>Replace this stack</div>
            <div style={styles.centerHeadline}>MyLife</div>
            <p style={styles.centerBody}>
              A single surface for the modules people usually split across separate apps.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .replace-ring-shell:hover .replace-ring-orbit,
        .replace-ring-shell:focus-within .replace-ring-orbit {
          animation-play-state: paused;
        }

        .replace-ring-orbit {
          animation: replace-ring-spin 42s linear infinite;
        }

        .replace-ring-chip {
          animation: replace-ring-counter-spin 42s linear infinite;
        }

        @keyframes replace-ring-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes replace-ring-counter-spin {
          from {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          to {
            transform: translate(-50%, -50%) rotate(-360deg);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .replace-ring-orbit,
          .replace-ring-chip {
            animation: none !important;
          }
        }

        @media (max-width: 980px) {
          .replace-ring-section {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .replace-ring-section {
            padding: 20px !important;
            gap: 22px !important;
          }

          .replace-ring-stats {
            grid-template-columns: 1fr !important;
          }

          .replace-ring-center-card {
            width: 48% !important;
            min-width: 156px !important;
            padding: 20px 16px !important;
          }

          .replace-ring-chip {
            border-radius: 16px !important;
            padding: 8px !important;
          }
        }
      `}</style>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1.05fr) minmax(320px, 0.95fr)',
    gap: '28px',
    alignItems: 'center',
    marginBottom: '28px',
    padding: '24px',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.08)',
    background:
      'radial-gradient(circle at top left, rgba(255,184,119,0.16), transparent 36%), radial-gradient(circle at bottom right, rgba(124,77,255,0.16), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
    overflow: 'hidden',
  },
  copyColumn: {
    position: 'relative',
    zIndex: 1,
  },
  eyebrow: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(255,184,119,0.24)',
    background: 'rgba(255,184,119,0.10)',
    color: '#FFD3A4',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '14px',
  },
  title: {
    fontSize: 'clamp(30px, 5vw, 46px)',
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: '-0.04em',
    color: 'var(--text)',
    maxWidth: '12ch',
  },
  description: {
    marginTop: '14px',
    maxWidth: '58ch',
    fontSize: '15px',
    lineHeight: 1.7,
    color: 'var(--text-secondary)',
  },
  statGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '12px',
    marginTop: '20px',
  },
  statCard: {
    padding: '14px',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.05)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
  },
  statValue: {
    fontSize: '24px',
    lineHeight: 1,
    fontWeight: 800,
    color: 'var(--text)',
  },
  statLabel: {
    marginTop: '8px',
    fontSize: '12px',
    lineHeight: 1.45,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  nameRail: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '20px',
  },
  nameChip: {
    padding: '7px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(255,255,255,0.05)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  nameChipMuted: {
    padding: '7px 12px',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  visualColumn: {
    display: 'flex',
    justifyContent: 'center',
    minWidth: 0,
  },
  visualShell: {
    position: 'relative',
    width: 'min(100%, 560px)',
    aspectRatio: '1 / 1',
    minHeight: '340px',
    display: 'grid',
    placeItems: 'center',
  },
  glowA: {
    position: 'absolute',
    inset: '16% auto auto 14%',
    width: '34%',
    height: '34%',
    borderRadius: '999px',
    background: 'rgba(255,184,119,0.18)',
    filter: 'blur(42px)',
    pointerEvents: 'none',
  },
  glowB: {
    position: 'absolute',
    inset: 'auto 10% 14% auto',
    width: '30%',
    height: '30%',
    borderRadius: '999px',
    background: 'rgba(124,77,255,0.20)',
    filter: 'blur(44px)',
    pointerEvents: 'none',
  },
  outerHalo: {
    position: 'absolute',
    inset: '10%',
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.02) inset, 0 24px 60px rgba(0,0,0,0.35)',
    background:
      'radial-gradient(circle at center, rgba(255,255,255,0.03), rgba(255,255,255,0.01) 52%, transparent 70%)',
    pointerEvents: 'none',
  },
  orbit: {
    position: 'absolute',
    inset: 0,
    transformOrigin: 'center',
  },
  position: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
  },
  logoChip: {
    width: 'clamp(42px, 6.6vw, 62px)',
    height: 'clamp(42px, 6.6vw, 62px)',
    borderRadius: '18px',
    display: 'grid',
    placeItems: 'center',
    padding: '10px',
    background:
      'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(242,236,230,0.92))',
    border: '1px solid rgba(255,255,255,0.65)',
    boxShadow:
      '0 18px 34px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.8)',
    backdropFilter: 'blur(10px)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    display: 'block',
  },
  centerCard: {
    position: 'relative',
    zIndex: 1,
    width: '42%',
    minWidth: '180px',
    maxWidth: '240px',
    padding: '24px 20px',
    borderRadius: '28px',
    border: '1px solid rgba(255,255,255,0.10)',
    background:
      'linear-gradient(180deg, rgba(16,16,24,0.92), rgba(10,10,15,0.92))',
    boxShadow:
      '0 26px 70px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)',
    textAlign: 'center',
  },
  centerKicker: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#FFD3A4',
  },
  centerHeadline: {
    marginTop: '10px',
    fontSize: 'clamp(28px, 5vw, 42px)',
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: '-0.05em',
    color: 'var(--text)',
  },
  centerBody: {
    marginTop: '10px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: 'var(--text-secondary)',
  },
};
