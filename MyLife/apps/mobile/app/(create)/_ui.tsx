import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import type {
  CreateProgressTimelineItem,
  CreateProjectRecord,
  CreateProjectSortBy,
  CreateProjectStatus,
  CreateProjectType,
} from '@mylife/create';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';

export const CREATE_ACCENT = colors.modules.create;
const CREATE_ACCENT_DIM = 'rgba(217,70,239,0.16)';
const CREATE_ACCENT_BORDER = 'rgba(217,70,239,0.28)';

const STATUS_STYLES: Record<
  CreateProjectStatus,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  idea: {
    backgroundColor: 'rgba(251,191,36,0.16)',
    borderColor: 'rgba(251,191,36,0.28)',
    textColor: '#FDE68A',
  },
  planning: {
    backgroundColor: 'rgba(96,165,250,0.16)',
    borderColor: 'rgba(96,165,250,0.28)',
    textColor: '#BFDBFE',
  },
  in_progress: {
    backgroundColor: CREATE_ACCENT_DIM,
    borderColor: CREATE_ACCENT_BORDER,
    textColor: '#F5D0FE',
  },
  revising: {
    backgroundColor: 'rgba(249,115,22,0.16)',
    borderColor: 'rgba(249,115,22,0.28)',
    textColor: '#FDBA74',
  },
  complete: {
    backgroundColor: 'rgba(48,209,88,0.16)',
    borderColor: 'rgba(48,209,88,0.28)',
    textColor: '#86EFAC',
  },
  archived: {
    backgroundColor: 'rgba(148,163,184,0.16)',
    borderColor: 'rgba(148,163,184,0.28)',
    textColor: '#CBD5E1',
  },
};

export const CREATE_PROJECT_TYPES: CreateProjectType[] = [
  'art',
  'music',
  'video',
  'writing',
  'code',
  'craft',
  'photo',
  'design',
  'game_dev',
  'other',
];

export const CREATE_PROJECT_STATUSES: CreateProjectStatus[] = [
  'idea',
  'planning',
  'in_progress',
  'revising',
  'complete',
  'archived',
];

export const CREATE_PROJECT_SORT_OPTIONS: Array<{
  value: CreateProjectSortBy;
  label: string;
}> = [
  { value: 'updated_at', label: 'Updated' },
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'title', label: 'Title' },
  { value: 'created_at', label: 'Created' },
];

export interface CreateProjectFormState {
  title: string;
  type: CreateProjectType;
  status: CreateProjectStatus;
  description: string;
  priority: string;
  deadline: string;
  estimatedHours: string;
  toolsUsed: string;
  collaborators: string;
  publishedUrl: string;
  inspirationRefs: string;
  coverPhotoId: string;
  outcomeNotes: string;
}

