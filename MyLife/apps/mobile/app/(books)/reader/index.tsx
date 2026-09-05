import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { LoadingState, EmptyState, colors, spacing } from '@mylife/ui';
import { parseReaderUpload } from '@mylife/books';
import { useReaderDocuments } from '../../../hooks/books/use-reader-documents';
import {
  GlassCard,
  ReadingProgressBar,
  BOOKS_SURFACES,
  BOOKS_CTA_GRADIENT,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const UploadIcon = icons.Upload;
const CalendarIcon = icons.Calendar;
const PlusIcon = icons.Plus;
const FileTextIcon = icons.FileText;

const PICKER_TYPES = [
  'text/plain',
  'text/markdown',
  'text/html',
  'application/json',
  'application/rtf',
  'application/epub+zip',
  'application/pdf',
  'application/x-mobipocket-ebook',
  'application/vnd.amazon.ebook',
];

const BINARY_EXTENSIONS = ['.epub', '.pdf', '.mobi', '.azw', '.azw3'];

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBadge(ext: string | null): string {
  if (!ext) return 'DOC';
  return ext.replace(/^\./, '').toUpperCase();
}

const COVER_COLORS: Record<string, string> = {
  epub: '#8B7355',
  pdf: '#7B6573',
  txt: '#5B6B73',
  mobi: '#73655B',
  html: '#5B7363',
  md: '#5B6B73',
};

function getCoverColor(ext: string | null): string {
  if (!ext) return '#5B6B73';
  return COVER_COLORS[ext.replace(/^\./, '').toLowerCase()] ?? '#5B6B73';
}

export default function ReaderLibraryScreen() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { documents, loading, refresh, create } = useReaderDocuments();

  const stats = useMemo(() => {
    const inProgress = documents.filter(
      (d) => d.progress_percent > 0 && d.progress_percent < 100,
    ).length;
    const exts = [
      ...new Set(
        documents
          .map((d) => d.file_extension?.replace(/^\./, '').toUpperCase())
          .filter(Boolean),
      ),
    ];
    const formats = exts.length > 0 ? exts.join(', ') : 'None';

    const sorted = [...documents]
      .filter((d) => d.last_opened_at)
      .sort((a, b) =>
        (b.last_opened_at ?? '').localeCompare(a.last_opened_at ?? ''),
      );

    return {
      total: documents.length,
      inProgress,
      formats,
      lastRead: formatTimeAgo(sorted[0]?.last_opened_at ?? null),
    };
  }, [documents]);

  const sortedDocs = useMemo(
    () =>
      [...documents].sort((a, b) => {
        const aTime = a.last_opened_at ?? a.created_at;
        const bTime = b.last_opened_at ?? b.created_at;
        return (bTime ?? '').localeCompare(aTime ?? '');
      }),
    [documents],
  );

  const handleUpload = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: PICKER_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const lowerName = file.name.toLowerCase();
      const mime = file.mimeType ?? null;
      const isBinary =
        BINARY_EXTENSIONS.some((ext) => lowerName.endsWith(ext)) ||
        mime === 'application/epub+zip' ||
        mime === 'application/pdf' ||
        mime === 'application/x-mobipocket-ebook' ||
        mime === 'application/vnd.amazon.ebook';

      setUploading(true);

      const parsed = isBinary
        ? await parseReaderUpload({
            fileName: file.name,
            mimeType: mime,
            base64Content: await FileSystem.readAsStringAsync(file.uri, {
              encoding: FileSystem.EncodingType.Base64,
            }),
          })
        : await parseReaderUpload({
            fileName: file.name,
            mimeType: mime,
            textContent: await FileSystem.readAsStringAsync(file.uri),
          });

      const created = create({
        title: parsed.title,
        author: parsed.author,
        source_type: 'upload',
        mime_type: parsed.mimeType,
        file_name: parsed.fileName,
        file_extension: parsed.fileExtension,
        text_content: parsed.textContent,
        total_chars: parsed.totalChars,
        total_words: parsed.totalWords,
      });

      Alert.alert(
        'Document Ready',
        `"${created.title}" was added to your reader.`,
        [
          {
            text: 'Open',
            onPress: () => router.push(`/(books)/reader/${created.id}`),
          },
          { text: 'Later', style: 'cancel' },
        ],
      );
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof Error ? err.message : 'Could not import this file.',
      );
    } finally {
      setUploading(false);
    }
  }, [create, router]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.resolve(refresh());
    } finally {
      setRefreshing(false);
    }
  }, [refresh]);

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState rows={3} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={BOOKS_ACCENT}
          colors={[BOOKS_ACCENT]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.collectionLabel}>YOUR COLLECTION</Text>
        <Text style={styles.heroTitle}>Digital Library</Text>
      </View>

      {/* Upload Button */}
      <Pressable
        onPress={() => {
          if (!uploading) void handleUpload();
        }}
        disabled={uploading}
        style={({ pressed }) => [
          styles.uploadWrapper,
          pressed && { opacity: 0.85 },
          uploading && { opacity: 0.5 },
        ]}
      >
        <LinearGradient
          colors={[BOOKS_CTA_GRADIENT.from, BOOKS_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.uploadGradient}
        >
          <UploadIcon size={18} color="#1a1008" />
          <Text style={styles.uploadLabel}>
            {uploading ? 'Importing...' : 'Upload Document'}
          </Text>
        </LinearGradient>
      </Pressable>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>TOTAL BOOKS</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>IN PROGRESS</Text>
            <Text style={styles.statValue}>{stats.inProgress}</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>FORMATS</Text>
            <Text style={styles.statValueSmall}>{stats.formats}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>LAST READ</Text>
            <Text style={styles.statValueSmall}>{stats.lastRead}</Text>
          </View>
        </View>
      </View>

      {/* Document List */}
      {sortedDocs.length === 0 ? (
        <EmptyState
          icon={'\uD83D\uDCC4'}
          title="No reader documents yet"
          message="Upload your first book or note file."
        />
      ) : (
        <View style={styles.docList}>
          {sortedDocs.map((doc) => (
            <GlassCard
              key={doc.id}
              level={2}
              onPress={() => router.push(`/(books)/reader/${doc.id}`)}
              style={styles.docCard}
            >
              <View style={styles.docRow}>
                {/* Cover placeholder */}
                <View
                  style={[
                    styles.coverPlaceholder,
                    { backgroundColor: getCoverColor(doc.file_extension) },
                  ]}
                >
                  <Text style={styles.coverInitial}>
                    {doc.title.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Title + Author + Badge */}
                <View style={styles.docInfo}>
                  <View style={styles.docTitleRow}>
                    <Text style={styles.docTitle} numberOfLines={1}>
                      {doc.title}
                    </Text>
                    <View style={styles.formatBadge}>
                      <Text style={styles.formatBadgeText}>
                        {formatBadge(doc.file_extension)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.docAuthor} numberOfLines={1}>
                    {doc.author ?? 'Unknown Author'}
                  </Text>
                </View>
              </View>

              {/* Progress */}
              <View style={styles.progressSection}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Progress</Text>
                  <Text style={styles.progressValue}>
                    {Math.round(doc.progress_percent)}%
                  </Text>
                </View>
                <ReadingProgressBar
                  progress={doc.progress_percent / 100}
                  height={4}
                />
              </View>

              {/* Last Opened */}
              <View style={styles.lastOpenedRow}>
                <CalendarIcon size={12} color="#9F8E81" />
                <Text style={styles.lastOpenedText}>
                  Last opened {formatTimeAgo(doc.last_opened_at)}
                </Text>
              </View>
            </GlassCard>
          ))}
        </View>
      )}

      {/* Upload CTA */}
      <View style={styles.uploadCta}>
        <View style={styles.ctaIconCircle}>
          <PlusIcon size={24} color={BOOKS_ACCENT} />
        </View>
        <Text style={styles.ctaTitle}>Expand Your Library</Text>
        <Text style={styles.ctaDescription}>
          Upload ePub, PDF, or text files to read here and start building your
          knowledge vault.
        </Text>
        <View style={styles.formatPills}>
          {['PDF', 'EPUB', 'TXT'].map((fmt) => (
            <View key={fmt} style={styles.formatPill}>
              <FileTextIcon size={12} color="#D6C3B5" />
              <Text style={styles.formatPillText}>{fmt}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingBottom: spacing.xl + 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  collectionLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: '#C9894D',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 32,
    color: '#E4E1E9',
    letterSpacing: -0.5,
  },

  // Upload Button
  uploadWrapper: {
    borderRadius: 999,
    overflow: 'hidden',
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  uploadGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  uploadLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#1a1008',
  },

  // Stats Grid
  statsGrid: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  statLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 1,
    color: '#D6C3B5',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
  },
  statValueSmall: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: '#E4E1E9',
  },

  // Document List
  docList: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  docCard: {
    gap: 12,
  },
  docRow: {
    flexDirection: 'row',
    gap: 14,
  },
  coverPlaceholder: {
    width: 60,
    height: 82,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverInitial: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 26,
    color: 'rgba(255,255,255,0.6)',
  },
  docInfo: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  docTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docTitle: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: '#E4E1E9',
  },
  formatBadge: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  formatBadgeText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 10,
    letterSpacing: 0.5,
    color: '#D6C3B5',
    textTransform: 'uppercase',
  },
  docAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },

  // Progress
  progressSection: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#C9894D',
  },
  progressValue: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: '#D6C3B5',
  },

  // Last Opened
  lastOpenedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastOpenedText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#9F8E81',
  },

  // Upload CTA
  uploadCta: {
    paddingHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 32,
  },
  ctaIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  ctaDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#9F8E81',
    textAlign: 'center',
    marginBottom: 16,
    maxWidth: 280,
  },
  formatPills: {
    flexDirection: 'row',
    gap: 10,
  },
  formatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  formatPillText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#D6C3B5',
  },
});
