import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { Text, colors, spacing } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  GenreChip,
  JAKARTA_FONTS,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  BOOKS_GHOST_BORDER,
} from '@mylife/books/ui';
import { requestCameraPermission, ISBN_BARCODE_TYPES, isValidISBN } from '../../lib/scanner';
import { useDatabase } from '../../components/DatabaseProvider';
import { useBooks } from '../../hooks/books/use-books';
import { useShelves } from '../../hooks/books/use-shelves';
import {
  getBookByISBN,
  olEditionToBook,
  getBookByISBNLocal,
  addBookToShelf,
} from '@mylife/books';
import { getBooksSettings, resolvePreferredShelf } from '../../lib/books/settings';
import { icons } from 'lucide-react-native';

const BOOKS_ACCENT = colors.modules.books;
const KeyboardIcon = icons.Keyboard;
const ClockIcon = icons.Clock;
const BookOpenIcon = icons.BookOpen;
const XIcon = icons.X;
const LibraryIcon = icons.Library;

type ScanState =
  | { type: 'scanning' }
  | { type: 'loading'; isbn: string }
  | {
      type: 'found';
      isbn: string;
      title: string;
      authors: string;
      coverUrl: string | null;
      bookInsert: ReturnType<typeof olEditionToBook>;
      pages?: number;
      publishYear?: string;
      format?: string;
      subjects?: string[];
      description?: string;
    }
  | { type: 'not_found'; isbn: string }
  | { type: 'already_exists'; isbn: string; title: string }
  | { type: 'error'; isbn: string; message: string }
  | { type: 'manual' };

function parseAuthors(authors: string): string {
  try {
    const arr = JSON.parse(authors) as string[];
    return arr.length > 0 ? arr.join(', ') : 'Unknown Author';
  } catch {
    return authors || 'Unknown Author';
  }
}

