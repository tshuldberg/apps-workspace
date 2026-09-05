import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from 'lucide-react-native';
import {
  MODULE_METADATA,
  MODULE_ICONS,
  type ModuleId,
} from '@mylife/module-registry';
import { useEnabledModules } from '@mylife/module-registry';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  ensureSearchTables,
  indexAllModules,
  search,
  searchRecent,
  type SearchResult,
} from '@mylife/search';
import { HUB_TAB_BAR_CLEARANCE } from './_layout';
import {
  Text,
  colors,
  surfaceTiers,
  useThemeColors,
  useThemeLayout,
  type BaseColors,
} from '@mylife/ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('');
}

function getIcon(name: string) {
  const key = toPascalCase(name);
  return (icons as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[key] ?? null;
}

/** Group results by moduleId. */
function groupByModule(results: SearchResult[]): Map<string, SearchResult[]> {
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = groups.get(r.moduleId);
    if (existing) {
      existing.push(r);
    } else {
      groups.set(r.moduleId, [r]);
    }
  }
  return groups;
}

/** Render snippet with bold match markers highlighted in the hub accent. */
function renderSnippet(snippet: string, accent: string, secondary: string) {
  const parts = snippet.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Text key={i} variant="caption" color={accent} style={{ fontWeight: '700' }}>
        {part}
      </Text>
    ) : (
      <Text key={i} variant="caption" color={secondary}>
        {part}
      </Text>
    ),
  );
}

