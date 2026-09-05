import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const read = (p: string) => readFileSync(repoRoot + p, 'utf8');

const nativeData = read('apps/meerkat/app/(root)/data/community-core.ts');
const nativeSafety = read('apps/meerkat/app/(root)/data/community-safety.ts');
const nativeFeed = read('apps/meerkat/app/(root)/data/feed-core.ts');
const nativeProvider = read('apps/meerkat/app/(root)/providers/SyncProvider.tsx');
const nativeCommunities = read('apps/meerkat/app/(root)/(tabs)/communities.tsx');
// Plan 31 Phase 2 relocated CommunityProfileCard (and its profile copy) out of the
// now list-only communities.tsx into the community settings screen (mobile only).
const nativeCommunitySettings = read('apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx');
const webSchema = read('apps/meerkat-web/src/lib/schema.ts');
const webData = read('apps/meerkat-web/src/lib/meerkat-data.ts');
const webSafety = read('apps/meerkat-web/src/lib/community-safety.ts');
const webFeed = read('apps/meerkat-web/src/lib/feed-core.ts');
const webProvider = read('apps/meerkat-web/src/lib/MeerkatProvider.tsx');
const webSidebar = read('apps/meerkat-web/src/ui/community/ChannelSidebar.tsx');
// Plan 31 P5 relocated the community profile editor + admin out of the sidebar
// into the settings surface (mirrors the native settings screen).
const webCommunitySettings = read('apps/meerkat-web/src/ui/community/CommunitySettings.tsx');
const nativeDiscover = read('apps/meerkat/app/(root)/data/discover-core.ts');
const webDiscover = read('apps/meerkat-web/src/lib/discover-core.ts');
const nativeReader = read('apps/meerkat/app/(root)/data/public-reader-core.ts');
const webReader = read('apps/meerkat-web/src/lib/public-reader-core.ts');
const nativePublish = read('apps/meerkat/app/(root)/data/public-publish.ts');
const webPublish = read('apps/meerkat-web/src/lib/public-publish.ts');
const nativeHosted = read('apps/meerkat/app/(root)/data/hosted-boundaries.ts');
const webHosted = read('apps/meerkat-web/src/lib/hosted-boundaries.ts');

