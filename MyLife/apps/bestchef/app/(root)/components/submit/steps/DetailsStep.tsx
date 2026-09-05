import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { StepHeader } from '@mylife/bestchef/ui';
import { getAllRegions } from '@mylife/bestchef';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../../../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors } from '../../../providers/AppThemeProvider';
import { INPUT_CAPS, sanitizeFreeText } from '../../../utils/validation';
import type { SubmitDraftState, Difficulty } from '../../../state/useSubmitDraft';
import type { Dispatch } from 'react';

type Action =
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_DESCRIPTION'; value: string }
  | { type: 'SET_COOK_MINUTES'; value: number }
  | { type: 'SET_DIFFICULTY'; value: Difficulty }
  | { type: 'SET_REGION'; value: string }
  | { type: 'SET_IS_RESTAURANT'; value: boolean }
  | { type: 'SET_ENTER_COMPETITION'; value: boolean };

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const COOK_MIN = 5;
const COOK_MAX = 240;
const COOK_STEP = 5;

interface DetailsStepProps {
  draft: SubmitDraftState;
  dispatch: Dispatch<Action>;
}

export function DetailsStep({ draft, dispatch }: DetailsStepProps) {
  const tc = useThemeColors();
  const { t } = useI18n();
  const [regions, setRegions] = useState<string[]>([]);
  const [regionQuery, setRegionQuery] = useState(draft.region);
  const [showRegionSuggestions, setShowRegionSuggestions] = useState(false);

  useEffect(() => {
    getAllRegions().then((result) => {
      if (result.ok) setRegions(result.data);
    }).catch(() => {});
  }, []);

  const filteredRegions = regionQuery.length > 0
    ? regions.filter((r) => r.toLowerCase().includes(regionQuery.toLowerCase())).slice(0, 6)
    : regions.slice(0, 6);

  function stepCookTime(dir: 1 | -1) {
    const next = draft.cookMinutes + dir * COOK_STEP;
    if (next < COOK_MIN || next > COOK_MAX) return;
    dispatch({ type: 'SET_COOK_MINUTES', value: next });
  }

  return (
    <View style={styles.container}>
      <StepHeader
        title={t('Recipe details')}
        subtitle={t('Recipe details')}
        required
      />

      {/* Title */}
      <View style={styles.fieldGroup}>
        <FieldLabel label={t('Recipe Title')} required />
        <TextInput
          style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
          placeholder={t("e.g. Grandma's Street Pad Thai")}
          placeholderTextColor={tc.textTertiary}
          value={draft.title}
          onChangeText={(v) => dispatch({ type: 'SET_TITLE', value: sanitizeFreeText(v, INPUT_CAPS.dishTitle) })}
          maxLength={INPUT_CAPS.dishTitle}
        />
      </View>

      {/* Description */}
      <View style={styles.fieldGroup}>
        <FieldLabel label={t('Description')} />
        <TextInput
          style={[styles.input, styles.multilineInput, { color: tc.text, backgroundColor: tc.surface }]}
          placeholder={t('What makes your recipe special?')}
          placeholderTextColor={tc.textTertiary}
          value={draft.description}
          onChangeText={(v) => dispatch({ type: 'SET_DESCRIPTION', value: sanitizeFreeText(v, INPUT_CAPS.recipeDescription) })}
          maxLength={INPUT_CAPS.recipeDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Cook time stepper */}
      <View style={styles.fieldGroup}>
        <FieldLabel label={t('Cook time')} />
        <View style={[styles.stepper, { backgroundColor: tc.surface }]}>
          <Pressable
            onPress={() => stepCookTime(-1)}
            disabled={draft.cookMinutes <= COOK_MIN}
            hitSlop={8}
          >
            <Minus size={20} color={draft.cookMinutes <= COOK_MIN ? tc.textTertiary : tc.accent} strokeWidth={2} />
          </Pressable>
          <Text style={[styles.stepperValue, { color: tc.text }]}>{draft.cookMinutes} {t('min')}</Text>
          <Pressable
            onPress={() => stepCookTime(1)}
            disabled={draft.cookMinutes >= COOK_MAX}
            hitSlop={8}
          >
            <Plus size={20} color={draft.cookMinutes >= COOK_MAX ? tc.textTertiary : tc.accent} strokeWidth={2} />
          </Pressable>
        </View>
      </View>

      {/* Difficulty chips */}
      <View style={styles.fieldGroup}>
        <FieldLabel label={t('Difficulty')} />
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => {
            const isOn = draft.difficulty === d;
            const chipColor = d === 'Easy' ? '#30D158' : d === 'Medium' ? '#FF9F0A' : '#FF453A';
            return (
              <Pressable
                key={d}
                style={[
                  styles.diffChip,
                  isOn
                    ? { backgroundColor: chipColor }
                    : { backgroundColor: tc.surface, borderColor: `${chipColor}60`, borderWidth: 1 },
                ]}
                onPress={() => dispatch({ type: 'SET_DIFFICULTY', value: d })}
              >
                <Text style={[styles.diffChipText, { color: isOn ? '#fff' : chipColor }]}>
                  {t(d as never)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Region autocomplete */}
      <View style={styles.fieldGroup}>
        <FieldLabel label={t('Region')} />
        <TextInput
          style={[styles.input, { color: tc.text, backgroundColor: tc.surface }]}
          placeholder={t('e.g. Italian-American, Oaxacan')}
          placeholderTextColor={tc.textTertiary}
          value={regionQuery}
          onChangeText={(v) => {
            setRegionQuery(v);
            dispatch({ type: 'SET_REGION', value: v });
            setShowRegionSuggestions(true);
          }}
          onFocus={() => setShowRegionSuggestions(true)}
          onBlur={() => setTimeout(() => setShowRegionSuggestions(false), 200)}
        />
        {showRegionSuggestions && filteredRegions.length > 0 && (
          <View style={[styles.suggestions, { backgroundColor: tc.surface }]}>
            {filteredRegions.map((r) => (
              <Pressable
                key={r}
                style={styles.suggestionRow}
                onPress={() => {
                  setRegionQuery(r);
                  dispatch({ type: 'SET_REGION', value: r });
                  setShowRegionSuggestions(false);
                }}
              >
                <Text style={[styles.suggestionText, { color: tc.text }]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Restaurant toggle */}
      <View style={[styles.toggleCard, { backgroundColor: tc.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: tc.text }]}>{t('Submit as restaurant kitchen')}</Text>
        </View>
        <Switch
          value={draft.isRestaurant}
          onValueChange={(v) => dispatch({ type: 'SET_IS_RESTAURANT', value: v })}
          trackColor={{ true: tc.accent }}
          ios_backgroundColor={tc.surface}
        />
      </View>

      {/* Competition toggle */}
      <View style={[styles.toggleCard, { backgroundColor: tc.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.toggleLabel, { color: tc.text }]}>{t('Enter Top-100 competition')}</Text>
        </View>
        <Switch
          value={draft.enterCompetition}
          onValueChange={(v) => dispatch({ type: 'SET_ENTER_COMPETITION', value: v })}
          trackColor={{ true: tc.accent }}
          ios_backgroundColor={tc.surface}
        />
      </View>
    </View>
  );
}

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  const tc = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
      <Text style={[{ fontFamily: JAKARTA_FONTS.bold, fontSize: 13, color: tc.text }]}>{label}</Text>
      {required && <Text style={{ color: tc.accent, fontSize: 13 }}>•</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 18 },
  fieldGroup: { gap: 8 },
  input: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepperValue: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  chipRow: { flexDirection: 'row', gap: 8 },
  diffChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  diffChipText: { fontFamily: JAKARTA_FONTS.semiBold, fontSize: 13 },
  suggestions: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionText: { fontFamily: JAKARTA_FONTS.regular, fontSize: 14 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    padding: 14,
  },
  toggleLabel: { fontFamily: JAKARTA_FONTS.bold, fontSize: 14 },
});
