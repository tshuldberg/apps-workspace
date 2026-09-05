// Plan 56 C1 (4.4): the Pages directory, a HOST surface every community always
// has: member-built pages with author attribution, newest first (pinned lands
// with community list prefs later phases). Any member the community's policy
// allows creates a page (propose); owners/curators PROMOTE a page to a
// top-level community tab via ONE descriptor revision appending a channel with
// kind 'page' bound to the canvas id (a new kind VALUE riding the signed kind
// slot: old clients render the read-only banner, signatures never break,
// plan 13.6). Demotion is another revision; the page survives in the
// directory. Caps: 20 pages/member (apply-time), 12 promoted tabs (here).

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { communityRole, getCommunity } from '@mylife/sync';
import { CANVAS_PROMOTED_TABS_CAP } from '@mylife/meerkat-canvas';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { useSync } from '../../../providers/SyncProvider';
import { CommunityThemeProvider } from '../../../providers/CommunityThemeProvider';
import { useMkStyles } from '../../../providers/AppThemeProvider';
import { shortHex, type MkColors, MK_RADIUS } from '../../../theme/tokens';
import { Button, HonestNotice, SectionHeader } from '../../../components/kit';
import { createPageCanvas, listCommunityPages, type CanvasPageListing } from '../../../data/canvas-core';
import { draftFromDescriptor } from '../../../data/community-org-core';
import { resolveCommunityDisplayName } from '../../../data/community-core';

export default function PagesRoute() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const id = typeof communityId === 'string' ? communityId : '';
  return (
    <CommunityThemeProvider communityId={id}>
      <PagesScreen communityId={id} />
    </CommunityThemeProvider>
  );
}