describe('web cm_ schema mirrors native (MK-P01 parity)', () => {
  it('mirrors the new cm_messages columns in the web DDL', () => {
    for (const col of ['version INTEGER NOT NULL DEFAULT 1', 'post_id TEXT', 'parent_id TEXT', 'branch_id TEXT', 'author_kind TEXT', "mentions_json TEXT NOT NULL DEFAULT '[]'", 'intent TEXT']) {
      expect(webSchema).toContain(col);
    }
  });

  it('mirrors the four post tables in the web DDL', () => {
    for (const tbl of ['cm_posts', 'cm_post_tags', 'cm_post_lifecycle', 'cm_post_activity']) {
      expect(webSchema).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
    }
  });

  it('mirrors the cm_read_state attention columns in the web DDL', () => {
    for (const col of ['snooze_until TEXT', 'importance INTEGER']) {
      expect(webSchema).toContain(col);
    }
  });

  it('mirrors the v2 fields in the web ChannelMessageRow + converters', () => {
    for (const field of ['version:', 'post_id:', 'parent_id:', 'branch_id:', 'author_kind:', 'mentions_json:', 'intent:']) {
      expect(webData).toContain(field);
    }
  });

  it('keeps unsupported cm_messages row versions fail-closed', () => {
    expect(webData).toContain('assertSupportedChannelMessageVersion(row.version)');
    expect(webData).toContain('.filter((row) => isSupportedChannelMessageVersion(row.version))');
  });

  it('mirrors Prompt 04 post product helpers in native and web data layers', () => {
    for (const helper of [
      'createChannelPostEvent',
      'createChannelPostReplyEvent',
      'insertPostHeaderRow',
      'listChannelPostCards',
      'listChannelPostThread',
    ]) {
      expect(nativeData).toContain(helper);
      expect(webData).toContain(helper);
    }
  });

  it('mirrors Plan 30 reaction read models and hygiene in native and web data layers', () => {
    for (const helper of [
      'isReactionEvent',
      'listChannelReactions',
      'export interface MessageReactionGroup',
      'reactionHiddenBySafety',
      // Finding 3 helpers: idempotent send + total un-react.
      'listActiveOwnReactionEventIds',
      'getChannelMessageEventById',
      // isChannelPostEvent must exclude reacts on BOTH surfaces.
      '&& !isReactionEvent(event)',
      // listChannelMessages must strip reacts before resolution on BOTH surfaces.
      '.filter((event) => !isReactionEvent(event))',
    ]) {
      expect(nativeData).toContain(helper);
      expect(webData).toContain(helper);
    }
  });

  it('mirrors Prompt 05 feed engine controls and evaluator in native and web data layers', () => {
    for (const helper of [
      'evaluateLocalFeed',
      'DEFAULT_FEED_CONTROLS',
      'VISIBLE_FEED_CONTROLS',
      'publicSourcesAvailable',
      'channelMuted',
    ]) {
      expect(nativeFeed).toContain(helper);
      expect(webFeed).toContain(helper);
    }
  });

  it('mirrors Prompt 07 local safety schema and helpers', () => {
    for (const ddl of [
      'CREATE TABLE IF NOT EXISTS cm_safety_actions',
      'target_author_device_id TEXT',
      'action TEXT NOT NULL',
      'status TEXT NOT NULL',
      'cm_safety_actions_lookup',
      'cm_safety_actions_review',
    ]) {
      expect(nativeData).toContain(ddl);
      expect(webSchema).toContain(ddl);
    }

    for (const helper of [
      'setCommunityMuted',
      'setChannelMuted',
      'blockCommunityPerson',
      'reportCommunityContent',
      'isCommunityContentReportHidden',
      'listOwnerReviewItems',
      'markSafetyActionReviewed',
    ]) {
      expect(nativeSafety).toContain(helper);
      expect(webSafety).toContain(helper);
    }

    for (const helper of [
      'createCommunitySafetyIndex',
      'blockedPersonIds',
      'hiddenMessageIds',
      'hiddenPostIds',
    ]) {
      expect(nativeFeed).toContain(helper);
      expect(webFeed).toContain(helper);
    }
  });

  it('mirrors Prompt 09 community profile schema, helpers, and controls', () => {
    for (const ddl of [
      'CREATE TABLE IF NOT EXISTS cm_profiles',
      'member_device_id TEXT NOT NULL',
      'display_name TEXT NOT NULL',
      'avatar_initial TEXT',
      'cm_profiles_member',
    ]) {
      expect(nativeData).toContain(ddl);
      expect(webSchema).toContain(ddl);
    }

    for (const helper of [
      'CM_PROFILES_TABLE',
      'communityProfileRowFromEvent',
      'insertCommunityProfileRow',
      'getCommunityProfile',
      'buildCommunityPeerNameMap',
      'resolveCommunityDisplayName',
      'resolveCommunityAvatarInitial',
      'resolveCommunityAvatarImage',
    ]) {
      expect(nativeData).toContain(helper);
      expect(webData).toContain(helper);
    }

    for (const control of ['setCommunityProfile', 'Name in this community', 'It is a pseudonym, not anonymity']) {
      expect(nativeProvider + nativeCommunities + nativeCommunitySettings).toContain(control);
      expect(webProvider + webSidebar + webCommunitySettings).toContain(control);
    }
  });
});

