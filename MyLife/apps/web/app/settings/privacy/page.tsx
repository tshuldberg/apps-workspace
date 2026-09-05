'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useModuleRegistry } from '@mylife/module-registry/hooks';
import type { ModuleDefinition } from '@mylife/module-registry';
import { isWebSupportedModuleId } from '@/lib/modules';
import {
  deleteAllDataAction,
  deleteModuleDataAction,
  getModuleTableStatsAction,
} from '../../actions';

/** Per-module data descriptions for the Privacy Dashboard. */
const MODULE_DATA_DESCRIPTIONS: Record<string, string[]> = {
  books: ['Library catalog', 'Reading lists', 'Ratings and reviews (private)', 'Reading sessions', 'Import history'],
  budget: ['Accounts', 'Envelopes', 'Transactions', 'Recurring rules', 'Debt payoff plans'],
  car: ['Vehicles', 'Service records', 'Fuel logs', 'Reminders'],
  closet: ['Wardrobe items', 'Outfits', 'Categories'],
  cycle: ['Period logs', 'Symptoms', 'Predictions'],
  fast: ['Fasting sessions', 'Streaks', 'Settings'],
  flash: ['Decks', 'Cards', 'Study sessions', 'Performance stats'],
  forums: ['Posts and replies (cloud)', 'Votes and community memberships (cloud)', 'Bookmarks and drafts (local)', 'Read state (local)'],
  garden: ['Plants', 'Care journal', 'Zones', 'Seed inventory'],
  habits: ['Habits', 'Completions', 'Streaks', 'Timed sessions', 'Measurements'],
  health: ['Vitals', 'Body measurements', 'Health events'],
  homes: ['Property listings (cloud)', 'Saved searches (cloud)', 'Search history (local)', 'Preferences (local)'],
  journal: ['Journal entries', 'Tags', 'Moods'],
  mail: ['Email summaries (local cache)', 'Labels', 'Action items'],
  market: ['Listings and conversations (cloud)', 'Reviews (cloud)', 'Watchlist and drafts (local)', 'Saved searches (local)'],
  meds: ['Medications', 'Doses', 'Reminders', 'Refills', 'Interactions', 'Mood and side-effect logs'],
  mood: ['Mood entries', 'Activities', 'Notes'],
  notes: ['Notes', 'Folders', 'Tags'],
  nutrition: ['Food logs', 'Meals', 'Nutrient totals'],
  pets: ['Pet profiles', 'Vet visits', 'Medications', 'Weight logs'],
  recipes: ['Recipes', 'Collections', 'Pantry', 'Grocery lists', 'Meal plans'],
  rsvp: ['Events', 'RSVPs', 'Guest lists'],
  stars: ['Ratings', 'Reviews', 'Lists'],
  subs: ['Subscriptions', 'Renewal dates', 'Costs', 'Categories'],
  surf: ['Spot ratings and session reports (cloud)', 'Saved spots (local)', 'Session logs (local)', 'Forecast cache (local)'],
  trails: ['Hikes', 'Trail logs', 'GPS tracks'],
  voice: ['Voice memos', 'Transcriptions', 'Tags'],
  words: ['Vocabulary', 'Study sessions', 'Progress'],
  workouts: ['Exercises', 'Workouts', 'Body measurements', 'Progress photos'],
};

/** Cloud module descriptions for the amber info row. */
const CLOUD_INFO: Record<string, string> = {
  forums: 'Posts and replies sync to the server for community visibility. Bookmarks and drafts stay on device.',
  homes: 'Property data syncs for multi-device access. Search history stays on device.',
  market: 'Listings and conversations sync for the marketplace. Watchlist and drafts stay on device.',
  surf: 'Spot ratings sync for the community. Saved spots and session logs stay on device.',
};

interface ModuleStats {
  moduleId: string;
  tables: { tableName: string; rowCount: number }[];
  totalRows: number;
}

