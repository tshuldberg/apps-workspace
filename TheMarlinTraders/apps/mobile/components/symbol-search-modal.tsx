import React, { useState, useCallback } from 'react'
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, fontSize } from '../constants/theme'

export interface SymbolSearchResult {
  symbol: string
  name: string
  exchange: string
  type: string
}

interface SymbolSearchModalProps {
  visible: boolean
  onClose: () => void
  onSelect: (result: SymbolSearchResult) => void
  title?: string
}

const POPULAR_SYMBOLS: SymbolSearchResult[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', type: 'stock' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE', type: 'etf' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ', type: 'etf' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ', type: 'stock' },
]

export function SymbolSearchModal({
  visible,
  onClose,
  onSelect,
  title = 'Search Symbol',
}: SymbolSearchModalProps) {
  const [query, setQuery] = useState('')

  const filteredSymbols = query.length === 0
    ? POPULAR_SYMBOLS
    : POPULAR_SYMBOLS.filter(
        (s) =>
          s.symbol.toLowerCase().includes(query.toLowerCase()) ||
          s.name.toLowerCase().includes(query.toLowerCase()),
      )

  const handleSelect = useCallback(
    (result: SymbolSearchResult) => {
      onSelect(result)
      setQuery('')
      onClose()
    },
    [onSelect, onClose],
  )

  const renderItem = useCallback(
    ({ item }: { item: SymbolSearchResult }) => (
      <TouchableOpacity
        style={styles.resultRow}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.resultLeft}>
          <Text style={styles.resultSymbol}>{item.symbol}</Text>
          <Text style={styles.resultName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={styles.resultRight}>
          <Text style={styles.resultExchange}>{item.exchange}</Text>
          <Text style={styles.resultType}>{item.type.toUpperCase()}</Text>
        </View>
      </TouchableOpacity>
    ),
    [handleSelect],
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Symbol or company name..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Section label */}
        <Text style={styles.sectionLabel}>
          {query.length === 0 ? 'Popular' : `Results (${filteredSymbols.length})`}
        </Text>

        {/* Results */}
        <FlatList
          data={filteredSymbols}
          keyExtractor={(item) => item.symbol}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No symbols found</Text>
            </View>
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navyBlack,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.navyDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    height: 44,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    height: '100%',
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  resultSymbol: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resultName: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  resultRight: {
    alignItems: 'flex-end',
  },
  resultExchange: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  resultType: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
})
