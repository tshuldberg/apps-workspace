import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  getDocuments,
  getStarredDocuments,
  getEmergencyInfo,
  type DocumentType,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  lab_result: 'Lab Result',
  prescription: 'Prescription',
  insurance: 'Insurance',
  imaging: 'Imaging',
  vaccination: 'Vaccination',
  referral: 'Referral',
  discharge: 'Discharge',
  other: 'Other',
};

const DOC_TYPE_ICONS: Record<DocumentType, string> = {
  lab_result: '\u{1F9EA}',
  prescription: '\u{1F48A}',
  insurance: '\u{1F4CB}',
  imaging: '\u{1FA7B}',
  vaccination: '\u{1F489}',
  referral: '\u{1F4E8}',
  discharge: '\u{1F3E5}',
  other: '\u{1F4C4}',
};

const FILTER_TABS: { id: DocumentType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'lab_result', label: 'Lab Results' },
  { id: 'prescription', label: 'Rx' },
  { id: 'imaging', label: 'Imaging' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'other', label: 'Other' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function VaultScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick] = useState(0);
  const [activeFilter, setActiveFilter] = useState<DocumentType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const documents = useMemo(() => {
    try { return getDocuments(db); } catch { return []; }
  }, [db, tick]);

  const starredDocs = useMemo(() => {
    try { return getStarredDocuments(db); } catch { return []; }
  }, [db, tick]);

  const emergencyInfo = useMemo(() => {
    try { return getEmergencyInfo(db); } catch { return null; }
  }, [db, tick]);

  const hasEmergencyInfo = emergencyInfo && (
    emergencyInfo.full_name ||
    emergencyInfo.blood_type ||
    emergencyInfo.allergies ||
    emergencyInfo.emergency_contacts
  );

  const filteredDocs = useMemo(() => {
    let result = documents;
    if (activeFilter !== 'all') {
      result = result.filter((d) => d.type === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    return result;
  }, [documents, activeFilter, searchQuery]);

  const docCount = documents.length;

  // ── Empty state ──
  if (docCount === 0 && !hasEmergencyInfo) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Health Vault</Text>
          <Text style={styles.subtitle}>Secure document storage</Text>
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'\u{1F6E1}'}</Text>
          <Text style={styles.emptyTitle}>No Documents Yet</Text>
          <Text style={styles.emptySubtitle}>
            Store lab results, prescriptions, imaging, and insurance documents securely on your device.
          </Text>
        </View>

        <View style={styles.fabWrap}>
          <Pressable
            style={styles.fab}
            onPress={() => router.push('/(health)/add-document' as never)}
          >
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabText}>ADD DOCUMENT</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Title ── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Health Vault</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{docCount}</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Secure document storage</Text>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search documents..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* ── Category Filter ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <Pressable
              key={tab.id}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setActiveFilter(tab.id)}
            >
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Starred Documents ── */}
      {starredDocs.length > 0 && activeFilter === 'all' && !searchQuery.trim() && (
        <>
          <SectionHeader label="FAVORITES" title="Starred" />
          <GlassCard level={2} style={styles.cardSpacing}>
            {starredDocs.map((doc, i) => (
              <Pressable
                key={doc.id}
                style={[styles.docRow, i > 0 && styles.docDivider]}
                onPress={() => router.push(`/(health)/document-viewer?id=${doc.id}` as never)}
              >
                <View style={styles.docIconWrap}>
                  <Text style={styles.docIcon}>
                    {DOC_TYPE_ICONS[doc.type as DocumentType] ?? '\u{1F4C4}'}
                  </Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                  <View style={styles.docMeta}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {DOC_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}
                      </Text>
                    </View>
                    <Text style={styles.docSize}>{formatFileSize(doc.file_size)}</Text>
                  </View>
                </View>
                <Text style={styles.starActive}>{'\u2B50'}</Text>
              </Pressable>
            ))}
          </GlassCard>
        </>
      )}

      {/* ── All Documents ── */}
      <SectionHeader label="DOCUMENTS" title={activeFilter === 'all' ? 'All Documents' : DOC_TYPE_LABELS[activeFilter as DocumentType] ?? 'Documents'} />

      {filteredDocs.length > 0 ? (
        <GlassCard level={2} style={styles.cardSpacing}>
          {filteredDocs.map((doc, i) => (
            <Pressable
              key={doc.id}
              style={[styles.docRow, i > 0 && styles.docDivider]}
              onPress={() => router.push(`/(health)/document-viewer?id=${doc.id}` as never)}
            >
              <View style={styles.docIconWrap}>
                <Text style={styles.docIcon}>
                  {DOC_TYPE_ICONS[doc.type as DocumentType] ?? '\u{1F4C4}'}
                </Text>
              </View>
              <View style={styles.docInfo}>
                <Text style={styles.docTitle} numberOfLines={1}>{doc.title}</Text>
                <View style={styles.docMeta}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>
                      {DOC_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}
                    </Text>
                  </View>
                  {doc.document_date && (
                    <Text style={styles.docDate}>{formatDate(doc.document_date.slice(0, 10))}</Text>
                  )}
                  <Text style={styles.docSize}>{formatFileSize(doc.file_size)}</Text>
                </View>
              </View>
              {doc.is_starred === 1 && (
                <Text style={styles.starActive}>{'\u2B50'}</Text>
              )}
            </Pressable>
          ))}
        </GlassCard>
      ) : (
        <GlassCard level={2} style={styles.cardSpacing}>
          <View style={styles.noResults}>
            <Text style={styles.noResultsIcon}>{'\u{1F50D}'}</Text>
            <Text style={styles.noResultsText}>No documents match your filter</Text>
          </View>
        </GlassCard>
      )}

      {/* ── Emergency Info ── */}
      <SectionHeader label="EMERGENCY" title="ICE Card" />
      <Pressable onPress={() => router.push('/(health)/emergency-info' as never)}>
        <GlassCard level={2} style={styles.cardSpacing}>
          <View style={styles.iceRow}>
            <View style={styles.iceIconWrap}>
              <Text style={styles.iceIcon}>{'\u{1F6D1}'}</Text>
            </View>
            <View style={styles.iceInfo}>
              <Text style={styles.iceTitle}>Emergency Info</Text>
              {hasEmergencyInfo ? (
                <View style={styles.iceDetails}>
                  {emergencyInfo.blood_type && (
                    <View style={styles.iceBadge}>
                      <Text style={styles.iceBadgeText}>{emergencyInfo.blood_type}</Text>
                    </View>
                  )}
                  {emergencyInfo.allergies && (
                    <Text style={styles.iceDetail} numberOfLines={1}>
                      Allergies: {emergencyInfo.allergies.slice(0, 40)}{emergencyInfo.allergies.length > 40 ? '...' : ''}
                    </Text>
                  )}
                  {emergencyInfo.emergency_contacts && (
                    <Text style={styles.iceDetail}>Contacts configured</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.iceDetail}>
                  Add emergency contacts, allergies, blood type
                </Text>
              )}
            </View>
            <Text style={styles.chevron}>{'\u203A'}</Text>
          </View>
        </GlassCard>
      </Pressable>

      {/* ── Quick Links ── */}
      <SectionHeader label="SETTINGS" title="Quick Links" />
      <GlassCard level={2} style={styles.cardSpacing}>
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push('/(health)/health-sync-settings' as never)}
        >
          <Text style={styles.linkIcon}>{'\u{1F4F1}'}</Text>
          <View style={styles.linkInfo}>
            <Text style={styles.linkTitle}>Health Sync</Text>
            <Text style={styles.linkSub}>Configure wearable data import</Text>
          </View>
          <Text style={styles.chevron}>{'\u203A'}</Text>
        </Pressable>
        <View style={styles.docDivider} />
        <Pressable
          style={styles.linkRow}
          onPress={() => router.push('/(health)/export' as never)}
        >
          <Text style={styles.linkIcon}>{'\u{1F4E4}'}</Text>
          <View style={styles.linkInfo}>
            <Text style={styles.linkTitle}>Export Data</Text>
            <Text style={styles.linkSub}>Doctor report, CSV/JSON export</Text>
          </View>
          <Text style={styles.chevron}>{'\u203A'}</Text>
        </Pressable>
      </GlassCard>

      {/* ── FAB ── */}
      <View style={styles.fabWrap}>
        <Pressable
          style={styles.fab}
          onPress={() => router.push('/(health)/add-document' as never)}
        >
          <Text style={styles.fabIcon}>+</Text>
          <Text style={styles.fabText}>ADD DOCUMENT</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingBottom: 100,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  countBadge: {
    backgroundColor: HEALTH_ACCENT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: HEALTH_SURFACES.depth,
  },

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchInput: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
  },

  // Filter pills
  filterScroll: {
    marginTop: 12,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: HEALTH_SURFACES.lift,
  },
  filterPillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  filterPillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: HEALTH_SURFACES.depth,
  },

  // Card spacing
  cardSpacing: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  // Document rows
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  docDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: HEALTH_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docIcon: {
    fontSize: 18,
  },
  docInfo: {
    flex: 1,
    gap: 4,
  },
  docTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  docMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
  docDate: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  docSize: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  starActive: {
    fontSize: 16,
  },

  // No results
  noResults: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  noResultsIcon: {
    fontSize: 32,
  },
  noResultsText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // ICE card
  iceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  iceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${HEALTH_ACCENT}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iceIcon: {
    fontSize: 18,
  },
  iceInfo: {
    flex: 1,
    gap: 4,
  },
  iceTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: colors.text,
  },
  iceDetails: {
    gap: 4,
  },
  iceBadge: {
    alignSelf: 'flex-start',
    backgroundColor: `${HEALTH_ACCENT}20`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  iceBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: HEALTH_ACCENT,
  },
  iceDetail: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 22,
    color: colors.textSecondary,
  },

  // Quick links
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  linkIcon: {
    fontSize: 18,
  },
  linkInfo: {
    flex: 1,
    gap: 2,
  },
  linkTitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: colors.text,
  },
  linkSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // FAB
  fabWrap: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: HEALTH_ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
  },
  fabIcon: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 20,
    color: HEALTH_SURFACES.depth,
  },
  fabText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.1 * 12,
    color: HEALTH_SURFACES.depth,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 16,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptySubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
  },
});
