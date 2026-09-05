import { useCallback, useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { CreateProgressMood } from '@mylife/create';
import {
  CREATE_PROGRESS_MOOD_OPTIONS,
  createPhoto,
  createProgressEntry,
  deletePhoto,
  getProject,
} from '@mylife/create';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  CREATE_ACCENT,
  CreateEmptyCard,
  CreateFilterPill,
  CreateScreen,
  CreateSection,
  useCreateFocusedSnapshot,
} from '../_ui';

interface DraftPhoto {
  uri: string;
  takenAt: string | null;
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeProgressDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return new Date().toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T12:00:00.000Z`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseHours(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function formatHoursValue(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function adjustQuarterHours(current: string, delta: number): string {
  const next = Math.max((parseHours(current) ?? 0) + delta, 0);
  return formatHoursValue(next);
}

function toPhotoDrafts(
  assets: ImagePicker.ImagePickerAsset[],
  existing: DraftPhoto[],
): DraftPhoto[] {
  const seen = new Set(existing.map((photo) => photo.uri));
  const next = [...existing];

  for (const asset of assets) {
    if (!asset.uri || seen.has(asset.uri)) continue;
    next.push({
      uri: asset.uri,
      takenAt: asset.assetId ? new Date().toISOString() : null,
    });
    seen.add(asset.uri);
  }

  return next.slice(0, 6);
}

export default function CreateLogProgressScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const db = useDatabase();

  const project = useCreateFocusedSnapshot(
    useCallback(() => {
      if (!projectId) return null;
      return getProject(db, projectId);
    }, [db, projectId]),
  );

  const [date, setDate] = useState(todayInputValue());
  const [notes, setNotes] = useState('');
  const [hoursSpent, setHoursSpent] = useState('0.25');
  const [mood, setMood] = useState<CreateProgressMood | null>(null);
  const [milestone, setMilestone] = useState(false);
  const [milestoneName, setMilestoneName] = useState('');
  const [roadblock, setRoadblock] = useState('');
  const [breakthrough, setBreakthrough] = useState('');
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePhotoPick = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permission.status !== 'granted') {
          Alert.alert(
            'Permission required',
            'Enable photo access to attach process shots to this progress log.',
          );
          return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
              })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsMultipleSelection: true,
                selectionLimit: 6,
              });

        if (result.canceled || !result.assets?.length) return;
        setPhotos((current) => toPhotoDrafts(result.assets, current));
      } catch {
        Alert.alert('Photo import failed', 'The selected photos could not be attached.');
      }
    },
    [],
  );

  const handleSave = useCallback(() => {
    if (!project) {
      Alert.alert('Project missing', 'The target project could not be found.');
      return;
    }

    const parsedHours = parseHours(hoursSpent);
    if (parsedHours == null) {
      Alert.alert('Hours required', 'Enter the time you spent on this session.');
      return;
    }

    if (milestone && milestoneName.trim().length === 0) {
      Alert.alert('Milestone name required', 'Name the milestone before saving it.');
      return;
    }

    const createdPhotoIds: string[] = [];
    setSaving(true);

    try {
      for (const photo of photos) {
        const photoId = uuid();
        createPhoto(db, photoId, {
          project_id: project.id,
          kind: 'process',
          local_uri: photo.uri,
          taken_at: photo.takenAt ?? undefined,
        });
        createdPhotoIds.push(photoId);
      }

      createProgressEntry(db, uuid(), {
        project_id: project.id,
        date: normalizeProgressDate(date),
        notes_md: notes.trim() || undefined,
        hours_spent: parsedHours,
        mood: mood ?? undefined,
        milestone,
        milestone_name: milestone ? milestoneName.trim() : undefined,
        roadblock: roadblock.trim() || undefined,
        breakthrough: breakthrough.trim() || undefined,
        photo_ids: createdPhotoIds,
      });

      router.replace(`/(create)/project/${project.id}` as never);
    } catch (error) {
      for (const id of createdPhotoIds) {
        deletePhoto(db, id);
      }
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'The progress entry could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    breakthrough,
    date,
    db,
    hoursSpent,
    milestone,
    milestoneName,
    mood,
    notes,
    photos,
    project,
    roadblock,
    router,
  ]);

  if (!projectId || !project) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Project not found
        </Text>
        <Text variant="body" color={colors.textSecondary} style={styles.errorBody}>
          The progress log needs a valid project id. Return to the project detail
          and start again.
        </Text>
        <Pressable style={styles.primaryAction} onPress={() => router.replace('/(create)' as never)}>
          <Text style={styles.primaryActionText}>Back to projects</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Log Progress',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <CreateScreen
        eyebrow={project.title}
        title="Log Progress"
        body="Capture what moved, what blocked, and what clicked so the timeline stays useful as the project evolves."
      >
        <CreateSection title="Session">
          <Card style={styles.sectionCard}>
            <Field label="Date">
              <Input
                value={date}
                onChangeText={setDate}
                placeholder="2026-04-21"
              />
            </Field>
            <Field label="Hours spent">
              <View style={styles.hoursRow}>
                <Pressable
                  style={styles.stepButton}
                  onPress={() => setHoursSpent((current) => adjustQuarterHours(current, -0.25))}
                >
                  <Text style={styles.stepButtonText}>-0.25</Text>
                </Pressable>
                <Input
                  value={hoursSpent}
                  onChangeText={setHoursSpent}
                  keyboardType="decimal-pad"
                  placeholder="0.25"
                  style={styles.hoursInput}
                />
                <Pressable
                  style={styles.stepButton}
                  onPress={() => setHoursSpent((current) => adjustQuarterHours(current, 0.25))}
                >
                  <Text style={styles.stepButtonText}>+0.25</Text>
                </Pressable>
              </View>
            </Field>
            <Field label="What did you work on?">
              <Input
                multiline
                value={notes}
                onChangeText={setNotes}
                placeholder="Blocked the landing page hero, tuned the render pass, and cleaned up the export."
              />
            </Field>
          </Card>
        </CreateSection>

        <CreateSection title="Signal">
          <Card style={styles.sectionCard}>
            <Field label="Mood">
              <View style={styles.choiceWrap}>
                {CREATE_PROGRESS_MOOD_OPTIONS.map((option) => (
                  <CreateFilterPill
                    key={option.value}
                    label={`${option.emoji} ${option.label}`}
                    active={mood === option.value}
                    onPress={() =>
                      setMood((current) =>
                        current === option.value ? null : option.value,
                      )
                    }
                  />
                ))}
              </View>
            </Field>
            <Field label="Milestone">
              <View style={styles.choiceWrap}>
                <CreateFilterPill
                  label={milestone ? 'Milestone on' : 'Milestone off'}
                  active={milestone}
                  onPress={() => setMilestone((current) => !current)}
                />
              </View>
            </Field>
            {milestone ? (
              <Field label="Milestone name">
                <Input
                  value={milestoneName}
                  onChangeText={setMilestoneName}
                  placeholder="First draft complete"
                />
              </Field>
            ) : null}
            <Field label="Roadblock">
              <Input
                multiline
                value={roadblock}
                onChangeText={setRoadblock}
                placeholder="What is slowing this down right now?"
              />
            </Field>
            <Field label="Breakthrough">
              <Input
                multiline
                value={breakthrough}
                onChangeText={setBreakthrough}
                placeholder="Any aha moment worth surfacing later?"
              />
            </Field>
          </Card>
        </CreateSection>

        <CreateSection title="Photos">
          <Card style={styles.sectionCard}>
            <Text variant="body" color={colors.textSecondary} style={styles.helperCopy}>
              Attach process shots from the camera or library. They are stored as
              project-linked progress photos and referenced from this entry.
            </Text>
            <View style={styles.photoActionRow}>
              <Pressable
                style={styles.photoAction}
                onPress={() => handlePhotoPick('camera')}
              >
                <Text style={styles.photoActionText}>Take photo</Text>
              </Pressable>
              <Pressable
                style={styles.photoActionGhost}
                onPress={() => handlePhotoPick('library')}
              >
                <Text style={styles.photoActionGhostText}>Choose photos</Text>
              </Pressable>
            </View>
            {photos.length === 0 ? (
              <CreateEmptyCard
                title="No process shots yet"
                body="Add sketches, renders, or workbench photos if the visual history matters for this project."
              />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photoStrip}>
                  {photos.map((photo) => (
                    <View key={photo.uri} style={styles.photoFrame}>
                      <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                      <Pressable
                        style={styles.photoRemove}
                        onPress={() =>
                          setPhotos((current) =>
                            current.filter((entry) => entry.uri !== photo.uri),
                          )
                        }
                      >
                        <Text style={styles.photoRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}
          </Card>
        </CreateSection>

        <View style={styles.actionRow}>
          <Pressable
            disabled={saving}
            style={[styles.primaryAction, saving ? styles.primaryActionDisabled : null]}
            onPress={handleSave}
          >
            <Text style={styles.primaryActionText}>
              {saving ? 'Saving...' : 'Save progress'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.cancelAction}
            onPress={() => router.replace(`/(create)/project/${project.id}` as never)}
          >
            <Text style={styles.cancelActionText}>Cancel</Text>
          </Pressable>
        </View>
      </CreateScreen>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Input({
  multiline = false,
  style,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  multiline?: boolean;
  style?: object;
}) {
  return (
    <TextInput
      placeholderTextColor={colors.textTertiary}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        styles.input,
        multiline ? styles.inputMultiline : null,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  errorTitle: {
    color: colors.text,
    textAlign: 'center',
  },
  errorBody: {
    textAlign: 'center',
    lineHeight: 21,
  },
  sectionCard: {
    gap: spacing.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: 'rgba(19,24,36,0.68)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 120,
  },
  hoursRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  hoursInput: {
    flex: 1,
  },
  stepButton: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  choiceWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  helperCopy: {
    lineHeight: 21,
  },
  photoActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoAction: {
    borderRadius: borderRadius.pill,
    backgroundColor: CREATE_ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  photoActionText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  photoActionGhost: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  photoActionGhostText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  photoStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  photoFrame: {
    width: 120,
    gap: spacing.xs,
  },
  photoThumb: {
    width: 120,
    height: 120,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  photoRemove: {
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,69,58,0.12)',
  },
  photoRemoveText: {
    color: '#FFB4AB',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  primaryAction: {
    borderRadius: borderRadius.pill,
    backgroundColor: CREATE_ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryActionDisabled: {
    opacity: 0.45,
  },
  primaryActionText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelAction: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