export const DEFAULT_CREATE_PROJECT_FORM_STATE: CreateProjectFormState = {
  title: '',
  type: 'art',
  status: 'planning',
  description: '',
  priority: '2',
  deadline: '',
  estimatedHours: '',
  toolsUsed: '',
  collaborators: '',
  publishedUrl: '',
  inspirationRefs: '',
  coverPhotoId: '',
  outcomeNotes: '',
};

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitListInput(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function joinListInput(value: string[]): string {
  return value.join(', ');
}

export function useCreateFocusedSnapshot<T>(load: () => T): T {
  const [value, setValue] = useState<T>(() => load());
  const refresh = useCallback(() => {
    setValue(load());
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  return value;
}

export function formatCreateProjectType(type: CreateProjectType): string {
  switch (type) {
    case 'game_dev':
      return 'Game Dev';
    case 'art':
      return 'Art';
    case 'music':
      return 'Music';
    case 'video':
      return 'Video';
    case 'writing':
      return 'Writing';
    case 'code':
      return 'Code';
    case 'craft':
      return 'Craft';
    case 'photo':
      return 'Photo';
    case 'design':
      return 'Design';
    case 'other':
    default:
      return 'Other';
  }
}

export function formatCreateProjectStatus(status: CreateProjectStatus): string {
  switch (status) {
    case 'idea':
      return 'Idea';
    case 'planning':
      return 'Planning';
    case 'in_progress':
      return 'In Progress';
    case 'revising':
      return 'Revising';
    case 'complete':
      return 'Complete';
    case 'archived':
    default:
      return 'Archived';
  }
}

export function formatCreateDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function formatCreateShortDate(value: string | null | undefined): string {
  if (!value) return 'No deadline';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function getCreateNextStatus(
  status: CreateProjectStatus,
): CreateProjectStatus | null {
  const index = CREATE_PROJECT_STATUSES.indexOf(status);
  if (index === -1 || index >= CREATE_PROJECT_STATUSES.length - 2) {
    return status === 'complete' ? 'archived' : null;
  }
  return CREATE_PROJECT_STATUSES[index + 1];
}

export function createProjectFormStateFromRecord(
  project: CreateProjectRecord,
): CreateProjectFormState {
  return {
    title: project.title,
    type: project.type,
    status: project.status,
    description: project.description_md ?? '',
    priority: String(project.priority),
    deadline: project.deadline ?? '',
    estimatedHours:
      project.estimated_hours == null ? '' : String(project.estimated_hours),
    toolsUsed: joinListInput(project.tools_used),
    collaborators: joinListInput(project.collaborators),
    publishedUrl: project.published_url ?? '',
    inspirationRefs: joinListInput(project.inspiration_refs),
    coverPhotoId: project.cover_photo_id ?? '',
    outcomeNotes: project.outcome_notes ?? '',
  };
}

export function buildCreateProjectInput(state: CreateProjectFormState) {
  return {
    title: state.title.trim(),
    type: state.type,
    status: state.status,
    description_md: state.description.trim() || undefined,
    priority: parseNumberInput(state.priority) ?? 0,
    deadline: state.deadline.trim() || undefined,
    estimated_hours: parseNumberInput(state.estimatedHours),
    tools_used: splitListInput(state.toolsUsed),
    collaborators: splitListInput(state.collaborators),
    published_url: state.publishedUrl.trim() || undefined,
    inspiration_refs: splitListInput(state.inspirationRefs),
    cover_photo_id: state.coverPhotoId.trim() || undefined,
    outcome_notes: state.outcomeNotes.trim() || undefined,
  };
}

export function CreateScreen({
  eyebrow,
  title,
  body,
  actionLabel,
  onActionPress,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children?: ReactNode;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {actionLabel && onActionPress ? (
          <Pressable style={styles.primaryAction} onPress={onActionPress}>
            <Text style={styles.primaryActionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

export function CreateSettingsCard({
  rows,
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={styles.card}>
      {rows.map((row) => (
        <View key={row.label} style={styles.settingRow}>
          <Text style={styles.settingLabel}>{row.label}</Text>
          <Text style={styles.settingValue}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function CreateMetricRow({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <View style={styles.metricRow}>
      {items.map((item) => (
        <Card key={item.label} style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>
            {item.label}
          </Text>
          <Text style={styles.metricValue}>{item.value}</Text>
        </Card>
      ))}
    </View>
  );
}

export function CreateSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function CreateEmptyCard({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text variant="body" color={colors.textSecondary} style={styles.emptyBody}>
        {body}
      </Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.emptyAction} onPress={onAction}>
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CreateFilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.filterPill, active ? styles.filterPillActive : null]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.filterPillText,
          active ? styles.filterPillTextActive : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CreateStatusPill({
  status,
  active = false,
  onPress,
}: {
  status: CreateProjectStatus;
  active?: boolean;
  onPress?: () => void;
}) {
  const tone = STATUS_STYLES[status];

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.statusPill,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: active ? tone.textColor : tone.borderColor,
        },
      ]}
    >
      <Text style={[styles.statusPillText, { color: tone.textColor }]}>
        {formatCreateProjectStatus(status)}
      </Text>
    </Pressable>
  );
}

export function CreateProjectCard({
  project,
  onPress,
}: {
  project: CreateProjectRecord;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.projectCardWrap}>
      <Card elevated style={styles.projectCard}>
        <View style={styles.projectCardTopRow}>
          <View style={styles.projectCardTypeBadge}>
            <Text style={styles.projectCardTypeBadgeText}>
              {formatCreateProjectType(project.type)}
            </Text>
          </View>
          <CreateStatusPill status={project.status} />
        </View>
        <Text style={styles.projectCardTitle}>{project.title}</Text>
        <Text
          variant="body"
          color={colors.textSecondary}
          numberOfLines={2}
          style={styles.projectCardBody}
        >
          {project.description_md?.trim() ||
            'No description yet. Open the project to define scope, tools, and next milestones.'}
        </Text>
        <View style={styles.projectMetaRow}>
          <Text style={styles.projectMetaLabel}>
            Due {formatCreateShortDate(project.deadline)}
          </Text>
          <Text style={styles.projectMetaLabel}>
            {project.actual_hours}h logged
            {project.estimated_hours != null
              ? ` / ${project.estimated_hours}h est`
              : ''}
          </Text>
        </View>
        <View style={styles.projectMetaRow}>
          <Text style={styles.projectMetaLabel}>
            Priority {project.priority}
          </Text>
          <Text style={styles.projectMetaLabel}>
            {project.tools_used.length} tool
            {project.tools_used.length === 1 ? '' : 's'}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

export function CreateTimelineCard({
  item,
  isLast = false,
}: {
  item: CreateProgressTimelineItem;
  isLast?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View
          style={[
            styles.timelineDot,
            item.milestone ? styles.timelineDotHighlight : null,
          ]}
        />
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <Card
        style={[
          styles.timelineCard,
          item.milestone ? styles.timelineCardHighlight : null,
        ]}
      >
        <View style={styles.timelineTopRow}>
          <Text style={styles.timelineDate}>{item.dateLabel}</Text>
          <Text style={styles.timelineHours}>{item.hoursLabel}</Text>
        </View>
        <View style={styles.timelineBadgeRow}>
          {item.moodLabel ? (
            <View style={styles.timelineBadge}>
              <Text style={styles.timelineBadgeText}>
                {item.moodEmoji} {item.moodLabel}
              </Text>
            </View>
          ) : null}
          {item.milestoneName ? (
            <View style={[styles.timelineBadge, styles.timelineBadgeHighlight]}>
              <Text
                style={[
                  styles.timelineBadgeText,
                  styles.timelineBadgeHighlightText,
                ]}
              >
                ✦ {item.milestoneName}
              </Text>
            </View>
          ) : null}
          {item.photoCount > 0 ? (
            <View style={styles.timelineBadge}>
              <Text style={styles.timelineBadgeText}>
                📷 {item.photoCount} {item.photoCount === 1 ? 'photo' : 'photos'}
              </Text>
            </View>
          ) : null}
        </View>
        {item.notesPreview ? (
          <Text variant="body" color={colors.textSecondary} style={styles.timelineBody}>
            {item.notesPreview}
          </Text>
        ) : null}
        {item.breakthrough ? (
          <Text style={styles.timelineCallout}>
            ✦ Breakthrough: {item.breakthrough}
          </Text>
        ) : null}
        {item.roadblock ? (
          <Text style={styles.timelineSubtle}>
            ⚠ Roadblock: {item.roadblock}
          </Text>
        ) : null}
      </Card>
    </View>
  );
}

export function CreateProjectForm({
  state,
  onChange,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  onDelete,
}: {
  state: CreateProjectFormState;
  onChange: (next: CreateProjectFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
  submitDisabled?: boolean;
  onDelete?: () => void;
}) {
  function update<K extends keyof CreateProjectFormState>(
    key: K,
    value: CreateProjectFormState[K],
  ) {
    onChange({ ...state, [key]: value });
  }

  return (
    <View style={styles.formStack}>
      <CreateSection title="Basics">
        <Card style={styles.formCard}>
          <CreateField label="Project title">
            <CreateInput
              value={state.title}
              onChangeText={(value) => update('title', value)}
              placeholder="Album launch visuals"
            />
          </CreateField>
          <CreateField label="Type">
            <View style={styles.choiceWrap}>
              {CREATE_PROJECT_TYPES.map((type) => (
                <CreateFilterPill
                  key={type}
                  label={formatCreateProjectType(type)}
                  active={state.type === type}
                  onPress={() => update('type', type)}
                />
              ))}
            </View>
          </CreateField>
          <CreateField label="Status">
            <View style={styles.choiceWrap}>
              {CREATE_PROJECT_STATUSES.map((status) => (
                <CreateStatusPill
                  key={status}
                  status={status}
                  active={state.status === status}
                  onPress={() => update('status', status)}
                />
              ))}
            </View>
          </CreateField>
          <CreateField label="Description">
            <CreateInput
              multiline
              value={state.description}
              onChangeText={(value) => update('description', value)}
              placeholder="What this project is for, what done looks like, and where it should live."
            />
          </CreateField>
        </Card>
      </CreateSection>

      <CreateSection title="Delivery">
        <Card style={styles.formCard}>
          <View style={styles.row2}>
            <CreateField label="Priority" style={styles.rowField}>
              <CreateInput
                value={state.priority}
                onChangeText={(value) => update('priority', value)}
                keyboardType="number-pad"
                placeholder="2"
              />
            </CreateField>
            <CreateField label="Deadline" style={styles.rowField}>
              <CreateInput
                value={state.deadline}
                onChangeText={(value) => update('deadline', value)}
                placeholder="2026-05-10"
              />
            </CreateField>
          </View>
          <View style={styles.row2}>
            <CreateField label="Estimated hours" style={styles.rowField}>
              <CreateInput
                value={state.estimatedHours}
                onChangeText={(value) => update('estimatedHours', value)}
                keyboardType="decimal-pad"
                placeholder="14"
              />
            </CreateField>
            <CreateField label="Cover photo ref" style={styles.rowField}>
              <CreateInput
                value={state.coverPhotoId}
                onChangeText={(value) => update('coverPhotoId', value)}
                placeholder="Optional photo id"
              />
            </CreateField>
          </View>
          <CreateField label="Tools used">
            <CreateInput
              multiline
              value={state.toolsUsed}
              onChangeText={(value) => update('toolsUsed', value)}
              placeholder="Figma, Logic, Blender"
            />
          </CreateField>
        </Card>
      </CreateSection>

      <CreateSection title="Context">
        <Card style={styles.formCard}>
          <CreateField label="Collaborators">
            <CreateInput
              multiline
              value={state.collaborators}
              onChangeText={(value) => update('collaborators', value)}
              placeholder="One per line or comma-separated"
            />
          </CreateField>
          <CreateField label="Published URL">
            <CreateInput
              value={state.publishedUrl}
              onChangeText={(value) => update('publishedUrl', value)}
              placeholder="https://"
            />
          </CreateField>
          <CreateField label="Inspiration references">
            <CreateInput
              multiline
              value={state.inspirationRefs}
              onChangeText={(value) => update('inspirationRefs', value)}
              placeholder="Brief list of references or source links"
            />
          </CreateField>
          <CreateField label="Outcome notes">
            <CreateInput
              multiline
              value={state.outcomeNotes}
              onChangeText={(value) => update('outcomeNotes', value)}
              placeholder="Capture what worked, what shipped, or what changed."
            />
          </CreateField>
        </Card>
      </CreateSection>

      <View style={styles.formActionRow}>
        <Pressable
          disabled={submitDisabled}
          onPress={onSubmit}
          style={[
            styles.primaryAction,
            submitDisabled ? styles.primaryActionDisabled : null,
          ]}
        >
          <Text style={styles.primaryActionText}>{submitLabel}</Text>
        </Pressable>
        {onDelete ? (
          <Pressable style={styles.deleteAction} onPress={onDelete}>
            <Text style={styles.deleteActionText}>Delete project</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function CreateField({
  label,
  children,
  style,
}: {
  label: string;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={style}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function CreateInput({
  multiline = false,
  ...props
}: React.ComponentProps<typeof TextInput> & { multiline?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.textTertiary}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[styles.input, multiline ? styles.inputMultiline : null]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: spacing.xxl,
    gap: 16,
  },
  hero: {
    backgroundColor: CREATE_ACCENT_DIM,
    borderWidth: 1,
    borderColor: CREATE_ACCENT_BORDER,
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  eyebrow: {
    color: CREATE_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryAction: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: CREATE_ACCENT,
    borderRadius: 999,
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
  deleteAction: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.28)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,69,58,0.08)',
  },
  deleteActionText: {
    color: '#FFB4AB',
    fontSize: 13,
    fontWeight: '700',
  },
  formActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  formCard: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 18,
    padding: 16,
    gap: 14,
  },
  settingRow: {
    gap: 4,
  },
  settingLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  settingValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 150,
    gap: spacing.xs,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  metricValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  emptyCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBody: {
    lineHeight: 21,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: CREATE_ACCENT,
  },
  emptyActionText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 13,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  filterPillActive: {
    backgroundColor: CREATE_ACCENT_DIM,
    borderColor: CREATE_ACCENT_BORDER,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: colors.text,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  projectCardWrap: {
    borderRadius: 20,
  },
  projectCard: {
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  projectCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
  },
  projectCardTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(19,24,36,0.7)',
  },
  projectCardTypeBadgeText: {
    color: CREATE_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  projectCardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  projectCardBody: {
    lineHeight: 21,
  },
  projectMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  projectMetaLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  timelineRail: {
    alignItems: 'center',
    width: 18,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(217,70,239,0.22)',
    borderWidth: 2,
    borderColor: CREATE_ACCENT_BORDER,
  },
  timelineDotHighlight: {
    backgroundColor: CREATE_ACCENT,
    borderColor: '#F5D0FE',
    shadowColor: CREATE_ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: colors.glassBorder,
  },
  timelineCard: {
    flex: 1,
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  timelineCardHighlight: {
    borderColor: CREATE_ACCENT_BORDER,
    backgroundColor: CREATE_ACCENT_DIM,
  },
  timelineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    alignItems: 'center',
  },
  timelineDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  timelineHours: {
    color: CREATE_ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  timelineBadgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  timelineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  timelineBadgeHighlight: {
    backgroundColor: CREATE_ACCENT_DIM,
    borderColor: CREATE_ACCENT_BORDER,
  },
  timelineBadgeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  timelineBadgeHighlightText: {
    color: colors.text,
  },
  timelineBody: {
    lineHeight: 21,
  },
  timelineCallout: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  timelineSubtle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
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
    minHeight: 110,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  choiceWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowField: {
    flex: 1,
  },
  formStack: {
    gap: spacing.md,
  },
});
