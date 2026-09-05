import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  type BestChefResult,
  type CreatorApplication,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { ErrorState, LoadingState, Text, colors } from '@mylife/ui';

// ── Constants ───────────────────────────────────────────────────────

const CUISINE_OPTIONS = [
  'Italian',
  'Mexican',
  'Japanese',
  'Chinese',
  'Indian',
  'Thai',
  'French',
  'Korean',
  'Mediterranean',
  'American',
  'Vietnamese',
  'Middle Eastern',
  'Ethiopian',
  'Brazilian',
  'Spanish',
  'Greek',
] as const;

interface PlatformLink {
  platform: string;
  url: string;
  followerCount: string;
}

const PLATFORM_PRESETS = [
  'Instagram',
  'YouTube',
  'TikTok',
  'Twitter',
  'Facebook',
  'Blog/Website',
] as const;

// ── Stubs (cloud functions not yet implemented) ─────────────────────

async function applyForCreator(
  _bio: string,
  _specialties: string[],
  _platformLinks: PlatformLink[],
): Promise<BestChefResult<CreatorApplication>> {
  await new Promise((r) => setTimeout(r, 1000));
  return { ok: true, data: {} as CreatorApplication };
}

async function getApplication(): Promise<
  BestChefResult<CreatorApplication | null>
> {
  return { ok: true, data: null };
}

// ── Screen ──────────────────────────────────────────────────────────