// ---------------------------------------------------------------------------
// Search Screen
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const router = useRouter();
  const db = useDatabase();
  const enabledModules = useEnabledModules();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [indexReady, setIndexReady] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const themeColors = useThemeColors();
  const themeLayout = useThemeLayout();
  const spacing = themeLayout.spacing;
  const s = useMemo(() => makeStyles(themeColors, spacing), [themeColors, spacing]);

  // Build index on mount (once)
  const ensureIndex = useCallback(() => {
    if (indexReady) return;
    try {
      ensureSearchTables(db);
      indexAllModules(db, enabledModules);
      setIndexReady(true);
    } catch {
      // Index may already exist
      setIndexReady(true);
    }
  }, [db, enabledModules, indexReady]);

  // Load recent items on first render
  useMemo(() => {
    ensureIndex();
    try {
      const recent = searchRecent(db, { limit: 15 });
      setResults(recent);
    } catch {
      // Search tables may not exist yet
    }
  }, []);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        ensureIndex();
        try {
          if (!text.trim()) {
            const recent = searchRecent(db, { limit: 15 });
            setResults(recent);
            setHasSearched(false);
          } else {
            const found = search(db, text, { limit: 30 });
            setResults(found);
            setHasSearched(true);
          }
        } catch {
          setResults([]);
          setHasSearched(true);
        }
      }, 200);
    },
    [db, ensureIndex],
  );

  const handleResultPress = useCallback(
    (result: SearchResult) => {
      const moduleId = result.moduleId as ModuleId;
      // Navigate to the module root -- deep linking to specific items
      // varies by module, so we go to the module home
      router.push(`/(${moduleId})` as never);
    },
    [router],
  );

  const grouped = useMemo(() => groupByModule(results), [results]);
  const SearchIcon = getIcon('search');
  const XIcon = getIcon('x');

  return (
    <View style={s.root}>
      {/* Search Bar */}
      <View style={s.searchBarContainer}>
        <View style={s.searchBar}>
          {SearchIcon && (
            <SearchIcon
              size={20}
              color={isFocused ? themeColors.primaryContainer : colors.textTertiary}
              strokeWidth={1.8}
            />
          )}
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Search across all modules..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={handleSearch}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                setQuery('');
                handleSearch('');
                inputRef.current?.focus();
              }}
              hitSlop={8}
            >
              {XIcon && <XIcon size={16} color={colors.textTertiary} strokeWidth={1.8} />}
            </Pressable>
          ) : (
            <View style={s.globalBadge}>
              <Text style={s.globalBadgeText}>GLOBAL</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Recent activity section */}
        {!hasSearched && results.length > 0 && (
          <>
            <Text style={s.sectionLabel}>RECENT ACTIVITY</Text>
            <View style={s.recentContainer}>
              {results.map((item, idx) => {
                const meta = MODULE_METADATA[item.moduleId as ModuleId];
                const accentColor = meta?.accentColor ?? themeColors.textSecondary;
                const iconName = MODULE_ICONS[item.moduleId] ?? 'circle';
                const ItemIcon = getIcon(iconName);
                const opacity = Math.max(0.4, 1 - idx * 0.04);

                return (
                  <Pressable
                    key={`${item.moduleId}-${item.itemId}`}
                    style={[s.activityItem, idx < results.length - 1 && s.activityItemBorder]}
                    onPress={() => handleResultPress(item)}
                  >
                    <View style={{ opacity }}>
                      <View style={s.activityRow}>
                        {/* Status dot with glow */}
                        <View
                          style={[
                            s.statusDot,
                            {
                              backgroundColor: accentColor,
                              shadowColor: accentColor,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 0.5,
                              shadowRadius: 4,
                            },
                          ]}
                        />
                        {/* Module icon */}
                        {ItemIcon && (
                          <ItemIcon size={14} color={themeColors.textSecondary} strokeWidth={1.5} />
                        )}
                        {/* Action text */}
                        <Text
                          numberOfLines={1}
                          style={s.activityText}
                        >
                          {item.title}
                        </Text>
                        {/* Timestamp */}
                        <Text style={s.activityTimestamp}>
                          {item.itemType}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* Search results section label */}
        {hasSearched && results.length > 0 && (
          <Text style={s.sectionLabel}>
            {results.length} RESULT{results.length !== 1 ? 'S' : ''}
          </Text>
        )}

        {/* Results grouped by module */}
        {hasSearched &&
          Array.from(grouped.entries()).map(([moduleId, items]) => {
            const meta = MODULE_METADATA[moduleId as ModuleId];
            const accentColor = meta?.accentColor ?? themeColors.accent;
            const iconName = MODULE_ICONS[moduleId] ?? 'circle';
            const ModuleIcon = getIcon(iconName);

            return (
              <View key={moduleId} style={s.moduleGroup}>
                {/* Module header */}
                <View style={s.moduleHeader}>
                  {ModuleIcon && (
                    <ModuleIcon size={14} color={accentColor} strokeWidth={1.8} />
                  )}
                  <Text style={[s.moduleHeaderText, { color: themeColors.text }]}>
                    {(meta?.name ?? moduleId).toUpperCase()}
                  </Text>
                </View>
                {/* Gradient divider */}
                <LinearGradient
                  colors={[surfaceTiers.high, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.gradientDivider}
                />

                {/* Result items */}
                {items.map((item) => (
                  <Pressable
                    key={`${item.moduleId}-${item.itemId}`}
                    style={s.resultItem}
                    onPress={() => handleResultPress(item)}
                  >
                    <View style={s.resultContent}>
                      <Text
                        numberOfLines={1}
                        style={s.resultTitle}
                      >
                        {item.title}
                      </Text>
                      {item.snippet ? (
                        <Text numberOfLines={2} style={{ lineHeight: 18 }}>
                          {renderSnippet(
                            item.snippet,
                            themeColors.primaryContainer,
                            themeColors.textSecondary,
                          )}
                        </Text>
                      ) : null}
                      <Text style={s.resultType}>
                        {item.itemType}
                      </Text>
                    </View>
                    {(() => {
                      const ChevronRight = getIcon('chevron-right');
                      return ChevronRight ? (
                        <ChevronRight size={14} color={colors.textTertiary} strokeWidth={1.5} />
                      ) : null;
                    })()}
                  </Pressable>
                ))}
              </View>
            );
          })}

        {/* No results state */}
        {hasSearched && results.length === 0 && query.trim().length > 0 && (
          <View style={s.emptyState}>
            {(() => {
              const SearchXIcon = getIcon('search-x');
              return SearchXIcon ? (
                <SearchXIcon size={40} color={themeColors.textSecondary} strokeWidth={1.2} />
              ) : null;
            })()}
            <Text variant="subheading" color={themeColors.textSecondary} style={{ marginTop: 12 }}>
              No results for &quot;{query}&quot;
            </Text>
            <Text variant="caption" color={colors.textTertiary} style={{ textAlign: 'center', marginTop: 4 }}>
              Try a different search term or check your enabled modules
            </Text>
          </View>
        )}

        {/* Empty recent state */}
        {!hasSearched && results.length === 0 && (
          <View style={s.emptyState}>
            {SearchIcon && <SearchIcon size={40} color={themeColors.textSecondary} strokeWidth={1.2} />}
            <Text variant="subheading" color={themeColors.textSecondary} style={{ marginTop: 12 }}>
              Search your life
            </Text>
            <Text variant="caption" color={colors.textTertiary} style={{ textAlign: 'center', marginTop: 4 }}>
              Find anything across your enabled modules
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function makeStyles(
  themeColors: BaseColors,
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number },
) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: themeColors.background,
    },

    // -- Search bar --
    searchBarContainer: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: surfaceTiers.highest,
      borderRadius: 999,
      paddingHorizontal: spacing.md,
      height: 56,
    },
    input: {
      flex: 1,
      fontSize: 18,
      fontWeight: '300',
      color: themeColors.text,
      padding: 0,
    },
    globalBadge: {
      backgroundColor: `${themeColors.primaryContainer}1A`,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
    },
    globalBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      color: themeColors.primaryContainer,
      textTransform: 'uppercase',
    },

    // -- Scroll --
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingBottom: HUB_TAB_BAR_CLEARANCE,
    },

    // -- Section label --
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 2,
      color: themeColors.textSecondary,
      marginBottom: spacing.sm,
      marginTop: spacing.xs,
    },

    // -- Recent activity --
    recentContainer: {
      backgroundColor: surfaceTiers.low,
      borderRadius: 16,
      padding: spacing.md,
    },
    activityItem: {
      paddingVertical: 10,
    },
    activityItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    activityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    activityText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '500',
      color: themeColors.text,
    },
    activityTimestamp: {
      fontSize: 10,
      color: surfaceTiers.highest,
    },

    // -- Module groups (search results) --
    moduleGroup: {
      marginBottom: spacing.md,
    },
    moduleHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    moduleHeaderText: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    gradientDivider: {
      height: 1,
      marginBottom: spacing.sm,
    },
    resultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: surfaceTiers.high,
      borderRadius: 12,
      padding: 14,
      marginBottom: spacing.xs,
    },
    resultContent: {
      flex: 1,
      gap: 2,
    },
    resultTitle: {
      fontSize: 15,
      fontWeight: '500',
      color: themeColors.text,
    },
    resultType: {
      fontSize: 11,
      // textTertiary not in BaseColors; keep static
      color: colors.textTertiary,
      marginTop: 2,
    },

    // -- Empty states --
    emptyState: {
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: spacing.lg,
    },
  });
}