export default function ScanScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { create } = useBooks();
  const { shelves } = useShelves();
  const preferredShelf = useMemo(() => {
    const settings = getBooksSettings(db);
    return resolvePreferredShelf(shelves, settings.defaultShelfSlug);
  }, [db, shelves]);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [scanState, setScanState] = useState<ScanState>({ type: 'scanning' });
  const [manualISBN, setManualISBN] = useState('');
  const [scanHistory, setScanHistory] = useState<
    Array<{ isbn: string; title: string; authors: string; coverUrl: string | null }>
  >([]);
  const [showHistory, setShowHistory] = useState(false);
  const scanLockRef = useRef(false);

  const requestPermission = useCallback(() => {
    setPermissionError(false);
    let mounted = true;
    requestCameraPermission()
      .then((granted) => {
        if (mounted) setHasPermission(granted);
      })
      .catch(() => {
        if (mounted) setPermissionError(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return requestPermission();
  }, [requestPermission]);

  const lookupISBN = useCallback(
    async (isbn: string) => {
      const existing = getBookByISBNLocal(db, isbn);
      if (existing) {
        setScanState({ type: 'already_exists', isbn, title: existing.title });
        return;
      }

      setScanState({ type: 'loading', isbn });

      try {
        const edition = await getBookByISBN(isbn);
        const bookInsert = olEditionToBook(edition);

        let coverUrl: string | null = null;
        if (edition.isbn_13?.[0]) {
          coverUrl = `https://covers.openlibrary.org/b/isbn/${edition.isbn_13[0]}-L.jpg`;
        } else if (edition.isbn_10?.[0]) {
          coverUrl = `https://covers.openlibrary.org/b/isbn/${edition.isbn_10[0]}-L.jpg`;
        }

        const subjects = edition.subjects?.slice(0, 3) ?? [];

        setScanState({
          type: 'found',
          isbn,
          title: edition.title,
          authors: bookInsert.authors,
          coverUrl,
          bookInsert,
          pages: edition.number_of_pages,
          publishYear: edition.publish_date,
          format: 'Paperback',
          subjects,
          description:
            typeof edition.description === 'string'
              ? edition.description
              : edition.description?.value,
        });
      } catch {
        setScanState({ type: 'not_found', isbn });
      }
    },
    [db],
  );

  const handleBarcodeScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanLockRef.current) return;
      const code = result.data;
      if (!isValidISBN(code)) return;

      scanLockRef.current = true;
      lookupISBN(code);
    },
    [lookupISBN],
  );

  const handleManualLookup = useCallback(() => {
    const isbn = manualISBN.trim().replace(/[-\s]/g, '');
    if (!isValidISBN(isbn)) {
      Alert.alert('Invalid ISBN', 'Please enter a valid 10 or 13 digit ISBN.');
      return;
    }
    lookupISBN(isbn);
  }, [manualISBN, lookupISBN]);

  const handleAddBook = useCallback(
    (bookInsert: ReturnType<typeof olEditionToBook>) => {
      const book = create(bookInsert);
      if (preferredShelf) {
        addBookToShelf(db, book.id, preferredShelf.id);
      }
      const isbn = bookInsert.isbn_13 ?? bookInsert.isbn_10 ?? '';
      setScanHistory((prev) => {
        if (prev.some((h) => h.isbn === isbn)) return prev;
        return [
          { isbn, title: book.title, authors: bookInsert.authors, coverUrl: bookInsert.cover_url ?? null },
          ...prev,
        ];
      });
      Alert.alert('Added!', `"${book.title}" added to ${preferredShelf?.name ?? 'your library'}.`, [
        { text: 'Scan Another', onPress: resetScan },
        { text: 'View Book', onPress: () => router.replace(`/(books)/book/${book.id}`) },
      ]);
    },
    [create, preferredShelf, db, router],
  );

  const resetScan = useCallback(() => {
    scanLockRef.current = false;
    setScanState({ type: 'scanning' });
    setManualISBN('');
  }, []);

  // ── Permission states ──────────────────────────────────────────────────

  if (hasPermission === false) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={styles.centeredTitle}>Camera Access Required</Text>
          <Text style={styles.centeredBody}>
            Camera permission is required to scan barcodes.
          </Text>
          <GradientButton label="Grant Permission" onPress={() => requestCameraPermission().then(setHasPermission)} />
          <Pressable onPress={() => setScanState({ type: 'manual' })}>
            <Text style={styles.linkText}>Enter ISBN Manually</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (permissionError) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Text style={styles.centeredTitle}>Camera Unavailable</Text>
          <Text style={styles.centeredBody}>
            Could not access the camera. Please check your device settings.
          </Text>
          <GradientButton label="Retry" onPress={requestPermission} />
          <Pressable onPress={() => setScanState({ type: 'manual' })}>
            <Text style={styles.linkText}>Enter ISBN Manually</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (hasPermission === null) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BOOKS_ACCENT} />
        </View>
      </>
    );
  }

  // ── Main scanner ───────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>{'\uD83D\uDCDA'}</Text>
            </View>
            <Text style={styles.headerTitle}>The Curator</Text>
          </View>
          <Pressable hitSlop={8}>
            <BookOpenIcon size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Camera / Manual / History */}
        {showHistory ? (
          <ScrollView style={styles.historyScroll} contentContainerStyle={styles.historyContent}>
            {scanHistory.length === 0 ? (
              <View style={styles.historyEmpty}>
                <Text style={styles.centeredBody}>Books you scan will appear here.</Text>
              </View>
            ) : (
              scanHistory.map((item) => (
                <GlassCard key={item.isbn} level={2} style={styles.historyCard}>
                  <View style={styles.historyRow}>
                    {item.coverUrl && (
                      <Image source={{ uri: item.coverUrl }} style={styles.historyThumb} />
                    )}
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.historyAuthor} numberOfLines={1}>{parseAuthors(item.authors)}</Text>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </ScrollView>
        ) : scanState.type === 'manual' ? (
          <View style={styles.manualSection}>
            <Text style={styles.manualTitle}>Enter ISBN</Text>
            <TextInput
              value={manualISBN}
              onChangeText={setManualISBN}
              placeholder="978-0-123456-78-9"
              placeholderTextColor="#9F8E81"
              keyboardType="number-pad"
              style={styles.isbnInput}
              autoFocus
            />
            <GradientButton
              label="Look Up"
              onPress={handleManualLookup}
              disabled={manualISBN.trim().length < 10}
            />
            <Pressable onPress={resetScan}>
              <Text style={styles.linkText}>Back to Scanner</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: [...ISBN_BARCODE_TYPES],
              }}
              onBarcodeScanned={scanState.type === 'scanning' ? handleBarcodeScan : undefined}
            />
            {/* Viewfinder overlay */}
            <View style={styles.overlay}>
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              {scanState.type === 'scanning' && (
                <Text style={styles.alignText}>ALIGN ISBN BARCODE</Text>
              )}
              {scanState.type === 'loading' && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={BOOKS_ACCENT} />
                  <Text style={styles.loadingText}>
                    Looking up ISBN {scanState.isbn}...
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action buttons row (below camera) */}
        {!showHistory && scanState.type === 'scanning' && (
          <View style={styles.actionRow}>
            <Pressable style={styles.actionIconButton} onPress={() => setShowHistory(true)}>
              <LibraryIcon size={20} color="#D6C3B5" />
            </Pressable>
            <Pressable
              style={styles.manualEntryButton}
              onPress={() => setScanState({ type: 'manual' })}
            >
              <KeyboardIcon size={16} color="#D6C3B5" />
              <Text style={styles.manualEntryText}>Manual Entry</Text>
            </Pressable>
            <Pressable
              style={styles.actionIconButton}
              onPress={() => setShowHistory(true)}
            >
              <ClockIcon size={20} color="#D6C3B5" />
            </Pressable>
          </View>
        )}

        {/* Scan result panel */}
        {scanState.type === 'found' && (
          <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
            {/* Scan detected header */}
            <View style={styles.detectedHeader}>
              <Text style={styles.detectedLabel}>SCAN DETECTED</Text>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            </View>

            {/* Book info row */}
            <View style={styles.bookRow}>
              {scanState.coverUrl && (
                <View style={styles.thumbContainer}>
                  <Image
                    source={{ uri: scanState.coverUrl }}
                    style={styles.thumbImage}
                    resizeMode="cover"
                  />
                  <View style={styles.thumbGhost} />
                </View>
              )}
              <View style={styles.bookInfo}>
                <Text style={styles.bookTitle} numberOfLines={2}>
                  {scanState.title}
                </Text>
                <Text style={styles.bookAuthor} numberOfLines={1}>
                  {parseAuthors(scanState.authors)}
                </Text>
                {/* Metadata */}
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    {scanState.format ?? 'Paperback'}
                    {scanState.pages ? ` \u2022 ${scanState.pages} Pages` : ''}
                  </Text>
                </View>
                {scanState.publishYear && (
                  <Text style={styles.metaText}>
                    Published {scanState.publishYear}
                  </Text>
                )}
              </View>
            </View>

            {/* Genre chips */}
            {scanState.subjects && scanState.subjects.length > 0 && (
              <View style={styles.chipRow}>
                {scanState.subjects.map((s) => (
                  <GenreChip key={s} label={s.toUpperCase()} />
                ))}
              </View>
            )}

            {/* Synopsis */}
            {scanState.description && (
              <GlassCard level={1} style={styles.synopsisCard}>
                <Text style={styles.synopsisLabel}>SYNOPSIS</Text>
                <Text style={styles.synopsisText} numberOfLines={4}>
                  "{scanState.description}"
                </Text>
              </GlassCard>
            )}

            {/* Actions */}
            <GradientButton
              label="Add to Library"
              onPress={() => handleAddBook(scanState.bookInsert)}
              style={styles.addButton}
            />
            <Pressable style={styles.discardButton} onPress={resetScan}>
              <XIcon size={14} color="#D6C3B5" />
              <Text style={styles.discardText}>Discard Scan</Text>
            </Pressable>
          </ScrollView>
        )}

        {/* Not found */}
        {scanState.type === 'not_found' && (
          <View style={styles.statusPanel}>
            <Text style={styles.statusText}>
              No book found for ISBN {scanState.isbn}.
            </Text>
            <GradientButton label="Try Again" onPress={resetScan} />
            <Pressable onPress={() => router.replace('/(books)/book/add')}>
              <Text style={styles.linkText}>Add Manually</Text>
            </Pressable>
          </View>
        )}

        {/* Already exists */}
        {scanState.type === 'already_exists' && (
          <View style={styles.statusPanel}>
            <Text style={styles.statusText}>
              "{scanState.title}" is already in your library.
            </Text>
            <GradientButton label="Scan Another" onPress={resetScan} />
          </View>
        )}

        {/* Error */}
        {scanState.type === 'error' && (
          <View style={styles.statusPanel}>
            <Text style={styles.errorText}>{scanState.message}</Text>
            <GradientButton label="Try Again" onPress={resetScan} />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoEmoji: { fontSize: 18 },
  headerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 18,
    color: '#E4E1E9',
  },

  // Camera
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: 220,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: BOOKS_ACCENT,
  },
  topLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  topRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  alignText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
    marginTop: 20,
    letterSpacing: 2,
  },
  loadingOverlay: {
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  loadingText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: '#D6C3B5',
  },

  // Action row below camera
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  actionIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 22,
    paddingVertical: 12,
  },
  manualEntryText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: '#D6C3B5',
  },

  // Scan result
  resultScroll: {
    maxHeight: '55%',
    backgroundColor: BOOKS_SURFACES.depth,
  },
  resultContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  detectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detectedLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: BOOKS_ACCENT,
  },
  verifiedBadge: {
    backgroundColor: `${BOOKS_ACCENT}22`,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  verifiedText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: BOOKS_ACCENT,
  },
  bookRow: {
    flexDirection: 'row',
    gap: 14,
  },
  thumbContainer: {
    position: 'relative',
    width: 100,
    height: 150,
    borderRadius: 10,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbGhost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BOOKS_GHOST_BORDER,
  },
  bookInfo: {
    flex: 1,
    gap: 4,
  },
  bookTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: '#E4E1E9',
    lineHeight: 28,
  },
  bookAuthor: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: BOOKS_ACCENT,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#9F8E81',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  synopsisCard: {
    gap: 8,
  },
  synopsisLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#9F8E81',
  },
  synopsisText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: '#D6C3B5',
    fontStyle: 'italic',
  },
  addButton: {
    marginTop: 4,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 999,
  },
  discardText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 15,
    color: '#D6C3B5',
  },

  // Status panels
  statusPanel: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  statusText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    textAlign: 'center',
  },
  errorText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.danger,
    textAlign: 'center',
  },
  linkText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: BOOKS_ACCENT,
    marginTop: 4,
  },

  // Permission / centered
  centered: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  centeredTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
  },
  centeredBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#9F8E81',
    textAlign: 'center',
  },

  // Manual entry
  manualSection: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
    alignItems: 'center',
  },
  manualTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 20,
    color: '#E4E1E9',
  },
  isbnInput: {
    color: '#E4E1E9',
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 22,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: BOOKS_ACCENT,
    paddingVertical: spacing.sm,
    width: '80%',
    letterSpacing: 2,
  },

  // History
  historyScroll: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.depth,
  },
  historyContent: {
    padding: 20,
    gap: 10,
  },
  historyEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  historyCard: { gap: 0 },
  historyRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  historyThumb: {
    width: 44,
    height: 66,
    borderRadius: 6,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 16,
    color: '#E4E1E9',
  },
  historyAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
  },
});
