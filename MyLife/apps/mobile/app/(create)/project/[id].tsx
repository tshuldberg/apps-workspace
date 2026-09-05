import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  getBreakthroughs,
  getProject,
  listMilestones,
  listProgressByProject,
  ProgressTimeline,
  updateProjectStatus,
} from '@mylife/create';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  CREATE_PROJECT_STATUSES,
  CreateEmptyCard,
  CreateMetricRow,
  CreateScreen,
  CreateSection,
  CreateStatusPill,
  CreateTimelineCard,
  formatCreateDate,
  formatCreateProjectStatus,
  formatCreateProjectType,
  getCreateNextStatus,
  useCreateFocusedSnapshot,
} from '../_ui';

interface DetailSnapshot {
  project: ReturnType<typeof getProject>;
  progress: ReturnType<typeof listProgressByProject>;
  milestones: ReturnType<typeof listMilestones>;
  breakthroughs: ReturnType<typeof getBreakthroughs>;
}

export default function CreateProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const db = useDatabase();

  const snapshot = useCreateFocusedSnapshot<DetailSnapshot>(
    useCallback(() => {
      if (!id) {
        return {
          project: null,
          progress: [],
          milestones: [],
          breakthroughs: [],
        };
      }

      const project = getProject(db, id);
      if (!project) {
        return {
          project: null,
          progress: [],
          milestones: [],
          breakthroughs: [],
        };
      }

      return {
        project,
        progress: listProgressByProject(db, id),
        milestones: listMilestones(db, id),
        breakthroughs: getBreakthroughs(db, id),
      };
    }, [db, id]),
  );

  if (!id) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Missing project id
        </Text>
      </View>
    );
  }

  if (!snapshot.project) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Project not found
        </Text>
        <Text variant="body" color={colors.textSecondary} style={styles.errorBody}>
          The project may have been deleted or the route is stale.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(create)' as never)}>
          <Text style={styles.primaryBtnText}>Back to projects</Text>
        </Pressable>
      </View>
    );
  }

  const project = snapshot.project;
  const nextStatus = getCreateNextStatus(project.status);

  function changeStatus(next: typeof project.status) {
    const updated = updateProjectStatus(db, project.id, next);
    if (!updated) {
      Alert.alert('Update failed', 'The project could not be updated.');
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: project.title,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <CreateScreen
        eyebrow={formatCreateProjectType(project.type)}
        title={project.title}
        body={
          project.description_md?.trim() ||
          'No description yet. Add one from Edit Project to capture the brief, constraints, and desired finish line.'
        }
        actionLabel="Edit Project"
        onActionPress={() =>
          router.push(`/(create)/project/edit/${project.id}` as never)
        }
      >
        <CreateMetricRow
          items={[
            { label: 'Stage', value: formatCreateProjectStatus(project.status) },
            { label: 'Deadline', value: formatCreateDate(project.deadline) },
            {
              label: 'Hours',
              value:
                project.estimated_hours == null
                  ? `${project.actual_hours} logged`
                  : `${project.actual_hours} / ${project.estimated_hours}`,
            },
            { label: 'Updated', value: formatCreateDate(project.updated_at) },
          ]}
        />

        <CreateSection title="Status Pipeline">
          <View style={styles.pipelineWrap}>
            {CREATE_PROJECT_STATUSES.map((status) => (
              <CreateStatusPill
                key={status}
                status={status}
                active={project.status === status}
                onPress={() => changeStatus(status)}
              />
            ))}
          </View>
        </CreateSection>

        <CreateSection title="Quick Actions">
          <View style={styles.actionRow}>
            <Pressable
              style={styles.quickAction}
              onPress={() =>
                router.push(
                  `/(create)/project/log-progress?projectId=${project.id}` as never,
                )
              }
            >
              <Text style={styles.quickActionText}>Log progress</Text>
            </Pressable>
            {nextStatus ? (
              <Pressable
                style={styles.quickAction}
                onPress={() => changeStatus(nextStatus)}
              >
                <Text style={styles.quickActionText}>
                  Advance to {formatCreateProjectStatus(nextStatus)}
                </Text>
              </Pressable>
            ) : null}
            {project.status !== 'complete' && project.status !== 'archived' ? (
              <Pressable
                style={styles.quickAction}
                onPress={() => changeStatus('complete')}
              >
                <Text style={styles.quickActionText}>Mark complete</Text>
              </Pressable>
            ) : null}
            {project.status !== 'archived' ? (
              <Pressable
                style={styles.quickActionGhost}
                onPress={() => changeStatus('archived')}
              >
                <Text style={styles.quickActionGhostText}>Archive</Text>
              </Pressable>
            ) : null}
          </View>
        </CreateSection>

        <CreateSection title="Project Details">
          <Card style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Priority</Text>
              <Text style={styles.detailValue}>{project.priority}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Tools</Text>
              <Text style={styles.detailValue}>
                {project.tools_used.length > 0
                  ? project.tools_used.join(', ')
                  : 'None added'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Collaborators</Text>
              <Text style={styles.detailValue}>
                {project.collaborators.length > 0
                  ? project.collaborators.join(', ')
                  : 'Solo'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Published URL</Text>
              <Text style={styles.detailValue}>
                {project.published_url?.trim() || 'Not linked'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Cover Photo Ref</Text>
              <Text style={styles.detailValue}>
                {project.cover_photo_id?.trim() || 'Not linked'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Inspiration</Text>
              <Text style={styles.detailValue}>
                {project.inspiration_refs.length > 0
                  ? project.inspiration_refs.join(', ')
                  : 'No references saved'}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Outcome Notes</Text>
              <Text style={styles.detailValue}>
                {project.outcome_notes?.trim() || 'No outcome notes yet'}
              </Text>
            </View>
          </Card>
        </CreateSection>

        <CreateSection title="Milestones">
          {snapshot.milestones.length === 0 ? (
            <CreateEmptyCard
              title="No milestones yet"
              body="Mark any progress log as a milestone to spotlight major turning points here."
            />
          ) : (
            <View style={styles.stack}>
              {snapshot.milestones.map((entry) => (
                <Card key={entry.id} style={styles.noteCard}>
                  <Text style={styles.noteTitle}>
                    {entry.milestone_name?.trim() || 'Milestone'}
                  </Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {formatCreateDate(entry.date)}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </CreateSection>

        <CreateSection title="Breakthroughs">
          {snapshot.breakthroughs.length === 0 ? (
            <CreateEmptyCard
              title="No breakthroughs captured"
              body="Breakthrough notes from progress logs will stack here for quick review."
            />
          ) : (
            <View style={styles.stack}>
              {snapshot.breakthroughs.map((entry) => (
                <Card key={entry.id} style={styles.noteCard}>
                  <Text style={styles.noteTitle}>{formatCreateDate(entry.date)}</Text>
                  <Text variant="body" color={colors.textSecondary}>
                    {entry.breakthrough}
                  </Text>
                </Card>
              ))}
            </View>
          )}
        </CreateSection>

        <CreateSection title="Progress Timeline">
          <View style={styles.stack}>
            <ProgressTimeline
              entries={snapshot.progress}
              emptyState={
                <CreateEmptyCard
                  title="No progress logged"
                  body="Capture the first work session, milestone, or breakthrough to build the project timeline."
                  actionLabel="Log first entry"
                  onAction={() =>
                    router.push(
                      `/(create)/project/log-progress?projectId=${project.id}` as never,
                    )
                  }
                />
              }
              renderItem={({ item, isLast }) => (
                <CreateTimelineCard item={item} isLast={isLast} />
              )}
            />
          </View>
        </CreateSection>
      </CreateScreen>
    </>
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
  primaryBtn: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.modules.create,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  pipelineWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickAction: {
    borderRadius: borderRadius.pill,
    backgroundColor: colors.modules.create,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickActionText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },
  quickActionGhost: {
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickActionGhostText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  detailCard: {
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  detailRow: {
    gap: 6,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailValue: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  stack: {
    gap: spacing.sm,
  },
  noteCard: {
    gap: spacing.xs,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
