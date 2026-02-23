import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, SearchBar, BookCover, Button, colors, spacing } from '@mybooks/ui';
import { mockBooks, parseAuthors } from '@/data/mock';

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  // Mock: filter existing books as stand-in for Open Library search
  const results = query.length >= 2
    ? mockBooks.filter(
        (b) =>
          b.title.toLowerCase().includes(query.toLowerCase()) ||
          b.authors.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search by title, author, or ISBN"
          onScanPress={() => router.push('/scan')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {query.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="body" color={colors.textTertiary} style={styles.emptyText}>
              Search Open Library's 30M+ titles by title, author, or ISBN.
            </Text>
            <Button
              variant="secondary"
              label="Scan Barcode"
              onPress={() => router.push('/scan')}
            />
          </View>
        ) : results.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="body" color={colors.textTertiary}>
              No results for "{query}"
            </Text>
          </View>
        ) : (
          <View style={styles.results}>
            {results.map((book) => (
              <Pressable
                key={book.id}
                style={styles.resultRow}
                onPress={() => router.push(`/book/${book.id}`)}
              >
                <BookCover coverUrl={book.cover_url} size="small" title={book.title} />
                <View style={styles.resultInfo}>
                  <Text variant="bookTitle" numberOfLines={2} style={{ fontSize: 16 }}>
                    {book.title}
                  </Text>
                  <Text variant="bookAuthor" numberOfLines={1}>
                    {parseAuthors(book.authors).join(', ')}
                  </Text>
                  {book.publish_year && (
                    <Text variant="caption" color={colors.textTertiary}>
                      {book.publish_year}
                    </Text>
                  )}
                </View>
                <Button
                  variant="primary"
                  label="Add"
                  onPress={() => router.push('/book/add')}
                  style={styles.addButton}
                />
              </Pressable>
            ))}
          </View>
        )}

        <Pressable onPress={() => router.push('/book/add')} style={styles.manualLink}>
          <Text variant="caption" color={colors.accent}>
            Can't find your book? Add it manually.
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  results: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  resultRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  addButton: {
    minWidth: 60,
  },
  manualLink: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
});
