import { useCallback, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  listProjects,
  type CreateProjectSortBy,
  type CreateProjectStatus,
  type CreateProjectType,
} from '@mylife/create';
import { Card, Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  CREATE_PROJECT_SORT_OPTIONS,
  CREATE_PROJECT_STATUSES,
  CREATE_PROJECT_TYPES,
  CreateEmptyCard,
  CreateFilterPill,
  CreateMetricRow,
  CreateProjectCard,
  CreateScreen,
  CreateSection,
  formatCreateProjectStatus,
  formatCreateProjectType,
  useCreateFocusedSnapshot,
} from './_ui';

type StatusFilter = 'all' | CreateProjectStatus;
type TypeFilter = 'all' | CreateProjectType;

function countDueSoon(statuses: ReturnType<typeof listProjects>): number {
  const today = new Date();
  const horizon = new Date();
  horizon.setDate(today.getDate() + 14);

  return statuses.filter((project) => {
    if (!project.deadline || project.status === 'complete' || project.status === 'archived') {
      return false;
    }
    const due = new Date(project.deadline);
    return due >= today && due <= horizon;
  }).length;
}

export default function CreateProjectsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortBy, setSortBy] = useState<CreateProjectSortBy>('updated_at');

  const projects = useCreateFocusedSnapshot(
    useCallback(
      () =>
        listProjects(db, {
          search: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          type: typeFilter === 'all' ? undefined : typeFilter,
          sort_by: sortBy,
          limit: 200,
        }),
      [db, search, sortBy, statusFilter, typeFilter],
    ),
  );

  const allProjects = useCreateFocusedSnapshot(
    useCallback(
      () =>
        listProjects(db, {
          sort_by: 'updated_at',
          limit: 500,
        }),
      [db],
    ),
  );

  const activeProjects = allProjects.filter(
    (project) =>
      project.status !== 'complete' && project.status !== 'archived',
  ).length;
  const completedProjects = allProjects.filter(
    (project) => project.status === 'complete',
  ).length;

  return (
    <CreateScreen
      eyebrow="Phase 1B"
      title="Projects"
      body="Search, sort, and filter the MyCreate project board. Open any card for detail, workflow stage changes, and the linked progress timeline."
      actionLabel="Add Project"
      onActionPress={() => router.push('/(create)/project/add' as never)}
    >
      <CreateMetricRow
        items={[
          { label: 'Total', value: String(allProjects.length) },
          { label: 'Active', value: String(activeProjects) },
          { label: 'Due Soon', value: String(countDueSoon(allProjects)) },
          { label: 'Complete', value: String(completedProjects) },
        ]}
      />

      <CreateSection title="Search">
        <Card style={styles.filterCard}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by project title"
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
          />
          <Text style={styles.filterHint}>
            Filters combine live SQLite search with project type, stage, and sort.
          </Text>
        </Card>
      </CreateSection>

      <CreateSection title="Status Filter">
        <View style={styles.pillWrap}>
          <CreateFilterPill
            label="All"
            active={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
          />
          {CREATE_PROJECT_STATUSES.map((status) => (
            <CreateFilterPill
              key={status}
              label={formatCreateProjectStatus(status)}
              active={statusFilter === status}
              onPress={() => setStatusFilter(status)}
            />
          ))}
        </View>
      </CreateSection>

      <CreateSection title="Type Filter">
        <View style={styles.pillWrap}>
          <CreateFilterPill
            label="All"
            active={typeFilter === 'all'}
            onPress={() => setTypeFilter('all')}
          />
          {CREATE_PROJECT_TYPES.map((type) => (
            <CreateFilterPill
              key={type}
              label={formatCreateProjectType(type)}
              active={typeFilter === type}
              onPress={() => setTypeFilter(type)}
            />
          ))}
        </View>
      </CreateSection>

      <CreateSection title="Sort">
        <View style={styles.pillWrap}>
          {CREATE_PROJECT_SORT_OPTIONS.map((option) => (
            <CreateFilterPill
              key={option.value}
              label={option.label}
              active={sortBy === option.value}
              onPress={() => setSortBy(option.value)}
            />
          ))}
        </View>
      </CreateSection>

      <CreateSection title="Project Cards">
        {projects.length === 0 ? (
          <CreateEmptyCard
            title="No projects match"
            body={
              allProjects.length === 0
                ? 'Create your first project to start tracking scope, hours, and milestones.'
                : 'Try clearing a filter or search term to widen the board.'
            }
            actionLabel={allProjects.length === 0 ? 'Add Project' : 'Clear Filters'}
            onAction={() => {
              if (allProjects.length === 0) {
                router.push('/(create)/project/add' as never);
                return;
              }
              setSearch('');
              setStatusFilter('all');
              setTypeFilter('all');
              setSortBy('updated_at');
            }}
          />
        ) : (
          <View style={styles.listWrap}>
            {projects.map((project) => (
              <CreateProjectCard
                key={project.id}
                project={project}
                onPress={() =>
                  router.push(`/(create)/project/${project.id}` as never)
                }
              />
            ))}
          </View>
        )}
      </CreateSection>
    </CreateScreen>
  );
}

const styles = StyleSheet.create({
  filterCard: {
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  searchInput: {
    backgroundColor: 'rgba(19,24,36,0.68)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  filterHint: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  pillWrap: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  listWrap: {
    gap: spacing.sm,
  },
});
