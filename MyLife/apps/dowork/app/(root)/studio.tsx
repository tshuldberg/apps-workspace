// Trainer Studio. Gated on the caller owning a dw_trainers row (non-trainers
// get an honest gate pointing at invite redemption). Three sections: upload
// queue, manage grid, profile editor, plus a Clients nav card into the coaching
// loop (that screen is owned by the coaching-loop work).

import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, KeyRound, TrendingUp, Users } from 'lucide-react-native';
import {
  WK_FONTS,
  getWorkoutExercises,
  seedWorkoutExerciseLibrary,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import { useDoWorkCloud } from './providers/DoWorkCloudProvider';
import { getMyTrainerProfile, type CloudTrainerProfile } from './data/cloud-trainers';
import { friendlyError } from './data/friendly-errors';
import type { TrainerVideoRow } from './data/cloud-trainer-videos';
import { WorkoutRouteHeader } from './phase3-kit';
import { UploadQueue } from './components/studio/UploadQueue';
import { ManageGrid } from './components/studio/ManageGrid';
import { ProfileEditor } from './components/studio/ProfileEditor';
import { SelectableChip, type ExerciseOption } from './components/studio/studio-kit';
import { DW_ACCENT, DW_BORDER, DW_ON_ACCENT, DW_SURFACES, DW_TEXT } from './theme/tokens';

type Gate =
  | { state: 'loading' }
  | { state: 'cloud-off' }
  | { state: 'not-trainer' }
  | { state: 'error'; message: string }
  | { state: 'trainer'; trainer: CloudTrainerProfile };

type StudioTab = 'upload' | 'manage' | 'profile';

export default function StudioScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { supabase, userId, isReady, refreshIdentity } = useDoWorkCloud();
  const [gate, setGate] = useState<Gate>({ state: 'loading' });
  const [tab, setTab] = useState<StudioTab>('upload');
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const loadExercises = useCallback(() => {
    try {
      seedWorkoutExerciseLibrary(db);
      const rows = getWorkoutExercises(db, { limit: 300 });
      setExercises(rows.map((row) => ({ id: row.id, name: row.name, category: String(row.category) })));
    } catch {
      setExercises([]);
    }
  }, [db]);

  const resolveGate = useCallback(async () => {
    if (!isReady) {
      setGate({ state: 'loading' });
      return;
    }
    if (!supabase || !userId) {
      setGate({ state: 'cloud-off' });
      return;
    }
    const result = await getMyTrainerProfile(supabase, userId);
    if (!result.ok) {
      setGate({ state: 'error', message: friendlyError(result.error, "Couldn't load your Studio.") });
      return;
    }
    if (!result.trainer) {
      setGate({ state: 'not-trainer' });
      return;
    }
    setGate({ state: 'trainer', trainer: result.trainer });
  }, [isReady, supabase, userId]);

  useFocusEffect(
    useCallback(() => {
      loadExercises();
      void resolveGate();
    }, [loadExercises, resolveGate]),
  );

  const onUploaded = useCallback((_video: TrainerVideoRow) => {
    setReloadToken((token) => token + 1);
  }, []);

  const onProfileSaved = useCallback(
    (updated: CloudTrainerProfile) => {
      setGate({ state: 'trainer', trainer: updated });
      void refreshIdentity();
    },
    [refreshIdentity],
  );

  if (gate.state === 'loading') {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={DW_ACCENT} />
        <Text style={styles.centeredText}>Opening your Studio…</Text>
      </View>
    );
  }

  if (gate.state === 'cloud-off' || gate.state === 'not-trainer' || gate.state === 'error') {
    const isInvite = gate.state === 'not-trainer';
    const gateTitle =
      gate.state === 'cloud-off'
        ? 'Cloud connection needed'
        : gate.state === 'error'
          ? "Couldn't load your Studio"
          : 'Trainer access is invite-only';
    const gateBody =
      gate.state === 'cloud-off'
        ? 'The Trainer Studio needs a cloud connection. Reconnect and try again.'
        : gate.state === 'error'
          ? gate.message
          : 'The Studio is where DoWork trainers upload their library and manage their profile. Redeem an invite code to get started.';
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        <WorkoutRouteHeader title="Trainer Studio" overline="Trainers" onBack={() => router.back()} />
        <View style={styles.gate}>
          <View style={styles.gateIcon}>
            <KeyRound size={26} color={DW_ACCENT} />
          </View>
          <Text style={styles.gateTitle}>{gateTitle}</Text>
          <Text style={styles.gateBody}>{gateBody}</Text>
          <Pressable
            style={styles.gateButton}
            onPress={() => {
              if (isInvite) {
                router.push('/(root)/redeem-invite' as never);
              } else {
                void resolveGate();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={isInvite ? 'Redeem an invite' : 'Retry'}
          >
            <Text style={styles.gateButtonText}>{isInvite ? 'Redeem an invite' : 'Retry'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const trainer = gate.trainer;

  const studioHeader = (
    <View style={styles.headerBlock}>
      <Pressable
        style={styles.clientsCard}
        onPress={() => router.push('/(root)/clients' as never)}
        accessibilityRole="button"
        accessibilityLabel="Clients"
      >
        <View style={styles.clientsIcon}>
          <Users size={18} color={DW_ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.clientsTitle}>Clients</Text>
          <Text style={styles.clientsBody}>Invite clients and review their form checks.</Text>
        </View>
        <ChevronRight size={18} color={DW_TEXT.tertiary} />
      </Pressable>

      <Pressable
        style={styles.clientsCard}
        onPress={() => router.push('/(root)/earnings' as never)}
        accessibilityRole="button"
        accessibilityLabel="Earnings"
      >
        <View style={styles.clientsIcon}>
          <TrendingUp size={18} color={DW_ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.clientsTitle}>Earnings</Text>
          <Text style={styles.clientsBody}>See subscribers and monthly gross.</Text>
        </View>
        <ChevronRight size={18} color={DW_TEXT.tertiary} />
      </Pressable>

      <View style={styles.tabRow}>
        <SelectableChip label="Upload" selected={tab === 'upload'} onPress={() => setTab('upload')} />
        <SelectableChip label="Manage" selected={tab === 'manage'} onPress={() => setTab('manage')} />
        <SelectableChip label="Profile" selected={tab === 'profile'} onPress={() => setTab('profile')} />
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutRouteHeader title="Trainer Studio" overline={`@${trainer.handle ?? 'trainer'}`} onBack={() => router.back()} />

      {tab === 'manage' && supabase ? (
        <ManageGrid
          supabase={supabase}
          trainerId={trainer.id}
          exercises={exercises}
          reloadToken={reloadToken}
          header={studioHeader}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {studioHeader}

          <View style={styles.tabBody}>
            {tab === 'upload' && supabase ? (
              <UploadQueue supabase={supabase} exercises={exercises} onUploaded={onUploaded} />
            ) : null}
            {tab === 'profile' && supabase ? (
              <ProfileEditor supabase={supabase} trainer={trainer} onSaved={onProfileSaved} />
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DW_SURFACES.base,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DW_SURFACES.base,
    gap: 12,
  },
  centeredText: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 60,
    gap: 16,
  },
  gate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  gateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  gateTitle: {
    fontFamily: WK_FONTS.extraBold,
    fontSize: 22,
    color: DW_TEXT.primary,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  gateBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    color: DW_TEXT.secondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  gateButton: {
    marginTop: 8,
    backgroundColor: DW_ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  gateButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 14,
    color: DW_ON_ACCENT,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerBlock: {
    gap: 16,
  },
  clientsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.default,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  clientsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${DW_ACCENT}18`,
  },
  clientsTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  clientsBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    color: DW_TEXT.secondary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBody: {
    gap: 12,
  },
});
