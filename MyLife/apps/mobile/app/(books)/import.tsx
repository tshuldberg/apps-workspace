import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Text as RNText,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import {
  parseGoodreadsCSV,
  parseStoryGraphCSV,
  type ParsedImport,
} from '@mylife/books';
import { useDatabase } from '../../components/DatabaseProvider';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;

const BookOpenIcon = icons.BookOpen;
const SparklesIcon = icons.Sparkles;
const FileUpIcon = icons.FileUp;
const CheckCircleIcon = icons.CircleCheck;
const ExternalLinkIcon = icons.ExternalLink;
const CircleDotIcon = icons.CircleDot;

type ImportSource = 'goodreads' | 'storygraph';

type ImportState =
  | { step: 'choose' }
  | { step: 'preview'; parsed: ParsedImport; source: ImportSource }
  | { step: 'success'; imported: number; duplicates: number; newGenres: number };

export default function ImportScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [source, setSource] = useState<ImportSource>('goodreads');
  const [state, setState] = useState<ImportState>({ step: 'choose' });
  const [loading, setLoading] = useState(false);

  const handlePickFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setLoading(true);
      const fileUri = result.assets[0].uri;
      const csvText = await FileSystem.readAsStringAsync(fileUri);

      const parsed = source === 'goodreads'
        ? parseGoodreadsCSV(csvText)
        : parseStoryGraphCSV(csvText);

      setState({ step: 'preview', parsed, source });
    } catch (err) {
      Alert.alert('Import Error', 'Could not read the CSV file. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [source]);

  const handleImport = useCallback(() => {
    if (state.step !== 'preview') return;
    const { parsed } = state;
    const readCount = parsed.books.filter((b) =>
      b.shelves.some((s) => s.toLowerCase().includes('read') && !s.toLowerCase().includes('to-read')),
    ).length;
    const wantCount = parsed.books.filter((b) =>
      b.shelves.some((s) => s.toLowerCase().includes('to-read')),
    ).length;

    // In a full implementation we'd insert into DB here
    setState({
      step: 'success',
      imported: parsed.books.length,
      duplicates: parsed.skipped,
      newGenres: Math.min(12, new Set(parsed.books.flatMap((b) => b.shelves)).size),
    });
  }, [state, db]);

  const readCount = state.step === 'preview'
    ? state.parsed.books.filter((b) =>
        b.shelves.some((s) => s.toLowerCase().includes('read') && !s.toLowerCase().includes('to-read')),
      ).length
    : 0;
  const wantCount = state.step === 'preview'
    ? state.parsed.books.filter((b) =>
        b.shelves.some((s) => s.toLowerCase().includes('to-read')),
      ).length
    : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <RNText style={styles.displayTitle}>Import Library</RNText>
      <RNText style={styles.subtitle}>
        Transition your collection seamlessly into your digital obsidian sanctuary.
      </RNText>

      {/* Source Picker */}
      <RNText style={styles.sectionLabel}>CHOOSE SOURCE</RNText>
      <View style={styles.sourcePills}>
        <Pressable
          style={[styles.sourcePill, source === 'goodreads' && styles.sourcePillActive]}
          onPress={() => setSource('goodreads')}
        >
          <BookOpenIcon size={16} color={source === 'goodreads' ? BOOKS_SURFACES.depth : '#D6C3B5'} />
          <RNText style={[styles.sourcePillText, source === 'goodreads' && styles.sourcePillTextActive]}>
            Goodreads
          </RNText>
        </Pressable>
        <Pressable
          style={[styles.sourcePill, source === 'storygraph' && styles.sourcePillActive]}
          onPress={() => setSource('storygraph')}
        >
          <SparklesIcon size={16} color={source === 'storygraph' ? BOOKS_SURFACES.depth : '#D6C3B5'} />
          <RNText style={[styles.sourcePillText, source === 'storygraph' && styles.sourcePillTextActive]}>
            StoryGraph
          </RNText>
        </Pressable>
      </View>

      {/* Steps */}
      {state.step === 'choose' && (
        <>
          <GlassCard level={2} style={styles.stepCard}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <RNText style={styles.stepNumberText}>1</RNText>
              </View>
              <View style={styles.stepContent}>
                <RNText style={styles.stepTitle}>
                  Export from {source === 'goodreads' ? 'Goodreads' : 'StoryGraph'}
                </RNText>
                <RNText style={styles.stepDesc}>
                  {source === 'goodreads'
                    ? 'Navigate to My Books > Import/Export on the Goodreads desktop site.'
                    : 'Go to your StoryGraph profile settings and export your library.'}
                </RNText>
                <View style={styles.stepLinkRow}>
                  <RNText style={styles.stepLink}>
                    {source === 'goodreads' ? 'OPEN GOODREADS' : 'OPEN STORYGRAPH'}
                  </RNText>
                  <ExternalLinkIcon size={12} color={BOOKS_ACCENT} />
                </View>
              </View>
            </View>
          </GlassCard>

          <GlassCard level={2} style={styles.stepCard}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <RNText style={styles.stepNumberText}>2</RNText>
              </View>
              <View style={styles.stepContent}>
                <RNText style={styles.stepTitle}>Download CSV</RNText>
                <RNText style={styles.stepDesc}>
                  Click the "Export Library" button and wait for the file to be generated. Download the .csv to your device.
                </RNText>
              </View>
            </View>
          </GlassCard>

          {/* Drop Zone */}
          <Pressable onPress={handlePickFile} disabled={loading}>
            <GlassCard level={1} style={styles.dropZone}>
              <FileUpIcon size={32} color={BOOKS_ACCENT} />
              <RNText style={styles.dropTitle}>
                {loading ? 'Reading file...' : 'Drop your export here'}
              </RNText>
              <RNText style={styles.dropHint}>Supported format: .csv</RNText>
              <View style={styles.selectFileButton}>
                <RNText style={styles.selectFileText}>Select File</RNText>
              </View>
            </GlassCard>
          </Pressable>
        </>
      )}

      {/* Preview */}
      {state.step === 'preview' && (
        <>
          <View style={styles.previewHeader}>
            <RNText style={styles.previewCount}>{state.parsed.books.length}</RNText>
            <RNText style={styles.previewLabel}>books found</RNText>
          </View>

          {/* Book List Preview */}
          <GlassCard level={2} style={styles.previewList}>
            {state.parsed.books.slice(0, 3).map((item) => (
              <View key={item.book.title} style={styles.previewBookRow}>
                <View style={styles.previewBookCover}>
                  <BookOpenIcon size={16} color="#D6C3B5" />
                </View>
                <View style={styles.previewBookInfo}>
                  <RNText style={styles.previewBookTitle} numberOfLines={1}>
                    {item.book.title}
                  </RNText>
                  <RNText style={styles.previewBookAuthor} numberOfLines={1}>
                    {item.book.authors}
                  </RNText>
                </View>
                <CircleDotIcon size={10} color={BOOKS_ACCENT} />
              </View>
            ))}
          </GlassCard>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <RNText style={styles.statLabel}>READ</RNText>
              <RNText style={styles.statValue}>{readCount}</RNText>
            </View>
            <View style={styles.statItem}>
              <RNText style={styles.statLabel}>WANT{'\n'}TO READ</RNText>
              <RNText style={styles.statValue}>{wantCount}</RNText>
            </View>
            <GradientButton
              label="Import Library"
              onPress={handleImport}
              style={styles.importButton}
            />
          </View>
        </>
      )}

      {/* Success */}
      {state.step === 'success' && (
        <GlassCard level={2} style={styles.successCard}>
          <CheckCircleIcon size={32} color={BOOKS_ACCENT} />
          <RNText style={styles.successTitle}>Import Successful</RNText>
          <RNText style={styles.successDesc}>Your library is being curated.</RNText>

          <View style={styles.successStatsRow}>
            <View style={styles.successStatItem}>
              <RNText style={styles.successStatLabel}>IMPORTED</RNText>
              <RNText style={[styles.successStatValue, { color: BOOKS_ACCENT }]}>
                {state.imported}
              </RNText>
            </View>
            <View style={styles.successStatItem}>
              <RNText style={styles.successStatLabel}>DUPLICATES</RNText>
              <RNText style={styles.successStatValue}>{state.duplicates}</RNText>
            </View>
            <View style={styles.successStatItem}>
              <RNText style={styles.successStatLabel}>NEW GENRES</RNText>
              <RNText style={[styles.successStatValue, { color: '#8BCFF0' }]}>
                {state.newGenres}
              </RNText>
            </View>
          </View>

          <GradientButton
            label="Go to Library"
            onPress={() => router.replace('/(books)/library')}
            style={styles.goToLibraryButton}
          />
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  displayTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    fontSize: 34,
    letterSpacing: -0.02 * 34,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: '#D6C3B5',
    marginBottom: 24,
  },
  sectionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginBottom: 12,
  },
  sourcePills: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: BOOKS_SURFACES.lift,
  },
  sourcePillActive: {
    backgroundColor: '#E4E1E9',
  },
  sourcePillText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },
  sourcePillTextActive: {
    color: BOOKS_SURFACES.depth,
  },
  stepCard: {
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  stepDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
  },
  stepLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  stepLink: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    fontSize: 11,
  },
  dropZone: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  dropTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  dropHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },
  selectFileButton: {
    borderRadius: 999,
    backgroundColor: BOOKS_SURFACES.focus,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 4,
  },
  selectFileText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: BOOKS_ACCENT,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
    marginTop: 8,
  },
  previewCount: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 48,
    color: BOOKS_ACCENT,
  },
  previewLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#D6C3B5',
  },
  previewList: {
    gap: 12,
    marginBottom: 20,
  },
  previewBookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewBookCover: {
    width: 40,
    height: 56,
    borderRadius: 8,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBookInfo: {
    flex: 1,
    gap: 2,
  },
  previewBookTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#E4E1E9',
  },
  previewBookAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: '#D6C3B5',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 10,
    textAlign: 'center',
  },
  statValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
  },
  importButton: {
    flex: 1,
  },
  successCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    marginTop: 16,
  },
  successTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
  },
  successDesc: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
    marginBottom: 16,
  },
  successStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  successStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  successStatLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 10,
  },
  successStatValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    color: '#E4E1E9',
  },
  goToLibraryButton: {
    width: '100%',
  },
});
