'use client';

import { useState } from 'react';
import {
  getModuleReleaseDescription,
  getModuleReleaseLabel,
  getModuleReleaseState,
  isHealthDataModule,
  HEALTH_DATA_TYPES,
  type ModuleId,
} from '@mylife/module-registry';
import { useEnabledModules, useModuleRegistry } from '@mylife/module-registry/hooks';
import { ReplaceCompetitorRing } from '@/components/marketing/ReplaceCompetitorRing';
import {
  enableModuleAction,
  disableModuleAction,
  hasActiveHealthConsentAction,
  recordHealthConsentAction,
} from '../actions';
import { WEB_VISIBLE_MODULE_IDS } from '@/lib/modules';
import { MODULE_METADATA } from '@mylife/module-registry';

/**
 * Web-aware release state. Some modules are promoted on the web surface even
 * though the shared release-state arrays still mark them 'hidden' (or
 * 'merged'). Any module that survives the WEB_VISIBLE_MODULE_IDS filter yet
 * reports a non-user-visible shared state is one of those web-only promotions,
 * so surface it as public beta instead of a "HIDDEN / Not yet available" card.
 */
function isWebOverride(id: ModuleId): boolean {
  const shared = getModuleReleaseState(id);
  return shared === 'hidden' || shared === 'merged';
}

function webReleaseState(id: ModuleId): ReturnType<typeof getModuleReleaseState> {
  if (isWebOverride(id)) return 'public_beta';
  return getModuleReleaseState(id);
}

function webReleaseLabel(id: ModuleId): string {
  if (isWebOverride(id)) return 'BETA';
  return getModuleReleaseLabel(id);
}

function webReleaseDescription(id: ModuleId): string {
  if (isWebOverride(id)) return 'Included at launch as a public beta.';
  return getModuleReleaseDescription(id);
}

interface PendingConsent {
  moduleId: ModuleId;
  moduleName: string;
  moduleIcon: string;
  dataTypes: readonly string[];
}

