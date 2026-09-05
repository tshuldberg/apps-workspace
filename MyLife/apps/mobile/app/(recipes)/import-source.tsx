import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Camera,
  Image as ImageIcon,
  Lightbulb,
  Link as LinkIcon,
  PlayCircle,
  ScanLine,
} from 'lucide-react-native';
import {
  detectPlatform,
  extractRecipeFromText,
  fetchHtml,
  fetchSocialMetadata,
  getRecipes,
  getSetting,
  parseRecipeFromText,
  type ParsedRecipe,
  type Recipe,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_DANGER,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
} from '@mylife/bestchef';
import { Text, colors } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const PLACEHOLDER = 'rgba(214, 195, 181, 0.4)';
const BORDER_DIM = 'rgba(159, 142, 129, 0.35)';
const ICON_DIM = 'rgba(255, 255, 255, 0.55)';

type SourceBadge = 'url' | 'ocr' | 'video';

interface RecentExtraction {
  id: string;
  title: string;
  imageUri: string | null;
  importedAt: string;
  source: SourceBadge;
}

function detectSourceBadge(sourceUrl: string | null): SourceBadge {
  if (sourceUrl == null) return 'url';
  const platform = detectPlatform(sourceUrl);
  if (platform != null) return 'video';
  return 'url';
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString();
}

