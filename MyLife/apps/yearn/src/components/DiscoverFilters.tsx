import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SlidersHorizontal } from 'lucide-react-native';
import type { AnySupabaseClient } from '../lib/supabase';
import { YearnRepository } from '../lib/yearnRepository';
import { parseDiscoveryFilterInput } from '../lib/discoveryFilters';
import { captureCoarseLocation } from '../lib/location';
import { YEARN_INTENTION_OPTIONS } from '../lib/onboarding';
import {
  yearnColors,
  yearnRadius,
  yearnSpacing,
  yearnTypography,
} from '../theme/yearnTheme';

interface DiscoverFiltersProps {
  supabase: AnySupabaseClient | null;
  /** Called after prefs or location change server-side so the deck refetches. */
  onChanged: () => void;
}

export function DiscoverFilters({ supabase, onChanged }: DiscoverFiltersProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [minAgeText, setMinAgeText] = React.useState('18');
  const [maxAgeText, setMaxAgeText] = React.useState('');
  const [maxDistanceText, setMaxDistanceText] = React.useState('');
  const [intentionFilter, setIntentionFilter] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [errorText, setErrorText] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!supabase) return () => { cancelled = true; };
    void new YearnRepository(supabase).fetchDiscoveryPrefs()
      .then((prefs) => {
        if (cancelled || !prefs) return;
        setMinAgeText(String(prefs.minAge));
        setMaxAgeText(prefs.maxAge === null ? '' : String(prefs.maxAge));
        setMaxDistanceText(
          prefs.maxDistanceMiles === null ? '' : String(prefs.maxDistanceMiles),
        );
        setIntentionFilter(prefs.intentionFilter);
      })
      .catch(() => {
        // Prefs are optional; the defaults above are the server defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleApply = React.useCallback(async () => {
    if (!supabase || isSaving) return;
    setErrorText(null);
    setNotice(null);

    const parsed = parseDiscoveryFilterInput({
      minAgeText,
      maxAgeText,
      maxDistanceText,
      intentionFilter,
    });
    if (typeof parsed === 'string') {
      setErrorText(parsed);
      return;
    }

    setIsSaving(true);
    try {
      await new YearnRepository(supabase).saveDiscoveryPrefs(parsed);
      setNotice('Filters saved.');
      onChanged();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }, [intentionFilter, isSaving, maxAgeText, maxDistanceText, minAgeText, onChanged, supabase]);

  const handleUseLocation = React.useCallback(async () => {
    if (!supabase || isLocating) return;
    setErrorText(null);
    setNotice(null);
    setIsLocating(true);
    try {
      const capture = await captureCoarseLocation();
      if (!capture.ok) {
        setErrorText(capture.error);
        return;
      }
      await new YearnRepository(supabase).updateMyLocation(
        capture.latitude,
        capture.longitude,
      );
      setNotice('Location updated. Nearby profiles rank first.');
      onChanged();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLocating(false);
    }
  }, [isLocating, onChanged, supabase]);

  const handleClearLocation = React.useCallback(async () => {
    if (!supabase || isLocating) return;
    setErrorText(null);
    setNotice(null);
    setIsLocating(true);
    try {
      await new YearnRepository(supabase).clearMyLocation();
      setNotice('Location cleared.');
      onChanged();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLocating(false);
    }
  }, [isLocating, onChanged, supabase]);

  if (!supabase) return null;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide filters' : 'Show filters'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        style={({ pressed }) => [styles.headerRow, pressed && styles.pressed]}
      >
        <SlidersHorizontal size={16} color={yearnColors.gold} strokeWidth={2.2} />
        <Text style={styles.headerText}>Filters</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.label}>Min age</Text>
              <TextInput
                accessibilityLabel="Minimum age"
                style={styles.input}
                keyboardType="number-pad"
                value={minAgeText}
                onChangeText={setMinAgeText}
                placeholder="18"
                placeholderTextColor={yearnColors.textSecondary}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Max age</Text>
              <TextInput
                accessibilityLabel="Maximum age"
                style={styles.input}
                keyboardType="number-pad"
                value={maxAgeText}
                onChangeText={setMaxAgeText}
                placeholder="Any"
                placeholderTextColor={yearnColors.textSecondary}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Max miles</Text>
              <TextInput
                accessibilityLabel="Maximum distance in miles"
                style={styles.input}
                keyboardType="number-pad"
                value={maxDistanceText}
                onChangeText={setMaxDistanceText}
                placeholder="Any"
                placeholderTextColor={yearnColors.textSecondary}
              />
            </View>
          </View>

          <Text style={styles.label}>Looking for</Text>
          <View style={styles.chipRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Any intention"
              accessibilityState={{ selected: intentionFilter === null }}
              onPress={() => setIntentionFilter(null)}
              style={[styles.chip, intentionFilter === null && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, intentionFilter === null && styles.chipTextSelected]}
              >
                Any
              </Text>
            </Pressable>
            {YEARN_INTENTION_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Intention ${option}`}
                accessibilityState={{ selected: intentionFilter === option }}
                onPress={() => setIntentionFilter(option)}
                style={[styles.chip, intentionFilter === option && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, intentionFilter === option && styles.chipTextSelected]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply filters"
              disabled={isSaving}
              onPress={() => { void handleApply(); }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isSaving && styles.disabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={yearnColors.inkwine} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Apply</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Use my location"
              disabled={isLocating}
              onPress={() => { void handleUseLocation(); }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                isLocating && styles.disabled,
              ]}
            >
              {isLocating ? (
                <ActivityIndicator color={yearnColors.gold} size="small" />
              ) : (
                <Text style={styles.secondaryButtonText}>Use my location</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear my location"
              disabled={isLocating}
              onPress={() => { void handleClearLocation(); }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                isLocating && styles.disabled,
              ]}
            >
              <Text style={styles.secondaryButtonText}>Clear location</Text>
            </Pressable>
          </View>

          {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
          {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: yearnColors.surface,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.md,
    borderWidth: 1,
    marginBottom: yearnSpacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: yearnSpacing.sm,
    padding: yearnSpacing.md,
  },
  headerText: {
    color: yearnColors.gold,
    ...yearnTypography.label,
    textTransform: 'uppercase',
  },
  body: {
    borderTopColor: yearnColors.line,
    borderTopWidth: 1,
    gap: yearnSpacing.sm,
    padding: yearnSpacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: yearnSpacing.md,
  },
  field: {
    flex: 1,
    gap: 4,
  },
  label: {
    color: yearnColors.textSecondary,
    ...yearnTypography.label,
  },
  input: {
    backgroundColor: yearnColors.inkwine,
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.sm,
    borderWidth: 1,
    color: yearnColors.vellum,
    paddingHorizontal: yearnSpacing.sm,
    paddingVertical: 8,
    ...yearnTypography.body,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
  },
  chip: {
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 6,
  },
  chipSelected: {
    backgroundColor: yearnColors.coral,
    borderColor: yearnColors.coral,
  },
  chipText: {
    color: yearnColors.textSecondary,
    ...yearnTypography.body,
  },
  chipTextSelected: {
    color: yearnColors.inkwine,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: yearnSpacing.sm,
    marginTop: yearnSpacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: yearnColors.coral,
    borderRadius: yearnRadius.pill,
    paddingHorizontal: yearnSpacing.lg,
    paddingVertical: 8,
  },
  primaryButtonText: {
    color: yearnColors.inkwine,
    ...yearnTypography.body,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: yearnColors.line,
    borderRadius: yearnRadius.pill,
    borderWidth: 1,
    paddingHorizontal: yearnSpacing.md,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: yearnColors.gold,
    ...yearnTypography.body,
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  noticeText: {
    color: yearnColors.gold,
    ...yearnTypography.body,
  },
  errorText: {
    color: yearnColors.alarm,
    ...yearnTypography.body,
  },
});