describe('Plan 19 public social surface mirrors native (P6 parity)', () => {
  it('mirrors the four cm_public* tables in the web DDL and native schema', () => {
    for (const tbl of [
      'cm_publications',
      'cm_public_reports',
      'cm_public_directory_cache',
      'cm_public_feed_cursor',
    ]) {
      expect(webSchema).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
      expect(nativeData).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
    }
  });

  it('mirrors the feed public-source gating in native and web feed cores', () => {
    for (const symbol of ['getVisibleFeedControls', 'publicSourcesAvailable', 'publicSource']) {
      expect(nativeFeed).toContain(symbol);
      expect(webFeed).toContain(symbol);
    }
  });

  it('mirrors the verbatim DISCOVER_COPY const on both discover cores', () => {
    for (const src of [nativeDiscover, webDiscover]) {
      expect(src).toContain('export const DISCOVER_COPY');
      expect(src).toContain("headerTitle: 'Discover'");
      expect(src).toContain(
        'This list comes from public directory hosts you can reach right now. Counts come from signed content and the number of hosts actually serving it, never from view or like tracking.',
      );
      expect(src).toContain('selectDiscoverState');
      expect(src).toContain('rankTrending');
      expect(src).toContain('formatPublicMetric');
    }
  });

  it('mirrors the verbatim READER_COPY const on both public-reader cores', () => {
    for (const src of [nativeReader, webReader]) {
      expect(src).toContain('export const READER_COPY');
      expect(src).toContain(
        'You are reading public content. Anyone can read this. It is signed by its authors so it cannot be forged, but it is not private.',
      );
      expect(src).toContain('Reading is free. Create an identity and join to post or reply.');
      expect(src).toContain('selectReaderState');
      expect(src).toContain('persistPublicReport');
      expect(src).toContain('groupChannelEvents');
    }
  });

  it('mirrors the P8b report-delivery seams on both public-reader cores', () => {
    for (const src of [nativeReader, webReader]) {
      // Honest sent/saved-local copy; delivery builds a signed report and POSTs it.
      expect(src).toContain("reportSentToHost: 'Sent to the host.'");
      expect(src).toContain('export async function persistPublicReport');
      expect(src).toContain('createPublicAbuseReport');
      expect(src).toContain('/public/${encodeURIComponent(publicationId)}/report');
      expect(src).toContain('res.status === 200');
    }
  });

  it('mirrors the P8b owner-moderation symbols on both public-publish twins', () => {
    for (const src of [nativePublish, webPublish]) {
      expect(src).toContain('export const PUBLIC_REPORTS_COPY');
      expect(src).toContain('export function listOwnedPublications');
      expect(src).toContain('export async function fetchOwnerPublicReports');
      expect(src).toContain('export async function unpublishPublicly');
      expect(src).toContain('export function markPublicReportReviewed');
      expect(src).toContain('export function listReviewedReportSigs');
      // Owner-signed report fetch headers (the §9 owner-fetch GET).
      expect(src).toContain("'x-mk-ts': ts");
      expect(src).toContain("'x-mk-owner-sig': sig");
      expect(src).toContain('createPublicReportFetchSignature');
      // Unpublish re-registers the unpublished revision WITH stored snapshot pieces,
      // then re-announces under the category rid via the raw announce verb.
      expect(src).toContain('cm_publication_snapshots');
      expect(src).toContain('deriveCategoryRid');
      expect(src).toContain('announceHost');
      // Honest unpublish outcome copy (never claims removal that did not happen).
      expect(src).toContain('Unpublished. Removed from the directory and every serving host.');
    }
  });

  it('mirrors the two P8b device_local moderation tables in native + web DDL', () => {
    for (const tbl of ['cm_publication_snapshots', 'cm_public_report_reviews']) {
      expect(webSchema).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
      expect(nativeData).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
    }
  });

  it('mirrors the verbatim PUBLISH_COPY + orchestrator on both public-publish twins (P7a)', () => {
    for (const src of [nativePublish, webPublish]) {
      expect(src).toContain('export const PUBLISH_COPY');
      expect(src).toContain('export async function publishChannelPublicly');
      // Verbatim section 7.3 state copy.
      expect(src).toContain('Building and signing your public snapshot…');
      expect(src).toContain('Add at least one post before publishing.');
      expect(src).toContain('No serving host accepted the content. Check your host URL or connect hosted serving.');
      expect(src).toContain('This host rejected the publication (rate limited). Try again later.');
      expect(src).toContain('Published. Anyone with a reachable host can now read it.');
      expect(src).toContain('Some hosts did not accept it; it is still readable from the ones that did.');
      expect(src).toContain('Published to ${accepted} of ${total} hosts.');
      // The `public` audience-rule hosted notice, verbatim.
      expect(src).toContain('Public posts use hosted storage and moderation.');
      // The copyable deep link + shared orchestrator helpers.
      expect(src).toContain('meerkat://public/');
      expect(src).toContain('publishedToHostsLabel');
      expect(src).toContain('persistPublicationRow');
      expect(src).toContain('INSERT OR REPLACE INTO cm_publications');
      // Price is read from billing-config, NEVER hardcoded.
      expect(src).toContain("import { MEERKAT_HOSTED_MONTHLY_PRODUCT } from '@mylife/billing-config'");
      expect(src).toContain('HOSTED_MONTHLY_PRICE = MEERKAT_HOSTED_MONTHLY_PRODUCT.price');
      expect(src).not.toContain('4.99');
    }
  });

  it('mirrors the state-driven public-reach hosted-boundary rows (P7a §7.4)', () => {
    for (const src of [nativeHosted, webHosted]) {
      expect(src).toContain('publicSourceConfigured');
      expect(src).toContain('publicSourceResponded');
      expect(src).toContain('hasPublicHostedEntitlement');
      expect(src).toContain('function publicReachItem');
      // Verbatim section 7.4 detail copy for the two reachable public states.
      expect(src).toContain(
        'Public reach is live through the host you configured. It is public only while that host is online; this is free self-hosting, not paid managed serving.',
      );
      expect(src).toContain(
        'Always-on managed public serving is active. Viewing is free for everyone; you pay for hosting capacity.',
      );
      expect(src).toContain("stateLabel: 'Self-served'");
      expect(src).toContain("stateLabel: 'Hosted'");
    }
  });
});