export default function CreatorApplyScreen() {
  const router = useRouter();

  const [existingApp, setExistingApp] = useState<CreatorApplication | null>(
    null,
  );
  const [bio, setBio] = useState('');
  const [selectedCuisines, setSelectedCuisines] = useState<Set<string>>(
    new Set(),
  );
  const [platformLinks, setPlatformLinks] = useState<PlatformLink[]>([
    { platform: 'Instagram', url: '', followerCount: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getApplication();
      if (result.ok && result.data) {
        setExistingApp(result.data);
        setBio(result.data.bio);
        setSelectedCuisines(new Set(result.data.specialties));
        const links = result.data.platformLinks as PlatformLink[] | undefined;
        if (Array.isArray(links) && links.length > 0) {
          setPlatformLinks(links);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load application',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines((prev) => {
      const next = new Set(prev);
      if (next.has(cuisine)) {
        next.delete(cuisine);
      } else {
        next.add(cuisine);
      }
      return next;
    });
  };

  const updateLink = (
    index: number,
    field: keyof PlatformLink,
    value: string,
  ) => {
    setPlatformLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    );
  };

  const addLink = () => {
    setPlatformLinks((prev) => [
      ...prev,
      { platform: '', url: '', followerCount: '' },
    ]);
  };

  const removeLink = (index: number) => {
    setPlatformLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!bio.trim() || selectedCuisines.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const validLinks = platformLinks.filter((l) => l.url.trim());
      const result = await applyForCreator(
        bio.trim(),
        Array.from(selectedCuisines),
        validLinks,
      );
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = bio.trim().length > 0 && selectedCuisines.size > 0;

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={6} />
      </View>
    );
  }

  if (error && !existingApp) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }

  // Show existing application status
  if (existingApp && !submitted) {
    const statusColor =
      existingApp.status === 'approved'
        ? RECIPES_ACCENT
        : existingApp.status === 'declined'
          ? '#FFB4AB'
          : RECIPES_SECONDARY;
    const statusLabel =
      existingApp.status === 'approved'
        ? 'Approved'
        : existingApp.status === 'declined'
          ? 'Declined'
          : existingApp.status === 'more_info_needed'
            ? 'More Info Needed'
            : existingApp.status === 'withdrawn'
              ? 'Withdrawn'
              : 'Pending Review';

    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>Application Status</Text>

          <GlassCard level={2} style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusColor },
                ]}
              />
              <Text style={[styles.statusLabel, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>

            {(existingApp.status === 'submitted' ||
              existingApp.status === 'under_review') && (
              <Text style={styles.statusMessage}>
                Your application is being reviewed. We will notify you once a
                decision has been made.
              </Text>
            )}

            {existingApp.status === 'approved' && (
              <Text style={styles.statusMessage}>
                Congratulations! You are now a verified creator. Open your
                dashboard to manage your creator presence.
              </Text>
            )}

            {(existingApp.status === 'declined' ||
              existingApp.status === 'more_info_needed') &&
              existingApp.reviewerNote && (
                <Text style={styles.statusMessage}>
                  {existingApp.reviewerNote}
                </Text>
              )}

            {existingApp.status === 'approved' && (
              <Pressable
                style={styles.dashboardButton}
                onPress={() => router.push('/(recipes)/creator-dashboard')}
              >
                <Text style={styles.dashboardButtonText}>
                  Go to Dashboard
                </Text>
              </Pressable>
            )}
          </GlassCard>

          <GlassCard level={2} style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Your Application</Text>
            <Text style={styles.summaryBio}>{existingApp.bio}</Text>
            <View style={styles.summaryChips}>
              {existingApp.specialties.map((s) => (
                <View key={s} style={styles.summaryCuisineChip}>
                  <Text style={styles.summaryCuisineText}>{s}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    );
  }

  // Success state
  if (submitted) {
    return (
      <View style={styles.screen}>
        <View style={styles.successContainer}>
          <View style={styles.successCircle}>
            <Text style={styles.successEmoji}>📝</Text>
          </View>
          <Text style={styles.successTitle}>Application Submitted!</Text>
          <Text style={styles.successMessage}>
            We will review your application and get back to you soon.
          </Text>
          <Pressable style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Become a Creator</Text>
          <Text style={styles.pageSubtitle}>
            Share your cooking, grow your profile, and connect with food lovers
          </Text>
        </View>

        {/* Bio */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About You</Text>
          <GlassCard level={2} style={styles.inputCard}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about your cooking journey, experience, and what makes your food special..."
              placeholderTextColor="rgba(214, 195, 181, 0.3)"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </GlassCard>
        </View>

        {/* Cuisine specialties */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuisine Specialties</Text>
          <Text style={styles.sectionHint}>Select all that apply</Text>
          <View style={styles.cuisineGrid}>
            {CUISINE_OPTIONS.map((cuisine) => {
              const active = selectedCuisines.has(cuisine);
              return (
                <Pressable
                  key={cuisine}
                  style={[
                    styles.cuisineChip,
                    active && styles.cuisineChipActive,
                  ]}
                  onPress={() => toggleCuisine(cuisine)}
                >
                  <Text
                    style={[
                      styles.cuisineChipText,
                      active && styles.cuisineChipTextActive,
                    ]}
                  >
                    {cuisine}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Platform links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Platforms</Text>
          <Text style={styles.sectionHint}>
            Add your food content channels with follower counts
          </Text>
          <View style={styles.linkList}>
            {platformLinks.map((link, idx) => (
              <GlassCard key={idx} level={2} style={styles.linkCard}>
                {/* Platform picker row */}
                <View style={styles.platformRow}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.platformChips}
                  >
                    {PLATFORM_PRESETS.map((p) => {
                      const active = link.platform === p;
                      return (
                        <Pressable
                          key={p}
                          style={[
                            styles.platformChip,
                            active && styles.platformChipActive,
                          ]}
                          onPress={() => updateLink(idx, 'platform', p)}
                        >
                          <Text
                            style={[
                              styles.platformChipText,
                              active && styles.platformChipTextActive,
                            ]}
                          >
                            {p}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                <TextInput
                  style={styles.linkInput}
                  value={link.url}
                  onChangeText={(v) => updateLink(idx, 'url', v)}
                  placeholder="Profile URL"
                  placeholderTextColor="rgba(214, 195, 181, 0.3)"
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <View style={styles.followerRow}>
                  <TextInput
                    style={[styles.linkInput, styles.followerInput]}
                    value={link.followerCount}
                    onChangeText={(v) => updateLink(idx, 'followerCount', v)}
                    placeholder="Followers"
                    placeholderTextColor="rgba(214, 195, 181, 0.3)"
                    keyboardType="number-pad"
                  />
                  {platformLinks.length > 1 && (
                    <Pressable
                      style={styles.removeLinkButton}
                      onPress={() => removeLink(idx)}
                    >
                      <Text style={styles.removeLinkText}>Remove</Text>
                    </Pressable>
                  )}
                </View>
              </GlassCard>
            ))}

            <Pressable style={styles.addLinkButton} onPress={addLink}>
              <Text style={styles.addLinkText}>+ Add Platform</Text>
            </Pressable>
          </View>
        </View>

        {/* Error */}
        {error && (
          <GlassCard level={2} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={() => void handleSubmit()}
          disabled={!isValid || submitting}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Submitting...' : 'Submit Application'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 24,
  },

  // Header
  headerSection: {
    gap: 6,
  },
  pageTitle: {
    ...RECIPES_TYPOGRAPHY.displayLg,
    fontSize: 26,
    lineHeight: 34,
    color: colors.text,
  },
  pageSubtitle: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: RECIPES_SECONDARY,
  },

  // Section
  section: {
    gap: 10,
  },
  sectionTitle: {
    ...RECIPES_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  sectionHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.5)',
    marginTop: -4,
  },

  // Bio input
  inputCard: {
    gap: 8,
  },
  bioInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    minHeight: 120,
  },
  charCount: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 11,
    color: 'rgba(214, 195, 181, 0.4)',
    textAlign: 'right',
  },

  // Cuisine grid
  cuisineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cuisineChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  cuisineChipActive: {
    backgroundColor: RECIPES_ACCENT,
  },
  cuisineChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 13,
    color: colors.text,
  },
  cuisineChipTextActive: {
    color: '#0E0E13',
  },

  // Platform links
  linkList: {
    gap: 12,
  },
  linkCard: {
    gap: 10,
  },
  platformRow: {
    marginHorizontal: -4,
  },
  platformChips: {
    gap: 6,
    paddingHorizontal: 4,
  },
  platformChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.depth,
  },
  platformChipActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  platformChipText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.6)',
  },
  platformChipTextActive: {
    color: RECIPES_ACCENT,
  },
  linkInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: RECIPES_SURFACES.depth,
  },
  followerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  followerInput: {
    flex: 1,
  },
  removeLinkButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  removeLinkText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: '#FFB4AB',
  },
  addLinkButton: {
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: RECIPES_SURFACES.lift,
    alignItems: 'center',
  },
  addLinkText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 14,
    color: RECIPES_ACCENT,
  },

  // Error
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  errorText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#FFB4AB',
  },

  // Submit
  submitButton: {
    paddingVertical: 16,
    borderRadius: 999,
    backgroundColor: RECIPES_ACCENT,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: RECIPES_SURFACES.focus,
  },
  submitButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: '#0E0E13',
  },

  // Status view
  statusCard: {
    gap: 14,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
  },
  statusMessage: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  dashboardButton: {
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: RECIPES_ACCENT,
    alignItems: 'center',
    marginTop: 4,
  },
  dashboardButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },

  // Summary
  summaryCard: {
    gap: 10,
  },
  summaryTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
  summaryBio: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  summaryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryCuisineChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  summaryCuisineText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: RECIPES_ACCENT,
  },

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successEmoji: {
    fontSize: 36,
  },
  successTitle: {
    fontFamily: JAKARTA_FONTS.extraBold,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  successMessage: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: RECIPES_SECONDARY,
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 20,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: RECIPES_SURFACES.focus,
  },
  doneButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 16,
    color: colors.text,
  },
});