function PagesScreen({ communityId }: { communityId: string }) {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { recordLocalChange, saveCommunityOrganization } = useSync();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<CanvasPageListing | null>(null);
  const [tabName, setTabName] = useState('');

  useFocusEffect(useCallback(() => { setRevision((v) => v + 1); }, []));

  // Deep-linkable route: Back falls back to the community home (or the list)
  // when this screen is the stack's only route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    if (communityId) router.replace({ pathname: '/community/[communityId]', params: { communityId } });
    else router.replace('/communities');
  }, [router, communityId]);

  const community = useMemo(() => { void revision; return getCommunity(db, communityId); }, [db, communityId, revision]);
  const pages = useMemo(() => { void revision; return listCommunityPages(db, communityId); }, [db, communityId, revision]);
  const myRole = community ? communityRole(community.descriptor, identity.publicKey) : null;
  const mayPromote = myRole === 'owner' || myRole === 'admin';

  const promotedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const channel of community?.descriptor.channels ?? []) {
      if (channel.kind === 'page') ids.add(channel.id);
    }
    return ids;
  }, [community]);

  const createPage = useCallback(() => {
    if (!community) return;
    try {
      const canvas = createPageCanvas(db, identity, communityId, recordLocalChange);
      router.push({
        pathname: '/community/[communityId]/page/[canvasId]',
        params: { communityId, canvasId: canvas.id },
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create a page.');
    }
  }, [db, identity, community, communityId, recordLocalChange, router]);

  const promote = useCallback(() => {
    if (!community || !promoteTarget) return;
    const name = tabName.trim();
    if (!name) return;
    if (promotedIds.size >= CANVAS_PROMOTED_TABS_CAP) {
      setNotice(`This community already has ${CANVAS_PROMOTED_TABS_CAP} promoted tabs. Demote one first.`);
      return;
    }
    const draft = draftFromDescriptor(community.descriptor);
    draft.channels.push({ id: promoteTarget.canvas.id, name, kind: 'page' });
    const result = saveCommunityOrganization(communityId, draft);
    if (result.ok) {
      setNotice(`Promoted to the "${name}" tab. Members receive the new tab on their next sync with you.`);
      setPromoteTarget(null);
      setTabName('');
      setRevision((v) => v + 1);
    } else {
      setNotice(result.error ?? 'Could not promote that page.');
    }
  }, [community, promoteTarget, tabName, promotedIds, saveCommunityOrganization, communityId]);

  const demote = useCallback((listing: CanvasPageListing) => {
    if (!community) return;
    const draft = draftFromDescriptor(community.descriptor);
    draft.channels = draft.channels.filter((channel) => channel.id !== listing.canvas.id);
    const result = saveCommunityOrganization(communityId, draft);
    if (result.ok) {
      setNotice('Tab removed. The page stays here in the directory.');
      setRevision((v) => v + 1);
    } else {
      setNotice(result.error ?? 'Could not demote that page.');
    }
  }, [community, saveCommunityOrganization, communityId]);

  if (!community) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <HonestNotice text="This community is not on this device." />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 24 }}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={styles.headerText.color as string} />
        </Pressable>
        <Text style={styles.headerText}>Pages</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="New page" onPress={createPage} style={styles.backBtn}>
          <Plus size={20} color={styles.headerText.color as string} />
        </Pressable>
      </View>

      <SectionHeader
        title={`${pages.length} page${pages.length === 1 ? '' : 's'}`}
        hint="Anything a member builds lists here instantly. Owners can promote a page to a community tab."
      />

      {pages.length === 0 ? (
        <Text style={styles.emptyLine}>No pages yet. Build the first one.</Text>
      ) : null}

      {pages.map((listing) => {
        const authorName = resolveCommunityDisplayName(db, communityId, listing.authorDevice)
          ?? shortHex(listing.authorDevice);
        const promoted = promotedIds.has(listing.canvas.id);
        return (
          <View key={listing.canvas.id} style={styles.pageRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open page by ${authorName}`}
              onPress={() => router.push({
                pathname: '/community/[communityId]/page/[canvasId]',
                params: { communityId, canvasId: listing.canvas.id },
              })}
              style={styles.pageMain}
            >
              <Text style={styles.pageTitle} numberOfLines={1}>{listing.titleHint ?? 'Untitled page'}</Text>
              <Text style={styles.pageMeta} numberOfLines={1}>
                By {authorName} · {listing.nodeCount} piece{listing.nodeCount === 1 ? '' : 's'}{promoted ? ' · promoted tab' : ''}
              </Text>
            </Pressable>
            {mayPromote ? (
              promoted ? (
                <Button title="Demote" variant="secondary" onPress={() => demote(listing)} />
              ) : (
                <Button title="Promote" variant="secondary" onPress={() => { setPromoteTarget(listing); setTabName(''); }} />
              )
            ) : null}
          </View>
        );
      })}

      {promoteTarget ? (
        <View style={styles.promotePanel}>
          <SectionHeader title="Promote to a tab" hint="One signed community revision. Old app versions show it as a read-only channel." />
          <TextInput
            style={styles.input}
            placeholder="Tab name"
            value={tabName}
            onChangeText={setTabName}
            maxLength={40}
          />
          <View style={styles.promoteActions}>
            <Button title="Promote" onPress={promote} disabled={!tabName.trim()} />
            <Button title="Cancel" variant="secondary" onPress={() => setPromoteTarget(null)} />
          </View>
        </View>
      ) : null}

      {notice ? <HonestNotice text={notice} /> : null}
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    backBtn: { padding: 6 },
    headerText: { color: c.text, fontSize: 18, fontWeight: '700', flex: 1 },
    emptyLine: { color: c.textSecondary, fontSize: 13, marginVertical: 12 },
    pageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 12,
      marginBottom: 8,
    },
    pageMain: { flex: 1 },
    pageTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
    pageMeta: { color: c.textTertiary, fontSize: 12, marginTop: 2 },
    promotePanel: { marginTop: 12, gap: 8 },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 10,
      paddingVertical: 8,
      color: c.text,
      backgroundColor: c.surfaceElevated,
    },
    promoteActions: { flexDirection: 'row', gap: 8 },
  });