export default function DiscoverPage() {
  const registry = useModuleRegistry();
  useEnabledModules();
  const [pendingConsent, setPendingConsent] = useState<PendingConsent | null>(null);

  const allModules = WEB_VISIBLE_MODULE_IDS.map((id) => MODULE_METADATA[id]);
  const gaCount = allModules.filter((mod) => webReleaseState(mod.id) === 'ga').length;
  const betaCount = allModules.filter((mod) => webReleaseState(mod.id) === 'public_beta').length;

  const handleToggle = async (id: ModuleId) => {
    if (registry.isEnabled(id)) {
      await disableModuleAction(id);
      registry.disable(id);
    } else {
      // Health data modules require consent before enabling
      if (isHealthDataModule(id)) {
        const hasConsent = await hasActiveHealthConsentAction(id);
        if (!hasConsent) {
          const meta = MODULE_METADATA[id];
          setPendingConsent({
            moduleId: id,
            moduleName: meta.name,
            moduleIcon: meta.icon,
            dataTypes: HEALTH_DATA_TYPES[id] ?? [],
          });
          return;
        }
      }
      await enableModuleAction(id);
      registry.enable(id);
    }
  };

  const handleConsent = async () => {
    if (!pendingConsent) return;
    const { moduleId, dataTypes } = pendingConsent;
    await recordHealthConsentAction(moduleId, [...dataTypes]);
    await enableModuleAction(moduleId);
    registry.enable(moduleId);
    setPendingConsent(null);
  };

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Discover</h1>
        <p style={styles.subtitle}>
          Browse {allModules.length} web-supported modules. {gaCount} are GA and {betaCount} are public beta.
        </p>
      </div>

      <div style={styles.banner}>
        MyLife Pro guarantees the {gaCount}-module GA launch bundle. The remaining {betaCount}
        modules here are public beta and labeled below.
      </div>

      <ReplaceCompetitorRing />

      <div style={styles.grid}>
        {allModules.map((mod) => {
          const isEnabled = registry.isEnabled(mod.id);
          const releaseState = webReleaseState(mod.id);
          const releaseLabel = webReleaseLabel(mod.id);
          const releaseDescription = webReleaseDescription(mod.id);
          return (
            <div key={mod.id} data-testid="discover-module-card" style={styles.card}>
              <div
                style={{
                  ...styles.accentBorder,
                  backgroundColor: mod.accentColor,
                }}
              />
              <div style={styles.content}>
                <div style={styles.cardHeader}>
                  <span style={styles.icon}>{mod.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={styles.nameRow}>
                      <h3 style={styles.name}>{mod.name}</h3>
                      <span
                        style={{
                          ...styles.releaseBadge,
                          ...(releaseState === 'ga'
                            ? styles.releaseBadgeGa
                            : styles.releaseBadgeBeta),
                        }}
                      >
                        {releaseLabel}
                      </span>
                    </div>
                    <p style={styles.tagline}>{mod.tagline}</p>
                    <p style={styles.releaseDescription}>{releaseDescription}</p>
                  </div>
                  <button
                    onClick={() => void handleToggle(mod.id)}
                    style={{
                      ...styles.toggleButton,
                      backgroundColor: isEnabled
                        ? mod.accentColor
                        : 'transparent',
                      borderColor: isEnabled
                        ? mod.accentColor
                        : 'var(--border)',
                      color: isEnabled ? 'var(--background)' : 'var(--text-secondary)',
                    }}
                  >
                    {isEnabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>
                <div style={styles.meta}>
                  <span
                    style={{
                      ...styles.tierBadge,
                      color:
                        mod.tier === 'free'
                          ? 'var(--success)'
                          : 'var(--text-tertiary)',
                    }}
                  >
                    {mod.tier === 'free' ? 'Free' : 'Premium'}
                  </span>
                  <span style={styles.metaText}>
                    {mod.storageType === 'sqlite'
                      ? 'Local'
                      : mod.storageType === 'supabase'
                        ? 'Cloud'
                        : 'Cloud'}
                  </span>
                  {mod.requiresNetwork && (
                    <span style={styles.metaText}>Requires network</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Health Data Consent Dialog */}
      {pendingConsent && (
        <div style={consentStyles.overlay} onClick={() => setPendingConsent(null)}>
          <div style={consentStyles.dialog} onClick={(e) => e.stopPropagation()}>
            <h2 style={consentStyles.title}>
              {pendingConsent.moduleIcon} Health Data Consent
            </h2>
            <p style={consentStyles.description}>
              {pendingConsent.moduleName} collects consumer health data as defined
              by applicable health privacy laws. Your explicit consent is required
              before any data collection begins.
            </p>
            <div style={consentStyles.dataSection}>
              <p style={consentStyles.dataTitle}>
                Data collected by {pendingConsent.moduleName}:
              </p>
              <ul style={consentStyles.dataList}>
                {pendingConsent.dataTypes.map((dt) => (
                  <li key={dt} style={consentStyles.dataItem}>{dt}</li>
                ))}
              </ul>
            </div>
            <div style={consentStyles.rights}>
              <p style={consentStyles.dataTitle}>Your rights:</p>
              <ul style={consentStyles.dataList}>
                <li style={consentStyles.dataItem}>All health data is stored locally on your device</li>
                <li style={consentStyles.dataItem}>We never sell, share, or transmit your health data to third parties</li>
                <li style={consentStyles.dataItem}>You can withdraw consent at any time in Settings</li>
                <li style={consentStyles.dataItem}>You can request deletion of all your health data</li>
              </ul>
            </div>
            <div style={consentStyles.disclaimer}>
              MyLife is not a medical device and does not provide medical advice.
              Health data in this module is for personal tracking purposes only.
            </div>
            <div style={consentStyles.actions}>
              <button
                style={consentStyles.declineButton}
                onClick={() => setPendingConsent(null)}
              >
                Decline
              </button>
              <button
                style={consentStyles.consentButton}
                onClick={() => void handleConsent()}
              >
                I Consent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const consentStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    maxHeight: '85vh',
    overflow: 'auto',
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 16px',
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.6,
    marginBottom: 16,
  },
  dataSection: {
    backgroundColor: 'var(--glass)',
    border: '1px solid var(--glass-border)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 8,
  },
  dataList: {
    paddingLeft: 20,
    margin: 0,
  },
  dataItem: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },
  rights: {
    marginBottom: 16,
  },
  disclaimer: {
    backgroundColor: 'rgba(255,159,10,0.08)',
    border: '1px solid rgba(255,159,10,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#FF9F0A',
    lineHeight: 1.5,
    marginBottom: 20,
  },
  actions: {
    display: 'flex',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  consentButton: {
    flex: 1,
    padding: '10px 16px',
    borderRadius: 8,
    border: '1px solid rgba(48,209,88,0.5)',
    backgroundColor: 'rgba(48,209,88,0.15)',
    color: 'var(--text)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  banner: {
    marginBottom: '20px',
    padding: '14px 16px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--glass)',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    lineHeight: 1.5,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '16px',
  },
  card: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
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
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const,
  },
  icon: {
    fontSize: '28px',
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
  releaseBadge: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.4px',
    padding: '3px 8px',
    borderRadius: '999px',
  },
  releaseBadgeGa: {
    color: 'var(--success)',
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
  },
  releaseBadgeBeta: {
    color: 'var(--text-secondary)',
    backgroundColor: 'rgba(240, 240, 245, 0.08)',
  },
  releaseDescription: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
    margin: '6px 0 0 0',
  },
  toggleButton: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    flexShrink: 0,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  tierBadge: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  metaText: {
    fontSize: '12px',
    color: 'var(--text-tertiary)',
  },
};
