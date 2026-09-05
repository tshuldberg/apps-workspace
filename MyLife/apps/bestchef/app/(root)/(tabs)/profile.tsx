import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppToolbar } from '../components/AppToolbar';
import { RefreshCw } from 'lucide-react-native';
import {
  countFollowedChefs,
  deleteVoteWithProof,
  getLatestFollowerUpdateSeed,
  getSignatureDishes,
  JAKARTA_FONTS,
  publishFollowerUpdateSeed,
  type ChefSeedSubmissionInput,
  type SignatureDish,
} from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useDatabase } from '../providers/DatabaseProvider';
import { useBestChefCloud } from '../providers/BestChefCloudProvider';
import { getProfileCookProofs, type CookProofViewModel } from '../data/cloud-vote-proofs';
import {
  getAllLocalSubmissions,
  getLocalChefStats,
  type LocalChefStats,
} from '../data/local-submissions';
import { useI18n } from '../i18n/I18nProvider';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileStatsRow } from '../components/profile/ProfileStatsRow';
import { RankProgressCard } from '../components/profile/RankProgressCard';
import { ProfileSubTabs, type ProfileTab } from '../components/profile/ProfileSubTabs';
import { ProfileRecipesPane } from '../components/profile/ProfileRecipesPane';
import { ProfileBadgesPane } from '../components/profile/ProfileBadgesPane';
import { ProfileActivityPane } from '../components/profile/ProfileActivityPane';

