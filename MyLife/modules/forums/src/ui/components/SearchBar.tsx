import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
  FR_SURFACES,
  FR_TEXT,
  FR_TEXT_MUTED,
  FR_TEXT_SECONDARY,
  FR_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: (value: string) => void;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search threads, replies, communities, users',
  onSubmit,
  autoFocus = false,
}: SearchBarProps) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (draft !== value) {
        onChange(draft);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [draft, onChange, value]);

  return (
    <View style={styles.container}>
      <MaterialSymbol name="search" size={18} color={FR_TEXT_MUTED} />
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={FR_TEXT_MUTED}
        onSubmitEditing={() => onSubmit?.(draft)}
        autoFocus={autoFocus}
        style={styles.input}
      />
      {draft.length > 0 ? (
        <Pressable onPress={() => setDraft('')}>
          <MaterialSymbol name="close" size={18} color={FR_TEXT_SECONDARY} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: FR_SURFACES.highest,
  },
  input: {
    ...FR_TYPOGRAPHY.bodyMd,
    color: FR_TEXT,
    flex: 1,
  },
});
