'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDueReminders, type DueReminder } from './reminders-data';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

const POLL_INTERVAL_MS = 60 * 1000;

function readPermission(): PermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as PermissionState;
}

/**
 * App-wide in-tab reminders layer for web.
 *
 * Web browsers cannot deliver reminders in the background or while the hub tab
 * is closed: there is no service-worker push wired here, and even if there
 * were, the user would need the browser open and the site permitted. So this
 * provider is honest about its scope. It only nudges while the hub tab is open.
 *
 * Responsibilities:
 *  1. Offer a Notification-permission prompt that persists across routes.
 *  2. Render a persistent "due now" tray listing currently-due reminders.
 *  3. Fire an in-tab browser notification once per newly-due item (granted only).
 *
 * It degrades gracefully when the Notification API is unavailable and never
 * throws, so mounting it app-wide cannot break a route.
 */
export function RemindersProvider({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const [trayOpen, setTrayOpen] = useState(true);
  const [promptDismissed, setPromptDismissed] = useState(false);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  // Resolve permission on mount (client only) so SSR and client agree.
  useEffect(() => {
    setPermission(readPermission());
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    try {
      const next = await Notification.requestPermission();
      setPermission(next as PermissionState);
    } catch {
      // Some browsers throw on the legacy callback form; treat as unchanged.
      setPermission(readPermission());
    }
  }, []);

  // Poll the server for currently-due reminders while the tab is open.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await fetchDueReminders();
        if (!cancelled) setReminders(next);
      } catch {
        if (!cancelled) setReminders([]);
      }
    };

    void load();
    const interval = window.setInterval(() => void load(), POLL_INTERVAL_MS);

    // Refresh when the tab regains focus, since nothing fires while hidden.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Fire one in-tab notification per newly-due item when permission is granted.
  useEffect(() => {
    if (permission !== 'granted') return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    for (const reminder of reminders) {
      if (notifiedIdsRef.current.has(reminder.id)) continue;
      notifiedIdsRef.current.add(reminder.id);
      try {
        new Notification(reminder.title, { body: reminder.detail, tag: reminder.id });
      } catch {
        // Notification construction can throw on some platforms; ignore.
      }
    }

    // Forget ids that are no longer due so they can re-notify if they return.
    const liveIds = new Set(reminders.map((r) => r.id));
    for (const id of notifiedIdsRef.current) {
      if (!liveIds.has(id)) notifiedIdsRef.current.delete(id);
    }
  }, [permission, reminders]);

  const showPermissionPrompt =
    !promptDismissed && (permission === 'default' || permission === 'denied');

  return (
    <>
      {children}
      <div style={styles.dock} aria-live="polite">
        {showPermissionPrompt ? (
          <div style={styles.permissionCard}>
            <p style={styles.kicker}>In-tab reminders</p>
            <p style={styles.copy}>
              {permission === 'denied'
                ? 'Browser notifications are blocked, so reminders can only appear in this tray while the hub is open.'
                : 'Allow notifications to get a nudge while the MyLife tab is open. Reminders cannot be delivered in the background or when this tab is closed.'}
            </p>
            <div style={styles.row}>
              {permission === 'default' ? (
                <button
                  type="button"
                  onClick={() => void requestPermission()}
                  style={styles.primaryButton}
                >
                  Allow notifications
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPromptDismissed(true)}
                style={styles.ghostButton}
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}

        {reminders.length > 0 ? (
          <div style={styles.tray}>
            <div style={styles.trayHeader}>
              <div>
                <p style={styles.trayTitle}>Due now</p>
                <p style={styles.trayNote}>
                  In-tab only. Closed-tab and background push are not supported on web.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTrayOpen((open) => !open)}
                style={styles.toggleButton}
                aria-expanded={trayOpen}
              >
                {trayOpen ? 'Hide' : `Show (${reminders.length})`}
              </button>
            </div>
            {trayOpen ? (
              <ul style={styles.list}>
                {reminders.map((reminder) => (
                  <li key={reminder.id}>
                    <a href={reminder.href} style={styles.item}>
                      <span style={styles.itemTitle}>{reminder.title}</span>
                      <span style={styles.itemDetail}>{reminder.detail}</span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  dock: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    width: 320,
    maxWidth: 'calc(100vw - 40px)',
    pointerEvents: 'none',
  },
  permissionCard: {
    pointerEvents: 'auto',
    padding: 14,
    borderRadius: 'var(--radius-lg, 16px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    background: 'var(--surface-elevated, #2A292F)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
  },
  tray: {
    pointerEvents: 'auto',
    borderRadius: 'var(--radius-lg, 16px)',
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    background: 'var(--surface-elevated, #2A292F)',
    boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  trayHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderBottom: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
  },
  trayTitle: {
    margin: 0,
    color: 'var(--text, #E4E1E9)',
    fontSize: 14,
    fontWeight: 800,
  },
  trayNote: {
    margin: '4px 0 0',
    color: 'var(--text-secondary, #D6C3B5)',
    fontSize: 11,
    lineHeight: 1.4,
  },
  kicker: {
    margin: 0,
    color: 'var(--primary, #FFB877)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  copy: {
    margin: '6px 0 0',
    color: 'var(--text-secondary, #D6C3B5)',
    fontSize: 13,
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  primaryButton: {
    border: '1px solid var(--primary-container, #C9894D)',
    background: 'var(--primary, #FFB877)',
    color: '#1A1206',
    borderRadius: 999,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  },
  ghostButton: {
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    background: 'transparent',
    color: 'var(--text-secondary, #D6C3B5)',
    borderRadius: 999,
    padding: '9px 14px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
  toggleButton: {
    border: '1px solid var(--glass-border, rgba(255,255,255,0.10))',
    background: 'transparent',
    color: 'var(--text-secondary, #D6C3B5)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    maxHeight: 320,
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '10px 12px',
    borderRadius: 12,
    textDecoration: 'none',
    background: 'var(--glass, rgba(255,255,255,0.03))',
    border: '1px solid var(--border, rgba(255,255,255,0.06))',
  },
  itemTitle: {
    color: 'var(--text, #E4E1E9)',
    fontSize: 13,
    fontWeight: 700,
  },
  itemDetail: {
    color: 'var(--text-secondary, #D6C3B5)',
    fontSize: 12,
  },
};