function loadSetting(db: ReturnType<typeof useDatabase>, key: string): string | null {
  try {
    const rows = db.query<{ value: string }>(`SELECT value FROM rc_settings WHERE key = ?`, [key]);
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

function parseCuisineList(value: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tc = useThemeColors();
  const theme = useTheme();
  const db = useDatabase();
  const cloud = useBestChefCloud();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<ProfileTab>('recipes');
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileHandle, setProfileHandle] = useState<string | null>(null);
  const [followedCount, setFollowedCount] = useState(0);
  const [latestSeedRevision, setLatestSeedRevision] = useState<number | null>(null);
  const [chefStats, setChefStats] = useState<LocalChefStats>({
    submissions: 0,
    votesCast: 0,
    voteScoreReceived: 0,
    wins: 0,
  });
  const [myCookProofs, setMyCookProofs] = useState<CookProofViewModel[]>([]);
  const [myCookProofsLoading, setMyCookProofsLoading] = useState(false);
  const [myCookProofsError, setMyCookProofsError] = useState<{ message: string } | null>(null);
  const [cookProofsRefreshKey, setCookProofsRefreshKey] = useState(0);
  const [deletingProofId, setDeletingProofId] = useState<string | null>(null);
  const [signatureDishes, setSignatureDishes] = useState<SignatureDish[]>([]);
  const [signatureDishesLoading, setSignatureDishesLoading] = useState(false);

  const refreshFollowerState = useCallback(() => {
    setProfileName(loadSetting(db, 'profile_display_name'));
    setProfileHandle(loadSetting(db, 'profile_handle'));
    setFollowedCount(countFollowedChefs(db));
    setLatestSeedRevision(getLatestFollowerUpdateSeed(db, 'local')?.revision ?? null);
    try {
      setChefStats(getLocalChefStats(db));
    } catch {
      setChefStats({ submissions: 0, votesCast: 0, voteScoreReceived: 0, wins: 0 });
    }
  }, [db]);

  useFocusEffect(useCallback(() => {
    refreshFollowerState();
  }, [refreshFollowerState]));

  useEffect(() => {
    let cancelled = false;
    if (!cloud.supabase || !cloud.profile) {
      setMyCookProofs([]);
      setMyCookProofsLoading(false);
      setMyCookProofsError(null);
      return () => {
        cancelled = true;
      };
    }

    setMyCookProofsLoading(true);
    setMyCookProofsError(null);
    void getProfileCookProofs(cloud.supabase, cloud.profile.id, 9)
      .then((proofs) => {
        if (cancelled) return;
        setMyCookProofs(proofs);
        setMyCookProofsError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setMyCookProofs([]);
        const message = error instanceof Error ? error.message : '';
        setMyCookProofsError({ message });
      })
      .finally(() => {
        if (!cancelled) setMyCookProofsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cloud.profile, cloud.supabase, cookProofsRefreshKey]);

  // Signature dishes -- own profile only.
  useEffect(() => {
    let cancelled = false;
    const supabase = cloud.supabase;
    const profileId = cloud.profile?.id ?? null;
    if (!supabase || !profileId) {
      setSignatureDishes([]);
      setSignatureDishesLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setSignatureDishesLoading(true);
    void getSignatureDishes(supabase, { chefId: profileId })
      .then((result) => {
        if (cancelled) return;
        setSignatureDishes(result.ok ? result.data : []);
      })
      .catch(() => {
        if (!cancelled) setSignatureDishes([]);
      })
      .finally(() => {
        if (!cancelled) setSignatureDishesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cloud.supabase, cloud.profile?.id]);

  // Re-fetch signatures when the screen regains focus (after editor save).
  useFocusEffect(useCallback(() => {
    const supabase = cloud.supabase;
    const profileId = cloud.profile?.id ?? null;
    if (!supabase || !profileId) return;
    let cancelled = false;
    void getSignatureDishes(supabase, { chefId: profileId })
      .then((result) => {
        if (!cancelled && result.ok) setSignatureDishes(result.data);
      })
      .catch(() => { /* swallow; existing list stays */ });
    return () => { cancelled = true; };
  }, [cloud.supabase, cloud.profile?.id]));

  const retryCookProofs = useCallback(() => {
    setCookProofsRefreshKey((k) => k + 1);
  }, []);

  const handleUpdateFollowers = useCallback(() => {
    const displayName = loadSetting(db, 'profile_display_name') ?? t('Chef');
    const handle = loadSetting(db, 'profile_handle') ?? 'me';
    const location = loadSetting(db, 'profile_location');
    const bio = loadSetting(db, 'profile_bio');
    const topCuisines = parseCuisineList(loadSetting(db, 'profile_cuisines'));
    const submissions: ChefSeedSubmissionInput[] = getAllLocalSubmissions(db).map((submission) => ({
      id: submission.id,
      dishId: submission.dishId,
      title: submission.title,
      description: submission.description,
      ingredients: submission.ingredients,
      tags: submission.tags,
      voteScore: submission.voteScore,
      rank: submission.rank,
      createdAt: submission.createdAt,
    }));

    try {
      const seed = publishFollowerUpdateSeed(db, {
        chefId: 'local',
        displayName,
        handle,
        bio,
        location,
        topCuisine: topCuisines[0] ?? null,
        topCuisines,
        followerCount: 0,
        followingCount: followedCount,
        totalVotes: 0,
        wins: 0,
        submissions,
      });
      setLatestSeedRevision(seed.revision);
      Alert.alert(
        t('Followers Updated'),
        t('Seed #{revision} is available for followers.', { revision: seed.revision }),
      );
    } catch (err) {
      Alert.alert(
        t('Update Failed'),
        err instanceof Error ? err.message : t('Unable to update followers.'),
      );
    }
  }, [db, followedCount, t]);

  const deleteCookProof = useCallback(async (proof: CookProofViewModel) => {
    if (!cloud.supabase || deletingProofId) return;
    setDeletingProofId(proof.id);
    const result = await deleteVoteWithProof({
      submissionId: proof.submissionId,
      supabase: cloud.supabase,
    });
    setDeletingProofId(null);

    if (result.ok) {
      setMyCookProofs((current) => current.filter((item) => item.id !== proof.id));
      return;
    }

    Alert.alert(t('Delete failed'), t(result.message));
  }, [cloud.supabase, deletingProofId, t]);

  const confirmDeleteCookProof = useCallback((proof: CookProofViewModel) => {
    Alert.alert(
      t('Delete CookProof vote'),
      t('This removes your vote and proof photo from public BestChef surfaces.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: () => void deleteCookProof(proof),
        },
      ],
    );
  }, [deleteCookProof, t]);

  const displayName = profileName ?? t('Chef');
  const cloudProfileId = cloud.profile?.id ?? 'local';

  return (
    <View style={[styles.screen, { backgroundColor: tc.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppToolbar
          pinwheelPageKey="profile"
          onSearch={() => router.push('/discover')}
          onSubmit={() => router.push('/submit')}
          onNotifications={() => router.push('/notifications')}
          onSettings={() => router.push('/settings')}
        />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8 }]} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          chef={{
            displayName,
            handle: profileHandle ?? '',
            city: undefined,
            bio: loadSetting(db, 'profile_bio') ?? undefined,
            isVerified: false,
            initials: displayName.slice(0, 2).toUpperCase(),
            id: cloudProfileId,
          }}
        />

        <ProfileStatsRow
          recipesCount={chefStats.submissions}
          profileId={cloud.profile?.id ?? null}
        />

        {/* Manage followers link */}
        <Pressable
          style={({ pressed }) => [styles.manageLink, pressed && { opacity: 0.7 }]}
          onPress={handleUpdateFollowers}
          accessibilityRole="button"
        >
          <RefreshCw size={13} color={tc.textTertiary} strokeWidth={2} />
          <Text style={[styles.manageLinkText, { color: tc.textTertiary }]}>
            {t('Update Followers')}
            {latestSeedRevision ? `  ·  ${t('Seed #{revision}', { revision: latestSeedRevision })}` : ''}
          </Text>
        </Pressable>

        <RankProgressCard chefId={cloud.profile?.id ?? null} />

        <ProfileSubTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'recipes' && (
          <ProfileRecipesPane
            proofs={myCookProofs}
            loading={myCookProofsLoading}
            proofsError={myCookProofsError}
            onPressProof={(proof) => {
              router.push({
                pathname: '/recipe/[id]',
                params: { id: proof.submissionId, proofId: proof.id },
              });
            }}
            onDeleteProof={(proof) => {
              if (deletingProofId !== proof.id) confirmDeleteCookProof(proof);
            }}
            onRetryProofs={retryCookProofs}
            signatureDishes={signatureDishes}
            signatureDishesLoading={signatureDishesLoading}
            canEditSignatures={!!cloud.profile?.id}
            onPressEditSignatures={() => router.push('/edit-signature-dishes')}
            onPressSignatureDish={(dish) => {
              router.push({
                pathname: '/recipe/[id]',
                params: { id: dish.submissionId },
              });
            }}
          />
        )}

        {activeTab === 'badges' && (
          <ProfileBadgesPane chefId={cloudProfileId} />
        )}

        {activeTab === 'activity' && (
          <ProfileActivityPane chefId={cloudProfileId} />
        )}

        <Pressable
          style={({ pressed }) => [styles.creatorCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/saved')}
        >
          <Text style={[styles.creatorTitle, { color: tc.text }]}>{t('Saved Recipes')}</Text>
          <Text style={[styles.creatorDescription, { color: tc.textSecondary }]}>
            {t('Your bookmarked recipes and videos in one place.')}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.creatorCard, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/creator-program')}
        >
          <Text style={[styles.creatorTitle, { color: tc.text }]}>{t('Creator Program')}</Text>
          <Text style={[styles.creatorDescription, { color: tc.textSecondary }]}>
            {t('Apply to become a verified creator with a featured profile and a verified badge.')}
          </Text>
          <View style={[styles.creatorButton, { backgroundColor: `${tc.accent}1F` }]}>
            <Text style={[styles.creatorButtonText, { color: tc.accent }]}>{t('Learn More')}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 24, paddingBottom: 120, gap: 24 },

  manageLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -12,
  },
  manageLinkText: { fontFamily: JAKARTA_FONTS.medium, fontSize: 12 },

  creatorCard: {
    borderRadius: 24, padding: 24,
    alignItems: 'center', gap: 12, borderWidth: 1,
  },
  creatorTitle: { fontFamily: JAKARTA_FONTS.bold, fontSize: 16 },
  creatorDescription: { fontFamily: JAKARTA_FONTS.medium, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  creatorButton: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 999 },
  creatorButtonText: { fontFamily: JAKARTA_FONTS.bold, fontSize: 13 },
});