export default function ImportSourceScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [recents, setRecents] = useState<RecentExtraction[]>([]);

  // Local UI state for OCR/Video processing demos. Real flows live in the
  // dedicated photo/video routes.
  const [ocrProcessing] = useState(false);
  const [videoProgress] = useState(42);
  const [barcodeError] = useState(
    'Barcode not recognized. Please try a manual search.',
  );

  useEffect(() => {
    try {
      const all: Recipe[] = getRecipes(db);
      const sorted = [...all].sort((a, b) =>
        a.created_at < b.created_at ? 1 : -1,
      );
      const mapped: RecentExtraction[] = sorted.slice(0, 3).map((r) => ({
        id: r.id,
        title: r.title,
        imageUri: r.image_uri,
        importedAt: r.created_at,
        source: detectSourceBadge(r.source_url),
      }));
      setRecents(mapped);
    } catch {
      setRecents([]);
    }
  }, [db]);

  const getApiKey = (): string | null => {
    try {
      return getSetting(db, 'claude_api_key');
    } catch {
      return null;
    }
  };

  const navigateToReview = (
    parsed: ParsedRecipe,
    source: string,
    sourceUrl?: string,
    metadata?: { author?: string; thumbnailUrl?: string },
  ) => {
    router.push({
      pathname: '/(recipes)/import-review',
      params: {
        parsed: JSON.stringify(parsed),
        source,
        sourceUrl: sourceUrl ?? '',
        metaAuthor: metadata?.author ?? '',
        metaThumb: metadata?.thumbnailUrl ?? '',
      },
    });
  };

  const handleUrlImport = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('Enter a URL', 'Paste or type a recipe URL.');
      return;
    }

    setLoading(true);
    try {
      const platform = detectPlatform(trimmed);

      if (platform != null) {
        setStatus(`Fetching ${platform} metadata...`);
        const metadata = await fetchSocialMetadata(trimmed);

        const apiKey = getApiKey();
        if (apiKey != null && metadata.captionText) {
          setStatus('Extracting recipe with AI...');
          const parsed = await extractRecipeFromText(
            metadata.captionText,
            apiKey,
            {
              sourceUrl: trimmed,
              author: metadata.author ?? undefined,
            },
          );
          if (parsed != null) {
            navigateToReview(parsed, platform, trimmed, {
              author: metadata.author ?? undefined,
              thumbnailUrl: metadata.thumbnailUrl ?? undefined,
            });
            return;
          }
        }

        if (metadata.captionText) {
          navigateToReview(
            {
              title: metadata.title || '',
              description: metadata.captionText,
              ingredients: [],
              steps: [],
            },
            platform,
            trimmed,
            {
              author: metadata.author ?? undefined,
              thumbnailUrl: metadata.thumbnailUrl ?? undefined,
            },
          );
        } else {
          Alert.alert(
            'Could Not Extract',
            `No recipe content found from this ${platform} link. Try pasting the recipe text instead.`,
          );
        }
      } else {
        setStatus('Fetching page...');
        const result = await fetchHtml(trimmed);

        setStatus('Parsing recipe...');
        const parsed = parseRecipeFromText(result.html);
        if (parsed != null) {
          navigateToReview(parsed, 'url', trimmed);
          return;
        }

        const apiKey = getApiKey();
        if (apiKey != null) {
          setStatus('Trying AI extraction...');
          const aiParsed = await extractRecipeFromText(
            result.html.slice(0, 8000),
            apiKey,
          );
          if (aiParsed != null) {
            navigateToReview(aiParsed, 'url', trimmed);
            return;
          }
        }

        Alert.alert(
          'No Recipe Found',
          'Could not find recipe data on this page. Try pasting the recipe text instead.',
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert('Import Failed', message);
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  const goToPhotoImport = () => router.push('/(recipes)/import-photo');
  const goToVideoImport = () => router.push('/(recipes)/import-video');
  const goToBarcodeScanner = () => {
    Alert.alert(
      'Barcode Scanner',
      'Open the Pantry tab to scan barcodes and add packaged ingredients.',
    );
  };

  const heroSubtitle = useMemo(
    () =>
      'Choose your method to instantly digitize and curate your culinary library.',
    [],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Import Recipe</Text>
          <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>
        </View>

        {/* URL IMPORT (PRIMARY) */}
        <View style={styles.urlCard}>
          <View style={styles.urlHeaderRow}>
            <View style={styles.iconCirclePrimary}>
              <LinkIcon
                size={22}
                color={RECIPES_ACCENT}
                strokeWidth={2}
              />
            </View>
          </View>
          <Text style={styles.cardTitle}>URL Import</Text>
          <Text style={styles.cardBody}>
            Paste any web link from your favorite blog or recipe site. We will
            strip the clutter and save the steps.
          </Text>

          <View style={styles.urlInputWrap}>
            <TextInput
              style={styles.urlInput}
              value={url}
              onChangeText={setUrl}
              placeholder="https://tasty.co/recipe/..."
              placeholderTextColor={PLACEHOLDER}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
              editable={!loading}
            />
            <Pressable
              onPress={handleUrlImport}
              disabled={loading}
              style={({ pressed }) => [
                styles.importButton,
                pressed && styles.importButtonPressed,
                loading && styles.importButtonDisabled,
              ]}
            >
              <Text style={styles.importButtonText}>
                {loading ? '...' : 'Import'}
              </Text>
            </Pressable>
          </View>

          {loading && status ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={RECIPES_ACCENT} />
              <Text style={styles.statusText}>{status}</Text>
            </View>
          ) : null}
        </View>

        {/* PHOTO OCR */}
        <Pressable
          onPress={goToPhotoImport}
          style={({ pressed }) => [
            styles.methodCard,
            pressed && styles.methodCardPressed,
          ]}
        >
          <View style={styles.iconCircleSecondary}>
            <Camera
              size={22}
              color={RECIPES_SECONDARY}
              strokeWidth={2}
            />
          </View>
          <Text style={styles.cardTitle}>Photo OCR</Text>
          <Text style={styles.cardBody}>
            Scan physical cookbooks or handwritten notes using precision text
            recognition.
          </Text>

          <View style={styles.uploadDashed}>
            {ocrProcessing ? (
              <View style={styles.uploadInner}>
                <ActivityIndicator size="small" color={RECIPES_SECONDARY} />
                <Text style={styles.uploadLabel}>SCANNING</Text>
              </View>
            ) : (
              <View style={styles.uploadInner}>
                <ImageIcon size={20} color={ICON_DIM} strokeWidth={1.8} />
                <Text style={styles.uploadLabel}>UPLOAD IMAGE</Text>
              </View>
            )}
          </View>
        </Pressable>

        {/* BARCODE SCANNER */}
        <Pressable
          onPress={goToBarcodeScanner}
          style={({ pressed }) => [
            styles.methodCard,
            pressed && styles.methodCardPressed,
          ]}
        >
          <View style={styles.cardRow}>
            <View style={styles.iconCircleNeutral}>
              <ScanLine size={22} color={ICON_DIM} strokeWidth={2} />
            </View>
            <View style={styles.cardRowBody}>
              <Text style={styles.cardTitleSm}>Barcode Scanner</Text>
              <Text style={styles.cardBodySm}>
                Quickly add store-bought ingredients or packaged meal kits to
                your inventory.
              </Text>

              {barcodeError ? (
                <View style={styles.errorBox}>
                  <AlertCircle
                    size={14}
                    color={RECIPES_DANGER}
                    strokeWidth={2}
                  />
                  <Text style={styles.errorText}>{barcodeError}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        {/* VIDEO IMPORT */}
        <Pressable
          onPress={goToVideoImport}
          style={({ pressed }) => [
            styles.methodCard,
            pressed && styles.methodCardPressed,
          ]}
        >
          <View style={styles.cardRow}>
            <View style={styles.iconCircleNeutral}>
              <PlayCircle size={22} color={ICON_DIM} strokeWidth={2} />
            </View>
            <View style={styles.cardRowBody}>
              <Text style={styles.cardTitleSm}>Video Import</Text>
              <Text style={styles.cardBodySm}>
                Extract ingredients and methods from TikTok, Reels, or YouTube
                videos.
              </Text>

              <View style={styles.processingBox}>
                <View style={styles.processingHead}>
                  <View style={styles.processingDot} />
                  <Text style={styles.processingLabel}>
                    Extracting recipe...
                  </Text>
                  <Text style={styles.processingPct}>{videoProgress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${videoProgress}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </Pressable>

        {/* RECENT EXTRACTIONS */}
        <View style={styles.recentHeader}>
          <View style={styles.recentHeaderText}>
            <Text style={styles.eyebrow}>CURATED RECENTLY</Text>
            <Text style={styles.recentTitle}>Recent Extractions</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(recipes)/recipes-tab')}
            hitSlop={8}
          >
            <Text style={styles.viewArchive}>View Archive</Text>
          </Pressable>
        </View>

        {recents.length > 0 ? (
          recents.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/(recipes)/recipe/${r.id}`)}
              style={({ pressed }) => [
                styles.recentCard,
                pressed && styles.methodCardPressed,
              ]}
            >
              <View style={styles.recentImageWrap}>
                {r.imageUri != null ? (
                  <Image
                    source={{ uri: r.imageUri }}
                    style={styles.recentImage}
                  />
                ) : (
                  <View
                    style={[styles.recentImage, styles.recentImagePlaceholder]}
                  />
                )}
                <View style={styles.recentBadge}>
                  {r.source === 'url' ? (
                    <LinkIcon
                      size={10}
                      color={RECIPES_ACCENT}
                      strokeWidth={2.5}
                    />
                  ) : r.source === 'ocr' ? (
                    <Camera
                      size={10}
                      color={RECIPES_SECONDARY}
                      strokeWidth={2.5}
                    />
                  ) : (
                    <PlayCircle
                      size={10}
                      color={RECIPES_SECONDARY}
                      strokeWidth={2.5}
                    />
                  )}
                  <Text style={styles.recentBadgeText}>
                    {r.source.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.recentMeta}>
                <Text numberOfLines={1} style={styles.recentName}>
                  {r.title}
                </Text>
                <Text style={styles.recentTime}>
                  Imported {relativeTime(r.importedAt)}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyRecent}>
            <Text style={styles.emptyRecentText}>
              No imports yet. Try a URL above to get started.
            </Text>
          </View>
        )}

        {/* PRO TIP */}
        <View style={styles.proTip}>
          <View style={styles.proTipIcon}>
            <Lightbulb size={22} color={RECIPES_ACCENT} strokeWidth={2} />
          </View>
          <Text style={styles.proTipTitle}>Pro Tip</Text>
          <Text style={styles.proTipBody}>
            Save the &apos;Import to BestChef&apos; bookmarklet to your browser
            to save recipes with one click.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },

  // Hero
  hero: {
    marginBottom: 4,
    gap: 8,
  },
  heroTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 32,
    color: colors.text,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: 'rgba(214, 195, 181, 0.6)',
    lineHeight: 21,
    maxWidth: 320,
  },

  // Cards
  urlCard: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 32,
    padding: 24,
    gap: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  urlHeaderRow: {
    marginBottom: 8,
  },
  methodCard: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 32,
    padding: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  methodCardPressed: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 16,
  },
  cardRowBody: {
    flex: 1,
    gap: 8,
  },

  // Icon circles
  iconCirclePrimary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  iconCircleSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(201, 137, 77, 0.18)',
    marginBottom: 8,
  },
  iconCircleNeutral: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RECIPES_SURFACES.highest,
  },

  cardTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.4,
  },
  cardTitleSm: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.3,
  },
  cardBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.7)',
    lineHeight: 20,
    maxWidth: 320,
  },
  cardBodySm: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.7)',
    lineHeight: 18,
  },

  // URL input
  urlInputWrap: {
    marginTop: 12,
    backgroundColor: RECIPES_SURFACES.highest,
    borderRadius: 999,
    paddingLeft: 20,
    paddingRight: 4,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  urlInput: {
    flex: 1,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    paddingVertical: 12,
  },
  importButton: {
    backgroundColor: RECIPES_ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  importButtonPressed: {
    opacity: 0.85,
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 13,
    color: '#0E0E13',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  statusText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Photo OCR upload
  uploadDashed: {
    marginTop: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: BORDER_DIM,
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadInner: {
    alignItems: 'center',
    gap: 8,
  },
  uploadLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1.6,
  },

  // Barcode error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.20)',
    marginTop: 4,
  },
  errorText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: RECIPES_DANGER,
    flex: 1,
  },

  // Video processing
  processingBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(34, 197, 94, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.14)',
    gap: 8,
  },
  processingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: RECIPES_ACCENT,
  },
  processingLabel: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: RECIPES_ACCENT,
  },
  processingPct: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: RECIPES_ACCENT,
    opacity: 0.7,
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.highest,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: RECIPES_ACCENT,
  },

  // Recent extractions
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    marginBottom: 4,
  },
  recentHeaderText: {
    gap: 6,
  },
  eyebrow: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
    color: RECIPES_ACCENT,
    letterSpacing: 2,
  },
  recentTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.4,
  },
  viewArchive: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  recentCard: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  recentImageWrap: {
    height: 160,
    width: '100%',
    position: 'relative',
  },
  recentImage: {
    width: '100%',
    height: '100%',
  },
  recentImagePlaceholder: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  recentBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(19, 19, 24, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recentBadgeText: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 9,
    color: colors.text,
    letterSpacing: 1.6,
  },
  recentMeta: {
    padding: 16,
    gap: 4,
  },
  recentName: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  recentTime: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  emptyRecent: {
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 24,
    paddingVertical: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  emptyRecentText: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // Pro tip
  proTip: {
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.14)',
  },
  proTipIcon: {
    marginBottom: 10,
  },
  proTipTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  proTipBody: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
});
