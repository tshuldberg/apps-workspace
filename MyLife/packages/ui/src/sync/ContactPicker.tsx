import React, { useMemo } from 'react';
import { colors, surfaceTiers } from '../tokens/colors';

// ---------------------------------------------------------------------------
// Public Types
// ---------------------------------------------------------------------------

export interface Contact {
  deviceId: string;
  displayName: string;
  lastSeenAt: string | null;
  isOnline: boolean;
  workspaceIds: string[];
}

export interface ContactPickerProps {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  onCancel: () => void;
  title?: string;
  renderContainer?: (children: React.ReactNode) => React.ReactNode;
  renderContactItem?: (contact: Contact, onSelect: () => void) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Style tokens (Obsidian Noir, platform-agnostic CSSProperties)
// ---------------------------------------------------------------------------

const s = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    backgroundColor: surfaceTiers.low,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: 12,
    overflow: 'hidden',
  } satisfies React.CSSProperties,

  header: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${colors.border}`,
  } satisfies React.CSSProperties,

  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: 600,
    margin: 0,
  } satisfies React.CSSProperties,

  cancelBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 500,
    padding: '4px 8px',
    borderRadius: 6,
  } satisfies React.CSSProperties,

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    maxHeight: 320,
    overflowY: 'auto',
  } satisfies React.CSSProperties,

  contactRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    cursor: 'pointer',
    borderBottom: `1px solid ${colors.border}`,
    background: 'none',
    border: 'none',
    borderBlockEnd: `1px solid ${colors.border}`,
    width: '100%',
    textAlign: 'left',
  } satisfies React.CSSProperties,

  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: colors.success,
    flexShrink: 0,
  } satisfies React.CSSProperties,

  offlineDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: colors.outlineVariant,
    flexShrink: 0,
  } satisfies React.CSSProperties,

  contactInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  } satisfies React.CSSProperties,

  contactName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 500,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } satisfies React.CSSProperties,

  contactMeta: {
    color: colors.textTertiary,
    fontSize: 12,
    margin: 0,
  } satisfies React.CSSProperties,

  workspaceBadges: {
    display: 'flex',
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  } satisfies React.CSSProperties,

  workspaceBadge: {
    backgroundColor: colors.glassStrong,
    border: `1px solid ${colors.glassBorder}`,
    borderRadius: 4,
    padding: '1px 6px',
    fontSize: 10,
    color: colors.textSecondary,
    whiteSpace: 'nowrap',
  } satisfies React.CSSProperties,

  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  } satisfies React.CSSProperties,

  emptyIcon: {
    fontSize: 32,
  } satisfies React.CSSProperties,

  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    margin: 0,
    lineHeight: 1.5,
  } satisfies React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'Never seen';
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return iso;
  }
}

function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    // Online first
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    // Then by most recently seen
    if (a.lastSeenAt && b.lastSeenAt) {
      return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    }
    if (a.lastSeenAt && !b.lastSeenAt) return -1;
    if (!a.lastSeenAt && b.lastSeenAt) return 1;
    return 0;
  });
}

function truncateWorkspaceId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 10)}...` : id;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyContacts() {
  return (
    <div style={s.emptyContainer}>
      <div style={s.emptyIcon}>{'📡'}</div>
      <p style={s.emptyText}>
        No paired devices.{'\n'}Pair a device in Settings &gt; Sync.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactPicker
// ---------------------------------------------------------------------------

export function ContactPicker({
  contacts,
  onSelect,
  onCancel,
  title = 'Share with',
  renderContainer,
  renderContactItem,
}: ContactPickerProps) {
  const sorted = useMemo(() => sortContacts(contacts), [contacts]);

  const content = (
    <div style={s.wrapper}>
      <div style={s.header}>
        <p style={s.title}>{title}</p>
        <button type="button" style={s.cancelBtn} onClick={onCancel}>
          Cancel
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyContacts />
      ) : (
        <div style={s.list}>
          {sorted.map((contact) => {
            const handleSelect = () => onSelect(contact);

            if (renderContactItem) {
              return (
                <React.Fragment key={contact.deviceId}>
                  {renderContactItem(contact, handleSelect)}
                </React.Fragment>
              );
            }

            return (
              <button
                key={contact.deviceId}
                type="button"
                style={s.contactRow}
                onClick={handleSelect}
              >
                <div style={contact.isOnline ? s.onlineDot : s.offlineDot} />
                <div style={s.contactInfo}>
                  <p style={s.contactName}>{contact.displayName}</p>
                  <p style={s.contactMeta}>
                    {contact.isOnline ? 'Online' : formatLastSeen(contact.lastSeenAt)}
                  </p>
                </div>
                {contact.workspaceIds.length > 0 && (
                  <div style={s.workspaceBadges}>
                    {contact.workspaceIds.map((wsId) => (
                      <span key={wsId} style={s.workspaceBadge}>
                        {truncateWorkspaceId(wsId)}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return renderContainer ? <>{renderContainer(content)}</> : content;
}