export default function PrivacyDashboardPage() {
  const registry = useModuleRegistry();
  const enabled = registry
    .getEnabled()
    .filter((mod) => isWebSupportedModuleId(mod.id));

  const cloudModules = enabled.filter(
    (mod) => mod.storageType === 'supabase' || mod.storageType === 'drizzle',
  );
  const allLocal = cloudModules.length === 0;

  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStats>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<ModuleDefinition | null>(null);
  const [moduleDeleteInput, setModuleDeleteInput] = useState('');
  const [isDeletingModule, setIsDeletingModule] = useState(false);

  const loadModuleStats = useCallback(async (mod: ModuleDefinition) => {
    if (!mod.tablePrefix || moduleStats[mod.id]) return;
    const tables = await getModuleTableStatsAction(mod.tablePrefix);
    const totalRows = tables.reduce((sum, t) => sum + t.rowCount, 0);
    setModuleStats((prev) => ({ ...prev, [mod.id]: { moduleId: mod.id, tables, totalRows } }));
  }, [moduleStats]);

  useEffect(() => {
    if (expandedModule) {
      const mod = enabled.find((m) => m.id === expandedModule);
      if (mod) void loadModuleStats(mod);
    }
  }, [expandedModule, enabled, loadModuleStats]);

  const handleDelete = async () => {
    if (deleteInput !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await deleteAllDataAction();
      window.location.href = '/';
    } catch {
      setIsDeleting(false);
    }
  };

  const handleDeleteModule = async () => {
    if (!moduleToDelete?.tablePrefix) return;
    if (moduleDeleteInput !== moduleToDelete.name) return;
    setIsDeletingModule(true);
    try {
      const result = await deleteModuleDataAction(moduleToDelete.id, moduleToDelete.tablePrefix);
      setModuleStats((prev) => {
        const next = { ...prev };
        delete next[moduleToDelete.id];
        return next;
      });
      setModuleToDelete(null);
      setModuleDeleteInput('');
      if (result.hasCloudData) {
        alert(`Local data for ${result.moduleId} has been deleted. Cloud data must be deleted separately from your account settings on the server.`);
      }
    } finally {
      setIsDeletingModule(false);
    }
  };

  const sortedEnabled = [...enabled].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <div style={styles.header}>
        <h1 style={styles.title}>Privacy Dashboard</h1>
        <p style={styles.subtitle}>Real-time compliance status for your data</p>
      </div>

      {/* Compliance Status Card */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Compliance Status</h2>
        <div style={styles.glassCard}>
          <ComplianceRow
            icon="🗄️"
            label="Data stored locally"
            status={allLocal ? 'All Local' : `${cloudModules.length} module${cloudModules.length > 1 ? 's' : ''} use cloud`}
            isGreen={allLocal}
          />
          <ComplianceRow icon="📊" label={'Analytics \u0026 telemetry'} status="None" isGreen border />
          <ComplianceRow icon="📦" label="Data export" status="Available" isGreen border />
          <ComplianceRow icon="🚫" label="Ads shown" status="None. Ever." isGreen border />
        </div>
      </section>

      {/* Data Actions Card */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Data Actions</h2>
        <div style={styles.card}>
          <Link href="/settings/backup" style={styles.actionRow}>
            <div>
              <p style={styles.actionLabel}>Export All Data</p>
              <p style={styles.actionSublabel}>CSV, JSON, and Markdown. Every module.</p>
            </div>
            <span style={styles.chevron}>›</span>
          </Link>
          <div style={styles.separator} />
          <button
            style={styles.deleteRow}
            onClick={() => setDeleteConfirm(true)}
          >
            <div>
              <p style={styles.deleteLabel}>Delete All My Data</p>
              <p style={styles.actionSublabel}>Permanently removes everything. Cannot be undone.</p>
            </div>
            <span style={styles.chevron}>›</span>
          </button>
        </div>
      </section>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Delete All Data</h3>
            <p style={styles.modalText}>
              This will permanently delete all data across all modules.
              This cannot be undone.
            </p>
            <p style={styles.modalText}>
              Type <strong style={{ color: 'var(--danger, #FF453A)' }}>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type DELETE"
              style={styles.modalInput}
              autoFocus
            />
            <div style={styles.modalButtons}>
              <button
                style={styles.cancelButton}
                onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.confirmDeleteButton,
                  opacity: deleteInput === 'DELETE' ? 1 : 0.4,
                }}
                disabled={deleteInput !== 'DELETE' || isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Module Delete Confirmation Modal (R17.2: two-step) */}
      {moduleToDelete && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>Delete {moduleToDelete.name} Data</h3>
            <p style={styles.modalText}>
              This will permanently delete all {moduleToDelete.name} data and disable the module. This cannot be undone.
            </p>
            {(moduleToDelete.storageType === 'supabase' || moduleToDelete.storageType === 'drizzle') && (
              <p style={{ ...styles.modalText, color: '#F59E0B' }}>
                This module also stores data in the cloud. Local data will be deleted immediately. Cloud data deletion will be handled separately.
              </p>
            )}
            <p style={styles.modalText}>
              Type <strong style={{ color: 'var(--danger, #FF453A)' }}>{moduleToDelete.name}</strong> to confirm:
            </p>
            <input
              type="text"
              value={moduleDeleteInput}
              onChange={(e) => setModuleDeleteInput(e.target.value)}
              placeholder={`Type ${moduleToDelete.name}`}
              style={styles.modalInput}
              autoFocus
            />
            <div style={styles.modalButtons}>
              <button
                style={styles.cancelButton}
                onClick={() => { setModuleToDelete(null); setModuleDeleteInput(''); }}
              >
                Cancel
              </button>
              <button
                style={{
                  ...styles.confirmDeleteButton,
                  opacity: moduleDeleteInput === moduleToDelete.name ? 1 : 0.4,
                }}
                disabled={moduleDeleteInput !== moduleToDelete.name || isDeletingModule}
                onClick={() => void handleDeleteModule()}
              >
                {isDeletingModule ? 'Deleting...' : `Delete ${moduleToDelete.name} Data`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-Module Data Summary */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>What Each Module Stores</h2>
        {sortedEnabled.map((mod) => {
          const isExpanded = expandedModule === mod.id;
          const stats = moduleStats[mod.id];
          const isCloud = mod.storageType === 'supabase' || mod.storageType === 'drizzle';
          const descriptions = MODULE_DATA_DESCRIPTIONS[mod.id] ?? [];
          const cloudInfo = CLOUD_INFO[mod.id];

          return (
            <div key={mod.id} style={styles.moduleCard}>
              <button
                style={styles.moduleHeader}
                onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
              >
                <span style={styles.moduleIcon}>{mod.icon}</span>
                <span style={styles.moduleName}>{mod.name}</span>
                <span style={isCloud ? styles.amberPill : styles.greenPill}>
                  {isCloud ? 'Cloud' : 'On Device'}
                </span>
                <span style={styles.expandChevron}>{isExpanded ? '▴' : '▾'}</span>
              </button>

              {isExpanded && (
                <div style={styles.moduleExpanded}>
                  {mod.tablePrefix && (
                    <p style={styles.tablePrefix}>Tables: {mod.tablePrefix}*</p>
                  )}
                  {stats && (
                    <p style={styles.tablePrefix}>
                      {stats.tables.length} table{stats.tables.length !== 1 ? 's' : ''}, {stats.totalRows} row{stats.totalRows !== 1 ? 's' : ''} total
                    </p>
                  )}
                  {descriptions.map((desc, i) => (
                    <div key={i} style={styles.dataRow}>
                      <span style={styles.dataDot}>·</span>
                      <span style={styles.dataDesc}>{desc}</span>
                    </div>
                  ))}
                  {isCloud && cloudInfo && (
                    <div style={styles.cloudInfo}>
                      <span style={styles.cloudIcon}>☁️</span>
                      <span style={styles.cloudText}>{cloudInfo}</span>
                    </div>
                  )}
                  {mod.tablePrefix && (
                    <button
                      style={styles.deleteModuleButton}
                      onClick={() => { setModuleToDelete(mod); setModuleDeleteInput(''); }}
                    >
                      Delete {mod.name} Data
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* The Pledge */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>The Anti-Enshittification Pledge</h2>
        <div style={styles.pledgeCard}>
          <p style={styles.pledgeText}>
            MyLife is built on seven commitments that protect your data,
            your money, and your right to leave.
          </p>
          <Link href="/settings/sharing" style={styles.pledgeLink}>
            Review sharing preferences
          </Link>
        </div>
        <p style={styles.pledgeFooter}>
          Pledge version 1.0 -- Any changes will be documented publicly.
        </p>
      </section>
    </div>
  );
}

function ComplianceRow({
  icon,
  label,
  status,
  isGreen,
  border,
}: {
  icon: string;
  label: string;
  status: string;
  isGreen: boolean;
  border?: boolean;
}) {
  return (
    <div style={{ ...styles.complianceRow, ...(border ? styles.rowBorder : {}) }}>
      <span style={styles.complianceIcon}>{icon}</span>
      <span style={styles.complianceLabel}>{label}</span>
      <span style={isGreen ? styles.greenPill : styles.amberPill}>{status}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: { marginBottom: '32px' },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginTop: '4px',
  },
  section: { marginBottom: '32px' },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '12px',
  },
  card: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '16px',
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.10)',
    padding: '16px',
    backdropFilter: 'blur(60px) saturate(200%)',
  },

  // Compliance rows
  complianceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 0',
  },
  rowBorder: {
    borderTop: '1px solid var(--border)',
  },
  complianceIcon: { fontSize: '20px', flexShrink: 0 },
  complianceLabel: {
    fontSize: '16px',
    color: 'var(--text)',
    flex: 1,
  },
  greenPill: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#30D158',
    backgroundColor: 'rgba(48,209,88,0.15)',
    padding: '4px 10px',
    borderRadius: '999px',
    whiteSpace: 'nowrap' as const,
  },
  amberPill: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.15)',
    padding: '4px 10px',
    borderRadius: '999px',
    whiteSpace: 'nowrap' as const,
  },

  // Data Actions
  actionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    textDecoration: 'none',
    color: 'inherit',
    cursor: 'pointer',
  },
  actionLabel: {
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--text)',
    margin: 0,
  },
  actionSublabel: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: '2px 0 0 0',
  },
  separator: {
    height: '1px',
    backgroundColor: 'var(--border)',
  },
  deleteRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left' as const,
  },
  deleteLabel: {
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--danger, #FF453A)',
    margin: 0,
  },
  chevron: {
    fontSize: '20px',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },

  // Delete modal
  overlay: {
    position: 'fixed' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'var(--surface-elevated, #1A1A24)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    padding: '24px',
    maxWidth: '420px',
    width: '90%',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--danger, #FF453A)',
    margin: '0 0 12px 0',
  },
  modalText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    margin: '0 0 12px 0',
  },
  modalInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface, #12121A)',
    color: 'var(--text)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    marginBottom: '16px',
  },
  modalButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface-elevated)',
    color: 'var(--text)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmDeleteButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--danger, #FF453A)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },

  // Module cards
  moduleCard: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    marginBottom: '8px',
    overflow: 'hidden',
  },
  moduleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
  },
  moduleIcon: { fontSize: '20px', flexShrink: 0 },
  moduleName: {
    fontSize: '16px',
    fontWeight: 500,
    color: 'var(--text)',
    flex: 1,
    textAlign: 'left' as const,
  },
  expandChevron: {
    fontSize: '14px',
    color: 'var(--text-tertiary)',
    flexShrink: 0,
  },
  moduleExpanded: {
    padding: '0 16px 16px 48px',
  },
  tablePrefix: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    margin: '0 0 8px 0',
  },
  dataRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    padding: '2px 0',
  },
  dataDot: {
    fontSize: '16px',
    color: 'var(--text-tertiary)',
    lineHeight: 1,
  },
  dataDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  cloudInfo: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    padding: '10px 12px',
    backgroundColor: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderRadius: '8px',
  },
  cloudIcon: { fontSize: '16px', flexShrink: 0 },
  cloudText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
  },

  // Per-module delete
  deleteModuleButton: {
    marginTop: '12px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,69,58,0.3)',
    backgroundColor: 'rgba(255,69,58,0.08)',
    color: 'var(--danger, #FF453A)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  // Pledge
  pledgeCard: {
    backgroundColor: 'var(--surface)',
    borderRadius: '16px',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent, #3B82F6)',
    padding: '16px 20px',
  },
  pledgeText: {
    fontSize: '16px',
    color: 'var(--text)',
    lineHeight: '1.6',
    margin: '0 0 12px 0',
  },
  pledgeLink: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--accent, #3B82F6)',
    textDecoration: 'none',
  },
  pledgeFooter: {
    fontSize: '13px',
    color: 'var(--text-tertiary)',
    textAlign: 'center' as const,
    marginTop: '16px',
  },
};
