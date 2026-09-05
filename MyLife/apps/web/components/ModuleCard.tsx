'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ModuleDefinition } from '@mylife/module-registry';
import { isModuleUnlocked } from '@mylife/entitlements';
import { useEntitlements } from './EntitlementsProvider';
import { PurchaseGate } from './PurchaseGate';
import { MODULE_ICON_MAP } from '@/lib/module-icons';

interface ModuleCardProps {
  module: ModuleDefinition;
  enabled: boolean;
}

export function ModuleCard({ module, enabled }: ModuleCardProps) {
  const entitlements = useEntitlements();
  const unlocked = isModuleUnlocked(module.id, entitlements);
  const isPremium = module.tier === 'premium';
  const [showGate, setShowGate] = useState(false);

  const route = `/${module.id}`;
  const IconComponent = MODULE_ICON_MAP[module.id];

  const iconElement = (
    <span
      style={{
        ...styles.icon,
        backgroundColor: `${module.accentColor}1A`,
      }}
    >
      {IconComponent && (
        <IconComponent size={22} style={{ color: '#FFFFFF' }} />
      )}
    </span>
  );

  if (!unlocked) {
    return (
      <>
        <button
          style={styles.card}
          onClick={() => setShowGate(true)}
          type="button"
        >
          <div
            style={{
              ...styles.accentBorder,
              backgroundColor: module.accentColor,
            }}
          />
          <div style={styles.content}>
            <div style={styles.header}>
              {iconElement}
              <div style={{ flex: 1 }}>
                <h3 style={styles.name}>{module.name}</h3>
                <p style={styles.tagline}>{module.tagline}</p>
              </div>
            </div>
            <div style={styles.footer}>
              <span style={styles.lockBadge}>Locked</span>
              <span
                style={{
                  ...styles.proBadge,
                  color: module.accentColor,
                  borderColor: module.accentColor,
                }}
              >
                PRO
              </span>
            </div>
          </div>
          {/* Lock overlay */}
          <div style={styles.lockOverlay}>
            <span style={styles.lockIcon}>{'\u{1F512}'}</span>
          </div>
        </button>

        {showGate && (
          <div style={styles.modal} onClick={() => setShowGate(false)}>
            <div onClick={(e) => e.stopPropagation()}>
              <PurchaseGate
                moduleId={module.id}
                moduleName={module.name}
                moduleIcon={module.icon}
                accentColor={module.accentColor}
                onPurchaseComplete={() => setShowGate(false)}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <Link href={route} style={styles.card}>
      <div
        style={{
          ...styles.accentBorder,
          backgroundColor: module.accentColor,
        }}
      />
      <div style={styles.content}>
        <div style={styles.header}>
          {iconElement}
          <div>
            <h3 style={styles.name}>{module.name}</h3>
            <p style={styles.tagline}>{module.tagline}</p>
          </div>
        </div>
        <div style={styles.footer}>
          <span
            style={{
              ...styles.badge,
              color: enabled ? 'var(--success)' : 'var(--text-tertiary)',
              borderColor: enabled ? 'var(--success)' : 'var(--border)',
            }}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          {isPremium && (
            <span
              style={{
                ...styles.proBadge,
                color: module.accentColor,
                borderColor: module.accentColor,
              }}
            >
              PRO
            </span>
          )}
          {!isPremium && (
            <span
              style={{
                ...styles.tierBadge,
                color: 'var(--success)',
              }}
            >
              Free
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'var(--glass)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--glass-border)',
    backdropFilter: 'blur(40px)',
    WebkitBackdropFilter: 'blur(40px)',
    overflow: 'hidden',
    textDecoration: 'none',
    transition: 'background-color 0.15s, border-color 0.15s',
    cursor: 'pointer',
    position: 'relative',
    width: '100%',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
  },
  accentBorder: {
    width: '4px',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  icon: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  name: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  tagline: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    marginTop: '2px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
  },
  lockBadge: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border)',
    color: 'var(--text-tertiary)',
  },
  proBadge: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.5px',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid',
  },
  tierBadge: {
    fontSize: '12px',
    fontWeight: 500,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 10, 15, 0.4)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 'var(--radius-lg)',
    pointerEvents: 'none',
  },
  lockIcon: {
    fontSize: '28px',
    opacity: 0.7,
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
};
