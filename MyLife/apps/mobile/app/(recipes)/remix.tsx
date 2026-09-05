import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GitFork } from 'lucide-react-native';
import {
  type BestChefResult,
  type RecipeSnapshot,
  type RecipeFork,
  JAKARTA_FONTS,
  RECIPES_ACCENT,
  RECIPES_SECONDARY,
  RECIPES_SURFACES,
  RECIPES_TYPOGRAPHY,
} from '@mylife/bestchef';
import { GlassCard } from '@mylife/bestchef/ui';
import { ErrorState, LoadingState, Text, colors } from '@mylife/ui';

// ── Stubs (cloud functions not yet implemented) ──────────────────────

async function getSourceRecipe(
  snapshotId: string,
): Promise<BestChefResult<RecipeSnapshot>> {
  return {
    ok: true,
    data: {
      id: snapshotId,
      originalLocalRecipeId: null,
      profileId: 'source-chef',
      title: 'Source Recipe',
      description: 'A delicious recipe to remix',
      servings: 4,
      prepTimeMins: 15,
      cookTimeMins: 30,
      totalTimeMins: 45,
      difficulty: 'medium',
      ingredientsJson: [],
      stepsJson: [],
      tags: [],
      nutritionJson: null,
      sourceUrl: null,
      sourceAttribution: null,
      createdAt: new Date(),
    },
  };
}

async function forkRecipe(
  sourceSnapshotId: string,
  _title: string,
  _description: string,
  _changes: string,
): Promise<BestChefResult<RecipeFork>> {
  return {
    ok: true,
    data: {
      id: crypto.randomUUID(),
      sourceSnapshotId,
      forkedByProfileId: 'me',
      forkedSnapshotId: crypto.randomUUID(),
      createdAt: new Date(),
    },
  };
}

// ── Component ────────────────────────────────────────────────────────

export default function RemixScreen() {
  const { snapshotId, sourceTitle } = useLocalSearchParams<{
    snapshotId: string;
    sourceTitle?: string;
  }>();
  const router = useRouter();

  const [source, setSource] = useState<RecipeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Editor fields (pre-filled from source)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [changes, setChanges] = useState('');

  const load = useCallback(async () => {
    if (!snapshotId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSourceRecipe(snapshotId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSource(result.data);
      setTitle(result.data.title);
      setDescription(result.data.description ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe');
    } finally {
      setLoading(false);
    }
  }, [snapshotId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSubmit = async () => {
    if (!snapshotId || !title.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await forkRecipe(
        snapshotId,
        title.trim(),
        description.trim(),
        changes.trim(),
      );
      if (result.ok) {
        router.back();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create remix');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <LoadingState rows={6} />
      </View>
    );
  }

  if (error && !source) {
    return (
      <View style={styles.screen}>
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }

  const displayTitle = sourceTitle ?? source?.title ?? 'Unknown Recipe';
  const chefName = source?.profileId.slice(0, 8) ?? 'Unknown';

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Source attribution header */}
        <GlassCard level={2} style={styles.attributionCard}>
          <View style={styles.attributionRow}>
            <GitFork size={18} color={RECIPES_ACCENT} strokeWidth={2} />
            <View style={styles.attributionInfo}>
              <Text style={styles.attributionLabel}>Remixing</Text>
              <Text style={styles.attributionTitle}>{displayTitle}</Text>
              <Text style={styles.attributionChef}>by @{chefName}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Inspired by display */}
        <View style={styles.inspiredRow}>
          <View style={styles.inspiredDot} />
          <Text style={styles.inspiredText}>
            Inspired by @{chefName}
          </Text>
        </View>

        {/* Title field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Recipe Title</Text>
          <TextInput
            style={styles.fieldInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Give your remix a name"
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
          />
        </View>

        {/* Description field */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldInputMulti]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your remix"
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
            multiline
          />
        </View>

        {/* Source recipe info */}
        {source != null && (
          <GlassCard level={1} style={styles.sourceInfoCard}>
            <Text style={styles.sourceInfoTitle}>Source Recipe Info</Text>
            <View style={styles.sourceInfoRow}>
              {source.servings != null && (
                <View style={styles.sourceInfoItem}>
                  <Text style={styles.sourceInfoValue}>{source.servings}</Text>
                  <Text style={styles.sourceInfoLabel}>servings</Text>
                </View>
              )}
              {source.prepTimeMins != null && (
                <View style={styles.sourceInfoItem}>
                  <Text style={styles.sourceInfoValue}>
                    {source.prepTimeMins}m
                  </Text>
                  <Text style={styles.sourceInfoLabel}>prep</Text>
                </View>
              )}
              {source.cookTimeMins != null && (
                <View style={styles.sourceInfoItem}>
                  <Text style={styles.sourceInfoValue}>
                    {source.cookTimeMins}m
                  </Text>
                  <Text style={styles.sourceInfoLabel}>cook</Text>
                </View>
              )}
              {source.difficulty != null && (
                <View style={styles.sourceInfoItem}>
                  <Text style={styles.sourceInfoValue}>
                    {source.difficulty}
                  </Text>
                  <Text style={styles.sourceInfoLabel}>difficulty</Text>
                </View>
              )}
            </View>
          </GlassCard>
        )}

        {/* What did you change? */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>What did you change?</Text>
          <Text style={styles.fieldHint}>
            Describe the modifications you made to the original recipe
          </Text>
          <TextInput
            style={[styles.fieldInput, styles.fieldInputLarge]}
            value={changes}
            onChangeText={setChanges}
            placeholder="e.g. Swapped butter for olive oil, added garlic..."
            placeholderTextColor="rgba(214, 195, 181, 0.4)"
            multiline
          />
        </View>

        {/* Error display */}
        {error != null && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            pressed && styles.submitButtonPressed,
            submitting && styles.submitButtonDisabled,
          ]}
          onPress={() => void handleSubmit()}
          disabled={submitting || !title.trim()}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? 'Creating Remix...' : 'Create Remix'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: RECIPES_SURFACES.base,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 20,
  },

  // Attribution
  attributionCard: {
    gap: 8,
  },
  attributionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  attributionInfo: {
    flex: 1,
    gap: 2,
  },
  attributionLabel: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    color: RECIPES_ACCENT,
    textTransform: 'uppercase',
  },
  attributionTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 18,
    color: colors.text,
  },
  attributionChef: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(214, 195, 181, 0.6)',
  },

  // Inspired by
  inspiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  inspiredDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: RECIPES_SECONDARY,
  },
  inspiredText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: RECIPES_SECONDARY,
    fontStyle: 'italic',
  },

  // Form fields
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...RECIPES_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
    fontSize: 11,
  },
  fieldHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.4)',
  },
  fieldInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: RECIPES_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldInputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldInputLarge: {
    minHeight: 120,
    textAlignVertical: 'top',
  },

  // Source info
  sourceInfoCard: {
    gap: 10,
  },
  sourceInfoTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.textSecondary,
  },
  sourceInfoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  sourceInfoItem: {
    alignItems: 'center',
    gap: 2,
  },
  sourceInfoValue: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: colors.text,
  },
  sourceInfoLabel: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 10,
    color: 'rgba(214, 195, 181, 0.5)',
  },

  // Error
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    padding: 12,
  },
  errorText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: '#FFB4AB',
  },

  // Submit
  submitButton: {
    backgroundColor: RECIPES_ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonPressed: {
    opacity: 0.85,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 15,
    color: '#0E0E13',
  },
});
