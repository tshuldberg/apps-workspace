import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, Button, Card, SearchBar, colors, spacing } from '@mybooks/ui';

type AddMode = 'search' | 'manual';

export default function AddBookScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AddMode>('search');
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pages, setPages] = useState('');

  return (
    <>
      <Stack.Screen options={{ title: 'Add Book' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Mode toggle */}
        <View style={styles.modeRow}>
          <Button
            variant={mode === 'search' ? 'primary' : 'ghost'}
            label="Search"
            onPress={() => setMode('search')}
          />
          <Button
            variant={mode === 'manual' ? 'primary' : 'ghost'}
            label="Manual"
            onPress={() => setMode('manual')}
          />
          <Button
            variant="secondary"
            label="Scan"
            onPress={() => router.push('/scan')}
          />
        </View>

        {mode === 'search' ? (
          <>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search Open Library..."
              onScanPress={() => router.push('/scan')}
            />
            <View style={styles.placeholder}>
              <Text variant="body" color={colors.textTertiary} style={styles.placeholderText}>
                Search results will appear here. Enter a title, author, or ISBN to search Open Library.
              </Text>
            </View>
          </>
        ) : (
          <Card style={styles.formCard}>
            <Text variant="label" color={colors.textTertiary}>Book Details</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title *"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <TextInput
              value={author}
              onChangeText={setAuthor}
              placeholder="Author *"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <TextInput
              value={pages}
              onChangeText={setPages}
              placeholder="Page count"
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              style={styles.input}
            />
            <Button
              variant="primary"
              label="Add to Library"
              onPress={() => router.back()}
              disabled={!title.trim() || !author.trim()}
            />
          </Card>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  placeholder: {
    alignItems: 'center',
    paddingTop: 60,
  },
  placeholderText: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  formCard: {
    gap: spacing.sm,
  },
  input: {
    color: colors.text,
    fontFamily: 'Inter',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
  },
});
