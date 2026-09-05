import React from 'react';
import { colors, surfaceTiers } from '../tokens/colors';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface ConflictItem {
  id: string;
  workspaceId: string;
  moduleId: string;
  tableName: string;
  rowId: string;
  localVersion: Record<string, unknown>;
  remoteVersion: Record<string, unknown>;
  remoteDeviceId: string;
  createdAt: string;
}

export interface CustomResolverProps {
  conflict: ConflictItem;
  onResolve: (resolution: 'local' | 'remote' | 'merged') => void;
}

export interface ConflictResolverProps {
  conflicts: ConflictItem[];
  onResolve: (conflictId: string, resolution: 'local' | 'remote' | 'merged') => void;
  /** Module-keyed custom resolver components. When present, the custom component renders instead of the default diff view. */
  customResolvers?: Record<string, React.ComponentType<CustomResolverProps>>;
  /** Wrap the entire conflict list in a platform-specific container (e.g. ScrollView). */
  renderContainer?: (children: React.ReactNode) => React.ReactNode;
  /** Wrap each conflict card in a platform-specific wrapper. */
  renderCard?: (children: React.ReactNode, conflict: ConflictItem) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style tokens (Obsidian Noir, platform-agnostic CSSProperties)
// ---------------------------------------------------------------------------

const s = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } satisfies React.CSSProperties,

  emptyContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  } satisfies React.CSSProperties,

  emptyIcon: {
    fontSize: 40,
    marginBottom: 8,
  } satisfies React.CSSProperties,

  emptyText: {
    color: colors.textSecondary,
    fontSize: 15,
  } satisfies React.CSSProperties,

  card: {
    backgroundColor: surfaceTiers.low,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  } satisfies React.CSSProperties,

  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } satisfies React.CSSProperties,

  headerTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
  } satisfies React.CSSProperties,

  headerMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    margin: 0,
  } satisfies React.CSSProperties,

  columns: {
    display: 'flex',
    flexDirection: 'row',
    gap: 12,
  } satisfies React.CSSProperties,

  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } satisfies React.CSSProperties,

  columnLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    margin: 0,
  } satisfies React.CSSProperties,

  jsonBlock: {
    backgroundColor: surfaceTiers.lowest,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: 10,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 1.5,
    color: colors.text,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    margin: 0,
    overflowX: 'auto',
    maxHeight: 200,
    overflowY: 'auto',
  } satisfies React.CSSProperties,

  actions: {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
  } satisfies React.CSSProperties,

  btn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    textAlign: 'center',
  } satisfies React.CSSProperties,

  btnLocal: {
    backgroundColor: colors.primary,
    color: surfaceTiers.lowest,
  } satisfies React.CSSProperties,

  btnRemote: {
    backgroundColor: colors.tertiary,
    color: surfaceTiers.lowest,
  } satisfies React.CSSProperties,

  btnMerge: {
    backgroundColor: colors.glassStrong,
    color: colors.text,
    border: `1px solid ${colors.glassBorder}`,
  } satisfies React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function truncateId(id: string, length = 8): string {
  return id.length > length ? `${id.slice(0, length)}...` : id;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyConflicts() {
  return (
    <div style={s.emptyContainer}>
      <div style={s.emptyIcon}>{'✓'}</div>
      <span style={s.emptyText}>No conflicts to resolve</span>
    </div>
  );
}

interface DefaultResolverViewProps {
  conflict: ConflictItem;
  onResolve: (resolution: 'local' | 'remote' | 'merged') => void;
}

function DefaultResolverView({ conflict, onResolve }: DefaultResolverViewProps) {
  return (
    <>
      <div style={s.columns}>
        <div style={s.column}>
          <p style={s.columnLabel}>Local (this device)</p>
          <pre style={s.jsonBlock}>{formatJson(conflict.localVersion)}</pre>
        </div>
        <div style={s.column}>
          <p style={s.columnLabel}>Remote ({truncateId(conflict.remoteDeviceId)})</p>
          <pre style={s.jsonBlock}>{formatJson(conflict.remoteVersion)}</pre>
        </div>
      </div>
      <div style={s.actions}>
        <button
          type="button"
          style={{ ...s.btn, ...s.btnLocal }}
          onClick={() => onResolve('local')}
        >
          Keep Local
        </button>
        <button
          type="button"
          style={{ ...s.btn, ...s.btnRemote }}
          onClick={() => onResolve('remote')}
        >
          Keep Remote
        </button>
        <button
          type="button"
          style={{ ...s.btn, ...s.btnMerge }}
          onClick={() => onResolve('merged')}
        >
          Merge
        </button>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// ConflictResolver
// ---------------------------------------------------------------------------

export function ConflictResolver({
  conflicts,
  onResolve,
  customResolvers,
  renderContainer,
  renderCard,
}: ConflictResolverProps) {
  if (conflicts.length === 0) {
    return renderContainer ? <>{renderContainer(<EmptyConflicts />)}</> : <EmptyConflicts />;
  }

  const list = (
    <div style={s.list}>
      {conflicts.map((conflict) => {
        const CustomResolver = customResolvers?.[conflict.moduleId];
        const handleResolve = (resolution: 'local' | 'remote' | 'merged') => {
          onResolve(conflict.id, resolution);
        };

        const cardContent = (
          <div style={s.card}>
            <div style={s.header}>
              <p style={s.headerTitle}>
                {conflict.moduleId} / {conflict.tableName}
              </p>
              <p style={s.headerMeta}>
                Row {truncateId(conflict.rowId)} &middot; {formatTimestamp(conflict.createdAt)}
                {' '}&middot; from {truncateId(conflict.remoteDeviceId)}
              </p>
            </div>
            {CustomResolver ? (
              <CustomResolver conflict={conflict} onResolve={handleResolve} />
            ) : (
              <DefaultResolverView conflict={conflict} onResolve={handleResolve} />
            )}
          </div>
        );

        return (
          <React.Fragment key={conflict.id}>
            {renderCard ? renderCard(cardContent, conflict) : cardContent}
          </React.Fragment>
        );
      })}
    </div>
  );

  return renderContainer ? <>{renderContainer(list)}</> : list;
}
