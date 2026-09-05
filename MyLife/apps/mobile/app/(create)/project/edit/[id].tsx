import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { deleteProject, getProject, updateProject } from '@mylife/create';
import { Text, borderRadius, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../../../components/DatabaseProvider';
import {
  CreateProjectForm,
  CreateScreen,
  buildCreateProjectInput,
  createProjectFormStateFromRecord,
} from '../../_ui';

export default function CreateProjectEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDatabase();
  const router = useRouter();
  const project = id ? getProject(db, id) : null;
  const [state, setState] = useState(() =>
    project ? createProjectFormStateFromRecord(project) : null,
  );
  const [saving, setSaving] = useState(false);

  if (!project || !state) {
    return (
      <View style={styles.errorScreen}>
        <Text variant="heading" style={styles.errorTitle}>
          Project not found
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/(create)' as never)}>
          <Text style={styles.primaryBtnText}>Back to projects</Text>
        </Pressable>
      </View>
    );
  }

  const currentProject = project;
  const currentState = state;

  function handleSave() {
    setSaving(true);
    try {
      updateProject(
        db,
        currentProject.id,
        buildCreateProjectInput(currentState),
      );
      router.replace(`/(create)/project/${currentProject.id}` as never);
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  function handleDelete() {
    Alert.alert(
      'Delete project',
      `Remove ${currentProject.title}? Existing progress entries will also disappear from the linked detail view.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProject(db, currentProject.id);
            router.replace('/(create)' as never);
          },
        },
      ],
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit project',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <CreateScreen
        eyebrow="Adjust Project"
        title={currentProject.title}
        body="Realign the brief, dates, tools, and references with what the data layer already tracks."
      >
        <CreateProjectForm
          state={currentState}
          onChange={setState}
          onSubmit={handleSave}
          submitLabel="Save Changes"
          submitDisabled={saving}
          onDelete={handleDelete}
        />
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
  primaryBtn: {
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
});
