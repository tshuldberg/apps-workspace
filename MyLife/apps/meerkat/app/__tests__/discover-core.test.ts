import { describe, expect, it } from 'vitest';
import {
  DISCOVER_COPY,
  PUBLIC_CATEGORIES,
  PUBLIC_CATEGORY_LABELS,
  formatPublicMetric,
  rankTrending,
  selectDiscoverState,
  stillVerifyingLabel,
  type VerifiedPublicEntry,
} from '../(root)/data/discover-core';
import type { ProbePublicDirectoryResult } from '../(root)/data/public-directory-client';

function entry(overrides: Partial<VerifiedPublicEntry> = {}): VerifiedPublicEntry {
  return {
    publication_id: 'pub-1',
    kind: 'community',
    title: 'Trail Cooks',
    description: 'Open fire recipes',
    category: 'hobbies',
    owner_device_id: 'owner-device-abcdef0123456789',
    content_id: 'content-1',
    public_key_hex: 'ab'.repeat(16),
    host_urls: JSON.stringify(['https://host.example']),
    announcing_hosts: 3,
    event_count: 0,
    latest_wall: '2026-06-24T10:00:00.000Z',
    source_host: 'wss://dir.example',
    fetched_at: '2026-06-24T10:05:00.000Z',
    verified: true,
    ...overrides,
  };
}

function probe(over: Partial<ProbePublicDirectoryResult>): ProbePublicDirectoryResult {
  return { configured: true, respondedAt: '2026-06-24T10:05:00.000Z', entries: [], ...over };
}

describe('discover-core taxonomy', () => {
  it('renders the FULL fixed taxonomy: chip key set === engine enum, no chip omitted', () => {
    expect([...PUBLIC_CATEGORIES].sort()).toEqual(Object.keys(PUBLIC_CATEGORY_LABELS).sort());
    expect(Object.values(PUBLIC_CATEGORY_LABELS)).toEqual([
      'Technology', 'Gaming', 'News', 'Sports', 'Local', 'Hobbies', 'Creative', 'Discussion', 'Other',
    ]);
  });

  it('carries the verbatim section 7.1 copy', () => {
    expect(DISCOVER_COPY.headerTitle).toBe('Discover');
    expect(DISCOVER_COPY.headerSubtitle).toBe('Public communities, channels, and forums anyone can read.');
    expect(DISCOVER_COPY.searchPlaceholder).toBe('Search public communities and forums');
    expect(DISCOVER_COPY.trendingTitle).toBe('Trending');
    expect(DISCOVER_COPY.trendingHint).toBe('Ranked by how many hosts serve it and how recent it is. No view counts.');
    expect(DISCOVER_COPY.honestNotice).toBe(
      'This list comes from public directory hosts you can reach right now. Counts come from signed content and the number of hosts actually serving it, never from view or like tracking.',
    );
    expect(DISCOVER_COPY.loading).toBe('Reaching public directory hosts…');
    expect(DISCOVER_COPY.emptyTitle).toBe('No public communities found here yet');
    expect(DISCOVER_COPY.emptyBody).toBe(
      'No reachable directory host returned results. Try another search or check your connection server in Settings.',
    );
    expect(DISCOVER_COPY.errorTitle).toBe('Could not reach a public directory');
    expect(DISCOVER_COPY.errorRetry).toBe('Retry');
    expect(DISCOVER_COPY.errorBody).toBe(
      'No directory host responded. Public browsing needs a connection server with a public directory.',
    );
    expect(stillVerifyingLabel(2)).toBe('Still verifying 2 entries…');
    expect(stillVerifyingLabel(1)).toBe('Still verifying 1 entry…');
  });
});

describe('discover-core honest metrics', () => {
  it('formats only signed + serving signals, never likes or views', () => {
    const line = formatPublicMetric(entry({ event_count: 0, announcing_hosts: 3 }));
    expect(line.startsWith('0 posts · served by 3 hosts · updated ')).toBe(true);
    expect(line).not.toMatch(/like|view/i);
  });

  it('pluralizes posts and hosts honestly', () => {
    expect(formatPublicMetric(entry({ event_count: 1, announcing_hosts: 1 }))).toMatch(
      /^1 post · served by 1 host · updated /,
    );
    expect(formatPublicMetric(entry({ event_count: 12, announcing_hosts: 4 }))).toMatch(
      /^12 posts · served by 4 hosts · updated /,
    );
  });
});

describe('discover-core 5-state selection', () => {
  it('Loading: probe in flight with nothing shown', () => {
    expect(selectDiscoverState({ inFlight: true, shownEntries: [], probe: null })).toEqual({ kind: 'loading' });
    expect(selectDiscoverState({ inFlight: false, shownEntries: [], probe: null })).toEqual({ kind: 'loading' });
  });

  it('Partial: probe in flight while verified entries are already shown', () => {
    const state = selectDiscoverState({ inFlight: true, shownEntries: [entry()], probe: null });
    expect(state).toMatchObject({ kind: 'partial', verifying: 1 });
  });

  it('Error: no source configured, or configured but unreachable', () => {
    expect(selectDiscoverState({ inFlight: false, shownEntries: [], probe: probe({ configured: false, respondedAt: null }) }))
      .toEqual({ kind: 'error' });
    expect(selectDiscoverState({ inFlight: false, shownEntries: [], probe: probe({ respondedAt: null }) }))
      .toEqual({ kind: 'error' });
  });

  it('Empty: configured source responded with zero verified entries', () => {
    expect(selectDiscoverState({ inFlight: false, shownEntries: [], probe: probe({ entries: [] }) }))
      .toEqual({ kind: 'empty' });
  });

  it('Success: verified entries present', () => {
    const e = entry();
    const state = selectDiscoverState({ inFlight: false, shownEntries: [e], probe: probe({ entries: [e] }) });
    expect(state).toEqual({ kind: 'success', entries: [e] });
  });
});

describe('discover-core trending rank', () => {
  it('ranks by real announcing-host count then signed recency, never engagement', () => {
    const a = entry({ publication_id: 'a', announcing_hosts: 2, latest_wall: '2026-06-24T10:00:00.000Z' });
    const b = entry({ publication_id: 'b', announcing_hosts: 5, latest_wall: '2026-06-23T10:00:00.000Z' });
    const c = entry({ publication_id: 'c', announcing_hosts: 2, latest_wall: '2026-06-25T10:00:00.000Z' });
    expect(rankTrending([a, b, c]).map((e) => e.publication_id)).toEqual(['b', 'c', 'a']);
  });
});
