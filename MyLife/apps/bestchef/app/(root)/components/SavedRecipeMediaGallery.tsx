import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';
import { JAKARTA_FONTS, type SavedRecipeMediaRow } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { pickPhoto } from '../utils/media';

interface SavedRecipeMediaGalleryProps {
  media: SavedRecipeMediaRow[];
  onAdd: (uri: string) => void | Promise<void>;
  onRemove: (id: string) => void | Promise<void>;
  onReplace: (id: string, uri: string) => void | Promise<void>;
  onReorder: (orderedIds: string[]) => void | Promise<void>;
}

const ADD_TILE_KEY = '__add__';

export function SavedRecipeMediaGallery({
  media,
  onAdd,
  onRemove,
  onReplace,
  onReorder,
}: SavedRecipeMediaGalleryProps) {
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  const handlePickAndAdd = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        const uri = await pickPhoto(source, { aspect: [4, 3], quality: 0.85 }, t);
        if (uri) await onAdd(uri);
      } catch (err) {
        const message = err instanceof Error ? err.message : t('media_pick_failed');
        Alert.alert(t('Error'), message, [
          { text: t('media_open_settings'), onPress: () => { void Linking.openSettings(); } },
          { text: t('Cancel'), style: 'cancel' },
        ]);
      }
    },
    [onAdd, t],
  );

  const handlePickAndReplace = useCallback(
    async (id: string, source: 'camera' | 'library') => {
      try {
        const uri = await pickPhoto(source, { aspect: [4, 3], quality: 0.85 }, t);
        if (uri) await onReplace(id, uri);
      } catch (err) {
        const message = err instanceof Error ? err.message : t('media_pick_failed');
        Alert.alert(t('Error'), message, [
          { text: t('media_open_settings'), onPress: () => { void Linking.openSettings(); } },
          { text: t('Cancel'), style: 'cancel' },
        ]);
      }
    },
    [onReplace, t],
  );

  const confirmRemove = useCallback(
    (id: string) => {
      Alert.alert(t('media_remove_confirm'), undefined, [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('media_remove'),
          style: 'destructive',
          onPress: () => {
            void onRemove(id);
          },
        },
      ]);
    },
    [onRemove, t],
  );

  const showAddSheet = useCallback(() => {
    const addOptions = [t('media_take_photo'), t('media_choose_from_library'), t('Cancel')];
    const cancelIndex = 2;
    const handle = (index: number) => {
      if (index === cancelIndex) return;
      const source = index === 0 ? 'camera' : 'library';
      void handlePickAndAdd(source);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: addOptions, cancelButtonIndex: cancelIndex }, handle);
    } else {
      Alert.alert(t('Change Photo'), t('Choose a source'), [
        { text: t('media_take_photo'), onPress: () => handle(0) },
        { text: t('media_choose_from_library'), onPress: () => handle(1) },
        { text: t('Cancel'), style: 'cancel' },
      ]);
    }
  }, [handlePickAndAdd, t]);

  const showItemSheet = useCallback(
    (id: string) => {
      const options = [
        t('media_take_photo'),
        t('media_choose_from_library'),
        t('media_replace'),
        t('media_remove'),
        t('Cancel'),
      ];
      const cancelIndex = 4;
      const destructiveIndex = 3;
      const handle = (index: number) => {
        if (index === cancelIndex) return;
        if (index === 0) void handlePickAndAdd('camera');
        else if (index === 1) void handlePickAndAdd('library');
        else if (index === 2) {
          Alert.alert(t('media_replace'), t('Choose a source'), [
            { text: t('media_take_photo'), onPress: () => { void handlePickAndReplace(id, 'camera'); } },
            { text: t('media_choose_from_library'), onPress: () => { void handlePickAndReplace(id, 'library'); } },
            { text: t('Cancel'), style: 'cancel' },
          ]);
        } else if (index === 3) confirmRemove(id);
      };
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: destructiveIndex },
          handle,
        );
      } else {
        Alert.alert(t('Change Photo'), t('Choose a source'), [
          { text: t('media_take_photo'), onPress: () => handle(0) },
          { text: t('media_choose_from_library'), onPress: () => handle(1) },
          { text: t('media_replace'), onPress: () => handle(2) },
          { text: t('media_remove'), style: 'destructive', onPress: () => handle(3) },
          { text: t('Cancel'), style: 'cancel' },
        ]);
      }
    },
    [confirmRemove, handlePickAndAdd, handlePickAndReplace, t],
  );

  const handleLongPressTile = useCallback(
    (id: string) => {
      if (reorderingId === id) {
        setReorderingId(null);
        return;
      }
      if (reorderingId) {
        // Swap reorderingId with this tile.
        const orderedIds = media.map((row) => row.id);
        const fromIdx = orderedIds.indexOf(reorderingId);
        const toIdx = orderedIds.indexOf(id);
        if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
          const next = [...orderedIds];
          next.splice(toIdx, 0, ...next.splice(fromIdx, 1));
          void onReorder(next);
        }
        setReorderingId(null);
        return;
      }
      setReorderingId(id);
    },
    [media, onReorder, reorderingId],
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {media.map((row) => {
          const isActive = reorderingId === row.id;
          return (
            <Pressable
              key={row.id}
              onPress={() => showItemSheet(row.id)}
              onLongPress={() => handleLongPressTile(row.id)}
              accessibilityRole="button"
              accessibilityLabel={t('media_replace')}
              style={({ pressed }) => [
                styles.tile,
                {
                  borderColor: isActive ? tc.accent : theme.glass.cardBorder,
                  borderWidth: isActive ? 2 : 1,
                  backgroundColor: theme.glass.cardFill,
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Image source={{ uri: row.uri }} style={styles.tileImage} contentFit="cover" />
            </Pressable>
          );
        })}
        <Pressable
          key={ADD_TILE_KEY}
          onPress={showAddSheet}
          accessibilityRole="button"
          accessibilityLabel={t('media_take_photo')}
          style={({ pressed }) => [
            styles.tile,
            styles.addTile,
            {
              borderColor: theme.glass.cardBorder,
              backgroundColor: theme.glass.cardFill,
            },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <View style={[styles.addIconWrap, { backgroundColor: `${tc.accent}1A` }]}>
            <Plus size={22} color={tc.accent} strokeWidth={2.4} />
          </View>
          <Text style={[styles.addLabel, { color: tc.textSecondary }]} numberOfLines={1}>
            {t('media_take_photo')}
          </Text>
        </Pressable>
      </ScrollView>
      {reorderingId ? (
        <Text style={[styles.reorderHint, { color: tc.textTertiary }]}>
          {t('media_reorder_hint')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { gap: 10, paddingVertical: 4 },
  tile: {
    width: 116,
    height: 86,
    borderRadius: 14,
    overflow: 'hidden',
  },
  tileImage: { width: '100%', height: '100%' },
  addTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  addIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    textAlign: 'center',
  },
  reorderHint: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    textAlign: 'center',
  },
});
