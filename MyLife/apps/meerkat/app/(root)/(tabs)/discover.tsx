import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Search } from 'lucide-react-native';
import type { PublicCategory } from '@mylife/sync';
import { useMeerkatDatabase } from '../providers/DatabaseProvider';
import { Button, HonestNotice, SectionHeader } from '../components/kit';
import { type MkColors, MK_RADIUS, shortHex } from '../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../providers/AppThemeProvider';
import {
  getDirectoryCacheEntries,
  probePublicDirectory,
  type ProbePublicDirectoryResult,
} from '../data/public-directory-client';
import {
  DISCOVER_COPY,
  PUBLIC_CATEGORIES,
  PUBLIC_CATEGORY_LABELS,
  formatPublicMetric,
  rankTrending,
  selectDiscoverState,
  stillVerifyingLabel,
  type VerifiedPublicEntry,
} from '../data/discover-core';

export default function DiscoverScreen() {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();

  const [category, setCategory] = useState<PublicCategory | null>(null);
  const [searchText, setSearchText] = useState('');
  const [shownEntries, setShownEntries] = useState<VerifiedPublicEntry[]>([]);
  const [probe, setProbe] = useState<ProbePublicDirectoryResult | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const probeSeq = useRef(0);

  const runProbe = useCallback(
    (opts: { category: PublicCategory | null; terms: string[] }) => {
      const seq = probeSeq.current + 1;
      probeSeq.current = seq;
      // Warm cache first so a refresh shows verified rows immediately (Partial),
      // then a real probe resolves the live state.
      const warm = getDirectoryCacheEntries(db, opts.category ?? undefined);
      setShownEntries(warm);
      setInFlight(true);
      void (async () => {
        const result = await probePublicDirectory(db, {
          category: opts.terms.length > 0 ? undefined : opts.category ?? undefined,
          searchTerms: opts.terms,
        });
        if (probeSeq.current !== seq) return; // a newer probe superseded this one
        setProbe(result);
        if (result.respondedAt !== null) setShownEntries(result.entries);
        setInFlight(false);
      })();
    },
    [db],
  );

  useFocusEffect(
    useCallback(() => {
      const terms = searchText.trim().length > 0 ? searchText.trim().split(/\s+/) : [];
      runProbe({ category, terms });
      // Re-probe only when focus, category, or committed search changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category]),
  );

  const onSelectCategory = useCallback((next: PublicCategory) => {
    setSearchText('');
    setCategory((current) => (current === next ? null : next));
  }, []);

  const onSubmitSearch = useCallback(() => {
    const terms = searchText.trim().length > 0 ? searchText.trim().split(/\s+/) : [];
    setCategory(null);
    runProbe({ category: null, terms });
  }, [runProbe, searchText]);

  const onRetry = useCallback(() => {
    const terms = searchText.trim().length > 0 ? searchText.trim().split(/\s+/) : [];
    runProbe({ category, terms });
  }, [runProbe, category, searchText]);

  const state = useMemo(
    () => selectDiscoverState({ inFlight, shownEntries, probe }),
    [inFlight, shownEntries, probe],
  );

  const openPublication = useCallback(
    (entry: VerifiedPublicEntry) => {
      router.push({
        pathname: '/public/[publicationId]',
        params: { publicationId: entry.publication_id },
      });
    },
    [router],
  );

  const trending = useMemo(() => {
    if (state.kind === 'success' || state.kind === 'partial') return rankTrending(state.entries);
    return [];
  }, [state]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <Text style={styles.title}>{DISCOVER_COPY.headerTitle}</Text>
      <Text style={styles.subtitle}>{DISCOVER_COPY.headerSubtitle}</Text>

      <View style={styles.searchRow}>
        <Search size={17} color={c.textTertiary} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={onSubmitSearch}
          placeholder={DISCOVER_COPY.searchPlaceholder}
          placeholderTextColor={c.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={DISCOVER_COPY.searchPlaceholder}
        />
      </View>

      <View style={styles.chipsWrap}>
        {PUBLIC_CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <Pressable
              key={cat}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Category ${PUBLIC_CATEGORY_LABELS[cat]}`}
              onPress={() => onSelectCategory(cat)}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {PUBLIC_CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        <SectionHeader title={DISCOVER_COPY.trendingTitle} hint={DISCOVER_COPY.trendingHint} />

        {state.kind === 'loading' ? (
          <View style={styles.statePanel}>
            <ActivityIndicator color={c.accent} />
            <Text style={styles.stateText}>{DISCOVER_COPY.loading}</Text>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : null}

        {state.kind === 'error' ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>{DISCOVER_COPY.errorTitle}</Text>
            <Text style={styles.stateText}>{DISCOVER_COPY.errorBody}</Text>
            <Button title={DISCOVER_COPY.errorRetry} onPress={onRetry} />
          </View>
        ) : null}

        {state.kind === 'empty' ? (
          <View style={styles.statePanel}>
            <Text style={styles.stateTitle}>{DISCOVER_COPY.emptyTitle}</Text>
            <Text style={styles.stateText}>{DISCOVER_COPY.emptyBody}</Text>
          </View>
        ) : null}

        {state.kind === 'success' || state.kind === 'partial'
          ? trending.map((entry) => (
              <ResultCard key={entry.publication_id} entry={entry} onPress={() => openPublication(entry)} />
            ))
          : null}

        {state.kind === 'partial' ? (
          <Text style={styles.partialFooter}>{stillVerifyingLabel(state.verifying)}</Text>
        ) : null}
      </View>

      <HonestNotice text={DISCOVER_COPY.honestNotice} />

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  );
}

function ResultCard({ entry, onPress }: { entry: VerifiedPublicEntry; onPress: () => void }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const categoryLabel = PUBLIC_CATEGORY_LABELS[entry.category as PublicCategory] ?? entry.category;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open public ${entry.kind}: ${entry.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle} numberOfLines={2}>{entry.title}</Text>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{categoryLabel}</Text>
        </View>
      </View>
      {entry.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>{entry.description}</Text>
      ) : null}
      <Text style={styles.cardOwner} numberOfLines={1}>by {shortHex(entry.owner_device_id)}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMetric} numberOfLines={1}>{formatPublicMetric(entry)}</Text>
        <ChevronRight size={15} color={c.accent} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
}

function SkeletonCard() {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonLineWide} />
      <View style={styles.skeletonLine} />
      <View style={styles.skeletonLineShort} />
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 14 },
  title: { color: c.text, fontSize: 30, fontWeight: '800' },
  subtitle: { color: c.textSecondary, fontSize: 14, marginTop: -6, lineHeight: 20 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: c.text,
    fontSize: 15,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 34,
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 13,
    paddingVertical: 7,
    justifyContent: 'center',
  },
  chipActive: {
    borderColor: c.accent,
    backgroundColor: c.glass,
  },
  chipText: { color: c.textSecondary, fontSize: 12.5, fontWeight: '800' },
  chipTextActive: { color: c.accent },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 16,
    gap: 12,
  },
  statePanel: {
    backgroundColor: c.surfaceElevated,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.md,
    padding: 14,
    gap: 10,
    alignItems: 'flex-start',
  },
  stateTitle: { color: c.text, fontSize: 16, fontWeight: '800' },
  stateText: { color: c.textSecondary, fontSize: 13.5, lineHeight: 20 },
  partialFooter: { color: c.textTertiary, fontSize: 12.5, fontWeight: '700' },
  card: {
    borderRadius: MK_RADIUS.md,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: c.surfaceElevated,
    padding: 12,
    gap: 7,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardTitle: { flex: 1, minWidth: 0, color: c.text, fontSize: 16, fontWeight: '800', lineHeight: 21 },
  categoryPill: {
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillText: { color: c.textSecondary, fontSize: 10.5, fontWeight: '800' },
  cardDescription: { color: c.textSecondary, fontSize: 13.5, lineHeight: 19 },
  cardOwner: { color: c.textTertiary, fontSize: 12 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cardMetric: { flex: 1, minWidth: 0, color: c.textSecondary, fontSize: 12.5, fontWeight: '700' },
  skeleton: {
    alignSelf: 'stretch',
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  skeletonLineWide: { height: 14, width: '75%', borderRadius: 6, backgroundColor: c.surfaceHigh },
  skeletonLine: { height: 11, width: '90%', borderRadius: 6, backgroundColor: c.surfaceHigh },
  skeletonLineShort: { height: 11, width: '45%', borderRadius: 6, backgroundColor: c.surfaceHigh },
  pressed: { opacity: 0.72 },
});
