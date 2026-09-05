import React from 'react';
import { View, FlatList, Pressable, Image, StyleSheet } from 'react-native';
import { Card, Text, colors, spacing } from '@mylife/ui';

const STOKE_EMOJI = ['', '\u{1F610}', '\u{1F642}', '\u{1F919}', '\u{1F525}', '\u{1F92F}'];

interface FeedItem {
  id: string;
  userName: string;
  avatarUrl?: string;
  spotName: string;
  caption?: string;
  waveCount?: number;
  stokeLevel: number;
  likesCount: number;
  commentsCount: number;
  photoUrl?: string;
  createdAt: string;
}

const PLACEHOLDER_FEED: FeedItem[] = [
  {
    id: '1',
    userName: 'KellySlater',
    spotName: 'Pipeline',
    caption: 'Perfect morning barrels',
    waveCount: 8,
    stokeLevel: 5,
    likesCount: 42,
    commentsCount: 7,
    createdAt: '2h ago',
  },
  {
    id: '2',
    userName: 'SurfJane',
    spotName: 'Ocean Beach',
    caption: 'Fun waist-high session',
    waveCount: 15,
    stokeLevel: 3,
    likesCount: 12,
    commentsCount: 2,
    createdAt: '4h ago',
  },
];

function SessionCard({ item }: { item: FeedItem }) {
  return (
    <Card>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text variant="body" color={colors.modules.surf}>{item.userName[0]}</Text>
          )}
        </View>
        <View style={styles.headerText}>
          <Text variant="body">{item.userName}</Text>
          <Text variant="caption" color={colors.modules.surf}>{item.spotName}</Text>
        </View>
        <Text variant="caption" color={colors.textTertiary}>{item.createdAt}</Text>
      </View>

      {item.photoUrl && (
        <Image source={{ uri: item.photoUrl }} style={styles.photo} resizeMode="cover" />
      )}

      {item.caption && <Text variant="body" style={styles.caption}>{item.caption}</Text>}

      <View style={styles.footer}>
        <View style={styles.statRow}>
          <Text variant="body">{STOKE_EMOJI[item.stokeLevel]}</Text>
          {item.waveCount != null && (
            <Text variant="caption" color={colors.textSecondary}>{item.waveCount} waves</Text>
          )}
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.actionBtn}>
            <Text variant="caption" color={colors.textSecondary}>{'\u{1F919}'} {item.likesCount}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn}>
            <Text variant="caption" color={colors.textSecondary}>{'\u{1F4AC}'} {item.commentsCount}</Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={PLACEHOLDER_FEED}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SessionCard item={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text variant="heading">Surf Feed</Text>
            <Text variant="caption" color={colors.textSecondary}>Sessions from your crew</Text>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <View style={styles.empty}>
              <Text variant="body">{'\u{1F30A}'}</Text>
              <Text variant="subheading">Your feed is waiting</Text>
              <Text variant="caption" color={colors.textSecondary}>
                Follow surfers to see their sessions here
              </Text>
            </View>
          </Card>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  header: { gap: spacing.xs, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  headerText: { flex: 1, marginLeft: spacing.sm },
  photo: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, marginBottom: spacing.sm },
  caption: { marginBottom: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
});
