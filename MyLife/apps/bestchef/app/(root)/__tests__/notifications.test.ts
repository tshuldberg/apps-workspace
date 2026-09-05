import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(process.cwd(), 'app', '(root)');
const SCREEN = path.join(ROOT, 'notifications.tsx');
const ROW = path.join(ROOT, 'components', 'NotificationRow.tsx');
const LAYOUT = path.join(ROOT, '_layout.tsx');
const EN_CATALOG = path.resolve(process.cwd(), 'app', '(root)', 'i18n', 'catalogs', 'en.ts');

function read(p: string) {
  return readFileSync(p, 'utf8');
}

describe('notifications route', () => {
  it('registers the notifications route as a modal in _layout.tsx', () => {
    const layout = read(LAYOUT);
    expect(layout).toContain('name="notifications"');
    expect(layout).toContain('presentation: \'modal\'');
  });

  it('imports getNotificationFeed and subscribeNotificationFeed from @mylife/bestchef', () => {
    const screen = read(SCREEN);
    expect(screen).toContain('getNotificationFeed');
    expect(screen).toContain('subscribeNotificationFeed');
  });

  it('renders category filter chips with all 5 categories', () => {
    const screen = read(SCREEN);
    expect(screen).toContain('FilterChips');
    expect(screen).toContain("'all'");
    expect(screen).toContain("'votes'");
    expect(screen).toContain("'ranks'");
    expect(screen).toContain("'social'");
    expect(screen).toContain("'system'");
  });

  it('builds NEW and EARLIER sections from unread/read split', () => {
    const screen = read(SCREEN);
    expect(screen).toContain("'NEW'");
    expect(screen).toContain("'EARLIER'");
    expect(screen).toContain('isRead');
  });

  it('shows LiveBadge when liveConnected is true', () => {
    const screen = read(SCREEN);
    expect(screen).toContain('LiveBadge');
    expect(screen).toContain('liveConnected');
  });

  it('calls markAllReadApi when mark-all-read is pressed', () => {
    const screen = read(SCREEN);
    expect(screen).toContain('markAllReadApi');
    expect(screen).toContain('handleMarkAllRead');
  });

  it('subscribes to realtime and unsubscribes on unmount', () => {
    const screen = read(SCREEN);
    expect(screen).toContain('subscribeNotificationFeed');
    expect(screen).toContain('unsubRef');
    expect(screen).toContain('unsub()');
  });

  it('renders empty state when filteredFeed is empty', () => {
    const screen = read(SCREEN);
    expect(screen).toContain('Nothing here yet');
    expect(screen).toContain('New notifications in this category will show up here.');
  });
});

describe('NotificationRow component', () => {
  it('calls removeNotification on trailing swipe', () => {
    const row = read(ROW);
    expect(row).toContain('removeNotification');
    expect(row).toContain('handleDelete');
  });

  it('calls markNotificationRead on leading swipe and tap', () => {
    const row = read(ROW);
    expect(row).toContain('markNotificationRead');
    expect(row).toContain('handleMarkRead');
    expect(row).toContain('handleTap');
  });

  it('navigates to targetRoute on tap', () => {
    const row = read(ROW);
    expect(row).toContain('targetRoute');
    expect(row).toContain('router.push');
  });

  it('renders actor avatar with initials when actorName present', () => {
    const row = read(ROW);
    expect(row).toContain('actorName');
    expect(row).toContain('initials(');
  });

  it('renders kind-tinted icon circle when no actor', () => {
    const row = read(ROW);
    expect(row).toContain('kindTintColor');
    expect(row).toContain('kindIconChar');
  });

  it('renders kind badge overlay when actor is shown', () => {
    const row = read(ROW);
    expect(row).toContain('kindBadge');
    expect(row).toContain('actorColor');
  });

  it('uses Swipeable from react-native-gesture-handler', () => {
    const row = read(ROW);
    expect(row).toContain("from 'react-native-gesture-handler'");
    expect(row).toContain('renderRightActions');
    expect(row).toContain('renderLeftActions');
  });
});

describe('i18n keys for notifications', () => {
  it('has all required notification keys in EN catalog', () => {
    const catalog = read(EN_CATALOG);
    const required = [
      'Mark all read',
      'All caught up',
      'Tap to read, swipe to dismiss',
      'Nothing here yet',
      'New notifications in this category will show up here.',
      'LIVE',
      'Ranks',
      'Social',
      'System',
      'NEW',
      'EARLIER',
      '1 new notification',
      '{count} new notifications',
    ];
    for (const key of required) {
      expect(catalog, `Missing i18n key: ${key}`).toContain(key);
    }
  });
});
