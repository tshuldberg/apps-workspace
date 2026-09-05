import { useCallback, useState } from 'react';
import { View, FlatList, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, Card, Button, EmptyState } from '@mylife/ui';
import { getPins, type PinRow } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

export default function PinsScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [pins, setPins] = useState<PinRow[]>([]);

  const refresh = useCallback(() => {
    setPins(getPins(db));
  }, [db]);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text variant="heading">Pins</Text>
      </View>
      {pins.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="📍"
            title="No saved spots yet"
            message="Pin a gym, bar, or venue to keep it handy."
            actionLabel="Add spot"
            onAction={() => router.push('/pin/new')}
            accentColor="#E4572E"
          />
        </View>
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open spot ${item.name}`}
              onPress={() => router.push(`/pin/${item.id}`)}
            >
              <Card>
                <Text variant="subheading">{item.name}</Text>
                {item.category ? (
                  <Text variant="caption" color="#9F8E81">{item.category}</Text>
                ) : null}
                {item.neighborhood ? (
                  <Text variant="body" color="#D6C3B5">{item.neighborhood}</Text>
                ) : null}
                {item.is_shareable === 1 ? (
                  <Text variant="caption" color="#E4572E">Shareable in plans</Text>
                ) : null}
              </Card>
            </Pressable>
          )}
        />
      )}
      {pins.length > 0 ? (
        <View style={styles.fab}>
          <Button title="Add spot" onPress={() => router.push('/pin/new')} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131318' },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  list: { padding: 16, gap: 12, paddingBottom: 96 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
