// Tags editor for a pin or plan (Phase 4). Tags ride on the shared hub tag
// substrate via @mylife/manhattan's notes-bridge, so they are cross-module
// queryable. Markdown notes proper (via MyNotes) reuse the same entity tag and
// are a later addition; this surface delivers the cross-module tagging.
import { useCallback, useState } from 'react';
import { View, TextInput, Pressable, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Text, Card } from '@mylife/ui';
import { getEntityTags, setEntityTags, removeEntityTag } from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';

export function EntityTags({
  entityType,
  entityId,
}: {
  entityType: 'pin' | 'plan';
  entityId: string;
}) {
  const db = useManhattanDatabase();
  const [tags, setTags] = useState<string[]>(() => getEntityTags(db, entityType, entityId));
  const [draft, setDraft] = useState('');

  const refresh = useCallback(
    () => setTags(getEntityTags(db, entityType, entityId)),
    [db, entityType, entityId],
  );

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  const addTag = () => {
    const label = draft.trim().toLowerCase();
    if (!label) return;
    setEntityTags(db, entityType, entityId, [label]);
    setDraft('');
    refresh();
  };

  const remove = (label: string) => {
    removeEntityTag(db, entityType, entityId, label);
    refresh();
  };

  return (
    <Card>
      <Text variant="label" color="#9F8E81">Tags</Text>
      <View style={styles.tagRow}>
        {tags.length === 0 ? (
          <Text variant="caption" color="#52443A">No tags yet.</Text>
        ) : (
          tags.map((t) => (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={`Remove tag ${t}`}
              style={styles.tag}
              onPress={() => remove(t)}
            >
              <Text variant="caption" color="#D6C3B5">{t}  ✕</Text>
            </Pressable>
          ))
        )}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a tag"
          placeholderTextColor="#52443A"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={addTag}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.addBtn, !draft.trim() && styles.addBtnDisabled]}
          onPress={addTag}
          disabled={!draft.trim()}
        >
          <Text variant="caption" color="#131318">Add</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 12 },
  tag: {
    backgroundColor: '#2A292F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#E4E1E9',
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: '#E4572E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtnDisabled: { opacity: 0.4 },
});
