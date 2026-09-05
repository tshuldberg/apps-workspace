// Plan 38 Phase 5 (MOBILE): a single library's browse screen. A thin shell around
// the reusable LibraryView, resolving the verified config + curator permission
// for the library id in the route. Used for PERSONAL libraries (community
// libraries render the same LibraryView inside the channel screen's Library
// segment).

import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useMeerkatDatabase } from '../../providers/DatabaseProvider';
import { useIdentity } from '../../providers/IdentityProvider';
import { LibraryView } from '../../components/library/LibraryView';
import { canCurateLibrary, libraryDisplayName } from '../../data/library-hub-core';
import { getLibrary } from '../../data/library-store-core';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';

export default function LibraryBrowseScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { channelId } = useLocalSearchParams<{ channelId: string }>();

  const config = useMemo(() => (channelId ? getLibrary(db, channelId) : null), [db, channelId]);
  const name = useMemo(() => (config ? libraryDisplayName(db, config) : 'Library'), [db, config]);
  const canCurate = useMemo(
    () => (config ? canCurateLibrary(db, identity.publicKey, config.communityId, config.channelId) : false),
    [db, config, identity.publicKey],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/library'); }}
          hitSlop={10}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={24} color={c.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
      </View>
      {config ? (
        <LibraryView
          channelId={config.channelId}
          workspaceId={config.communityId}
          config={config}
          name={name}
          canCurate={canCurate}
        />
      ) : (
        <View style={styles.missing}>
          <Text style={styles.missingText}>This library is not on this device.</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 6 },
  headerTitle: { color: c.text, fontSize: 20, fontWeight: '800', flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  missingText: { color: c.textSecondary, fontSize: 15, textAlign: 'center', borderRadius: MK_RADIUS.md },
});
