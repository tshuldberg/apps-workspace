import { useState } from 'react';
import { Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { createProject } from '@mylife/create';
import { colors } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';
import {
  DEFAULT_CREATE_PROJECT_FORM_STATE,
  CreateProjectForm,
  CreateScreen,
  buildCreateProjectInput,
} from '../_ui';

export default function CreateProjectAddScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [state, setState] = useState(DEFAULT_CREATE_PROJECT_FORM_STATE);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    try {
      const created = createProject(db, uuid(), buildCreateProjectInput(state));
      router.replace(`/(create)/project/${created.id}` as never);
    } catch (error) {
      setSaving(false);
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add project',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <CreateScreen
        eyebrow="New Project"
        title="Add Project"
        body="Capture the brief, workflow stage, timing, and references now so the project detail screen has enough shape to track momentum."
      >
        <CreateProjectForm
          state={state}
          onChange={setState}
          onSubmit={handleSave}
          submitLabel="Save Project"
          submitDisabled={saving}
        />
      </CreateScreen>
    </>
  );
}
