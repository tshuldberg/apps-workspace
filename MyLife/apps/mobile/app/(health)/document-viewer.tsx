import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Text, colors } from '@mylife/ui';
import {
  getDocument,
  updateDocument,
  deleteDocument,
  type DocumentType,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  SectionHeader,
  GlassCard,
  GradientButton,
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

export default function DocumentViewerScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);

  const doc = useMemo(() => {
    if (!id) return null;
    try { return getDocument(db, id); } catch { return null; }
  }, [db, id, tick]);

  if (!doc) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{'\u{1F4C4}'}</Text>
          <Text style={styles.emptyTitle}>Document Not Found</Text>
          <Text style={styles.emptySubtitle}>
            This document may have been deleted or is no longer available.
          </Text>
        </View>
      </ScrollView>
    );
  }

  const isImage = doc.mime_type.startsWith('image/');
  const imageUri = isImage && doc.content
    ? `data:${doc.mime_type};base64,${Buffer.from(doc.content).toString('base64')}`
    : null;

  const handleToggleStar = () => {
    try {
      updateDocument(db, doc.id, { is_starred: !doc.is_starred });
      setTick((v) => v + 1);
    } catch {
      Alert.alert('Error', 'Failed to update document.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Document', `Delete "${doc.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteDocument(db, doc.id);
            router.back();
          } catch {
            Alert.alert('Error', 'Failed to delete document.');
          }
        },
      },
    ]);
  };

  const typeLabel = DOC_TYPE_LABELS[doc.type as DocumentType] ?? doc.type;
  const typeIcon = DOC_TYPE_ICONS[doc.type as DocumentType] ?? '\u{1F4C4}';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>{doc.title}</Text>
        <View style={styles.metaRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeIcon}>{typeIcon}</Text>
            <Text style={styles.typeBadgeText}>{typeLabel}</Text>
          </View>
          <Text style={styles.metaText}>{formatFileSize(doc.file_size)}</Text>
          {doc.document_date && (
            <Text style={styles.metaText}>{formatDate(doc.document_date.slice(0, 10))}</Text>
          )}
        </View>
      </View>

      {/* ── Quick Actions ── */}
      <View style={styles.actionRow}>
        <Pressable style={styles.actionBtn} onPress={handleToggleStar}>
          <Text style={styles.actionIcon}>{doc.is_starred ? '\u2B50' : '\u2606'}</Text>
          <Text style={styles.actionLabel}>{doc.is_starred ? 'STARRED' : 'STAR'}</Text>
        </Pressable>
        <Pressable style={styles.actionBtn}>
          <Text style={styles.actionIcon}>{'\u{1F4E4}'}</Text>
          <Text style={styles.actionLabel}>SHARE</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleDelete}>
          <Text style={styles.actionIcon}>{'\u{1F5D1}'}</Text>
          <Text style={styles.actionLabelDanger}>DELETE</Text>
        </Pressable>
      </View>

      {/* ── Content Preview ── */}
      <SectionHeader label="PREVIEW" title="Document Content" />
      {imageUri ? (
        <GlassCard level={2} style={styles.cardSpacing}>
          <Image
            source={{ uri: imageUri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        </GlassCard>
      ) : (
        <GlassCard level={2} style={styles.cardSpacing}>
          <View style={styles.previewPlaceholder}>
            <Text style={styles.previewIcon}>
              {doc.mime_type.includes('pdf') ? '\u{1F4D1}' : '\u{1F4C4}'}
            </Text>
            <Text style={styles.previewTitle}>
              {doc.mime_type.includes('pdf')
                ? 'PDF Document'
                : `File: ${doc.mime_type}`}
            </Text>
            <Text style={styles.previewSub}>
              {doc.mime_type.includes('pdf')
                ? 'PDF preview not available. Export to view.'
                : 'Preview not available for this file type.'}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* ── Metadata ── */}
      <SectionHeader label="DETAILS" title="Metadata" />
      <GlassCard level={2} style={styles.cardSpacing}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>{typeLabel}</Text>
        </View>
        <View style={[styles.detailRow, styles.detailDivider]}>
          <Text style={styles.detailLabel}>Size</Text>
          <Text style={styles.detailValue}>{formatFileSize(doc.file_size)}</Text>
        </View>
        {doc.document_date && (
          <View style={[styles.detailRow, styles.detailDivider]}>
            <Text style={styles.detailLabel}>Date</Text>
            <Text style={styles.detailValue}>{formatDate(doc.document_date.slice(0, 10))}</Text>
          </View>
        )}
        <View style={[styles.detailRow, styles.detailDivider]}>
          <Text style={styles.detailLabel}>Format</Text>
          <Text style={styles.detailValue}>{doc.mime_type}</Text>
        </View>
        <View style={[styles.detailRow, styles.detailDivider]}>
          <Text style={styles.detailLabel}>Starred</Text>
          <Text style={styles.detailValue}>{doc.is_starred ? 'Yes' : 'No'}</Text>
        </View>
      </GlassCard>

      {/* ── Notes ── */}
      {doc.notes && (
        <>
          <SectionHeader label="NOTES" title="Document Notes" />
          <GlassCard level={2} style={styles.cardSpacing}>
            <Text style={styles.notesText}>{doc.notes}</Text>
          </GlassCard>
        </>
      )}

      {/* ── Tags ── */}
      {doc.tags && (
        <>
          <SectionHeader label="TAGS" title="Labels" />
          <GlassCard level={2} style={styles.cardSpacing}>
            <View style={styles.tagRow}>
              {doc.tags.split(',').map((tag, i) => (
                <View key={i} style={styles.tagBadge}>
                  <Text style={styles.tagText}>{tag.trim()}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </>
      )}

      {/* ── Delete action at bottom ── */}
      <View style={styles.deleteWrap}>
        <GradientButton title="Delete Document" onPress={handleDelete} variant="secondary" />
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
    paddingBottom: 12,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  typeBadgeIcon: {
    fontSize: 12,
  },
  typeBadgeText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
  },
  metaText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionBtnDanger: {
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  actionLabelDanger: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: '#EF4444',
  },

  // Card spacing
  cardSpacing: {
    marginHorizontal: 16,
    marginTop: 8,
  },

  // Image preview
  imagePreview: {
    width: '100%',
    height: 300,
    borderRadius: 8,
  },

  // File preview placeholder
  previewPlaceholder: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  previewIcon: {
    fontSize: 48,
  },
  previewTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  previewSub: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  detailDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  detailLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: colors.text,
  },

  // Notes
  notesText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagBadge: {
    backgroundColor: `${HEALTH_ACCENT}20`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: HEALTH_ACCENT,
  },

  // Delete
  deleteWrap: {
    paddingHorizontal: 20,
    marginTop: 24,
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
