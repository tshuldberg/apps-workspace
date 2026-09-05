// Plan 56 C1 (4.4): a member-built page. Renders the verified canvas through
// CanvasHost (view + build for members the layer policy allows). The page
// lives inside the community route subtree, so the community theme boundary
// applies and the tab bar / chrome stay outside the canvas (7.3).

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { getCommunity } from '@mylife/sync';
import { useMeerkatDatabase } from '../../../../providers/DatabaseProvider';
import { CommunityThemeProvider } from '../../../../providers/CommunityThemeProvider';
import { useMkStyles } from '../../../../providers/AppThemeProvider';
import { shortHex, type MkColors } from '../../../../theme/tokens';
import { HonestNotice } from '../../../../components/kit';
import { CanvasHost } from '../../../../components/canvas/CanvasHost';
import { getCanvasById } from '../../../../data/canvas-core';
import { resolveCommunityDisplayName } from '../../../../data/community-core';

export default function PageRoute() {
  const { communityId, canvasId } = useLocalSearchParams<{ communityId: string; canvasId: string }>();
  const cid = typeof communityId === 'string' ? communityId : '';
  return (
    <CommunityThemeProvider communityId={cid}>
      <PageScreen communityId={cid} canvasId={typeof canvasId === 'string' ? canvasId : ''} />
    </CommunityThemeProvider>
  );
}

function PageScreen({ communityId, canvasId }: { communityId: string; canvasId: string }) {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const [revision, setRevision] = useState(0);

  useFocusEffect(useCallback(() => { setRevision((v) => v + 1); }, []));

  // Deep-linkable route: Back falls back to the Pages directory (or the list)
  // when this screen is the stack's only route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    if (communityId) router.replace({ pathname: '/community/[communityId]/pages', params: { communityId } });
    else router.replace('/communities');
  }, [router, communityId]);

  const community = useMemo(() => { void revision; return getCommunity(db, communityId); }, [db, communityId, revision]);
  const canvas = useMemo(() => { void revision; return getCanvasById(db, canvasId); }, [db, canvasId, revision]);
  const authorName = useMemo(() => {
    if (!canvas) return null;
    return resolveCommunityDisplayName(db, communityId, canvas.signedBy) ?? shortHex(canvas.signedBy);
  }, [db, communityId, canvas]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24 }}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={styles.headerText.color as string} />
        </Pressable>
        <Text style={styles.headerText} numberOfLines={1}>
          {authorName ? `Page by ${authorName}` : 'Page'}
        </Text>
      </View>
      {!community ? (
        <HonestNotice text="This community is not on this device." />
      ) : !canvas || canvas.kind !== 'page' ? (
        <HonestNotice text="This page is not on this device yet. It arrives when a sync connects with a member who has it." />
      ) : (
        <CanvasHost community={community} canvas={canvas} />
      )}
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, marginBottom: 8 },
    backBtn: { padding: 6 },
    headerText: { color: c.text, fontSize: 17, fontWeight: '700', flex: 1 },
  });
