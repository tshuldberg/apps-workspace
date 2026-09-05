import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { DatabaseAdapter } from '@mylife/db';
import { getCommunity,
  PROFILE_BIO_MAX_CHARS,
  PROFILE_NAME_COLOR_TOKENS,
  PROFILE_PRONOUNS_MAX_CHARS,
  type ProfileNameColorToken, getPublicKeyFingerprint, leaveCommunity, type StoredCommunity } from '@mylife/sync';
import {
  CONNECTED_DEVICES_HEADING,
  CONNECTED_DEVICES_HINT,
  NAME_DISAGREEMENT_HINT,
  collapseMembersIntoPersons,
  personDeviceCountLabel,
  PARTIAL_BLOCK_LABEL,
  personRemovalDeviceLine,
  type PersonRow,
} from '../../../data/person-view-core';
import { useMeerkatDatabase } from '../../../providers/DatabaseProvider';
import { useIdentity } from '../../../providers/IdentityProvider';
import { type SetCommunityProfileResult, useSync } from '../../../providers/SyncProvider';
import {
  getCommunityProfile,
  resolveCommunityAvatarImage,
  resolveCommunityAvatarInitial,
  resolveCommunityDisplayName,
} from '../../../data/community-core';
import { Avatar } from '../../../components/Avatar';
import {
  isAvatarPhotoSupported,
  pickAndResizeAvatar,
  type AvatarPickResult,
} from '../../../data/avatar-photo';
import {
  blockCommunityPerson,
  clearCommunitySafetyAction,
  isCommunityMuted,
  isCommunityPersonBlocked,
  listOwnerReviewItems,
  markSafetyActionReviewed,
  setCommunityMuted,
} from '../../../data/community-safety';
import { communityAdminCaps } from '../../../data/community-list-core';
import {
  MEMBER_REMOVAL_CONFIRM_BODY,
  describeMemberRemovalFailure,
  describeMemberRemovalSuccess,
  memberRemovalConfirmTitle,
} from '../../../data/member-removal-view-core';
import { isReservedCommunityId } from '../../../data/join-flow';
import { Button, SectionHeader } from '../../../components/kit';
import { APPEAR_ONLINE_COPY, communityPresenceView, isAppearOnlineEnabled, setAppearOnlineEnabled } from '../../../data/presence-core';
import { CommunityAppearanceSection } from '../../../components/CommunityAppearanceSection';
import { CommunityNotificationSection } from '../../../components/CommunityNotificationSection';
import { CommunityOrganizationSection } from '../../../components/CommunityOrganizationSection';
import { CommunitySyncPolicySection } from '../../../components/CommunitySyncPolicySection';
import { CommunityServerSection } from '../../../components/CommunityServerSection';
import { CanvasRenderDialsSection } from '../../../components/CanvasRenderDialsSection';
import { CommunityBadgesSection } from '../../../components/CommunityBadgesSection';
import { CommunityAssetPacksSection } from '../../../components/CommunityAssetPacksSection';
import { OwnerPublicReports } from '../../../components/OwnerPublicReports';
import { PublicJoinRequests } from '../../../components/PublicJoinRequests';
import { PublishSheet } from '../../../components/PublishSheet';
import { InviteShareSheet } from '../../../components/InviteShareSheet';
import { HistoryImportSheet } from '../../../components/HistoryImportSheet';
import { type MkColors, MK_RADIUS, shortHex } from '../../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../../providers/AppThemeProvider';
import { CommunityThemeProvider } from '../../../providers/CommunityThemeProvider';

// Settings is one of this community's screens, so it themes to the community
// (amendment D.2 boundary community/[communityId]*); the tab bar stays base.
export default function CommunitySettingsRoute() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  return (
    <CommunityThemeProvider communityId={typeof communityId === 'string' ? communityId : ''}>
      <CommunitySettingsScreen />
    </CommunityThemeProvider>
  );
}

function CommunitySettingsScreen() {
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { setCommunityPresentation, removeCommunityMemberById, personLinks } = useSync();
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const id = typeof communityId === 'string' ? communityId : '';

  const [revision, setRevision] = useState(0);
  const [community, setCommunity] = useState<StoredCommunity | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [blockingKey, setBlockingKey] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // The sheets stay MOUNTED and toggle `visible` (unmounting a visible RN Modal
  // is the PROMPT-002 freeze class); the per-open counter keys give each open a
  // fresh mount while the Modal is still hidden.
  const [sheetOpens, setSheetOpens] = useState(0);
  const openSheet = useCallback((which: 'publish' | 'invite' | 'history') => {
    setSheetOpens((v) => v + 1);
    if (which === 'publish') setShowPublish(true);
    else if (which === 'invite') setShowInvite(true);
    else setShowHistory(true);
  }, []);

  const load = useCallback(() => {
    if (!id || isReservedCommunityId(id)) {
      setCommunity(null);
      return;
    }
    setCommunity(getCommunity(db, id));
  }, [db, id]);

  useFocusEffect(useCallback(() => { void revision; load(); }, [load, revision]));

  const bump = useCallback(() => setRevision((v) => v + 1), []);

  // Settings is deep-linkable, so it can be the stack's only route; Back then
  // falls back to the community home (or the list when nothing loaded).
  const goBack = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    if (community) router.replace({ pathname: '/community/[communityId]', params: { communityId: community.communityId } });
    else router.replace('/communities');
  }, [router, community]);

  const toggleCommunityMute = useCallback((muted: boolean) => {
    if (!community) return;
    setCommunityMuted(db, community.communityId, muted, community.descriptor.name);
    bump();
  }, [db, community, bump]);

  // D.2: "Reviewed" = acknowledged but STAYS hidden (status 'reviewed'); the item
  // stays in the queue with a "Reviewed - still hidden" pill.
  const markReviewed = useCallback((reviewId: string) => {
    markSafetyActionReviewed(db, reviewId, 'reviewed');
    bump();
  }, [db, bump]);

  // D.2: "Un-hide for me" (status 'dismissed') shows the content again on this
  // device and removes it from the review queue. It does not un-hide it for other
  // members (moderation state is device-local by design).
  const unhideReport = useCallback((reviewId: string) => {
    markSafetyActionReviewed(db, reviewId, 'dismissed');
    bump();
  }, [db, bump]);

  // Owner-only, AC-4: the engine refuses an admin (not_owner); the UI gates the
  // action on isOwner so a non-owner never sees an enabled Remove. Epoch-boundary
  // honest: convergence is per device as survivors drain (NC-1), and the notice
  // reports only what the real result counts show (never a faked park/republish).
  /**
   * Plan 52 P5: removal is PERSON-scoped. Every attested device of the person
   * is removed in sequence, and the epoch rotation excludes all of them (each
   * call rotates against the descriptor the previous one produced, which is
   * why they run sequentially under the same global single-flight guard).
   * The notice reports the LAST result's real counts; a partial failure says
   * so rather than claiming the person is gone.
   */
  const removePerson = useCallback((row: PersonRow) => {
    if (!community) return;
    // Global single-flight: never start a second removal while one is in flight.
    // A second removal would sign its revision off the pre-first descriptor;
    // upsertCommunity is monotonic and would SILENTLY drop it (same revision
    // number), yet still run a second epoch rotation and return ok -- a success
    // claim for a removal that did not durably persist. One at a time.
    if (removingId !== null) return;
    Alert.alert(
      memberRemovalConfirmTitle(row.displayName),
      `${MEMBER_REMOVAL_CONFIRM_BODY} ${personRemovalDeviceLine(row)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setRemovingId(row.key);
            setNotice(null);
            void (async () => {
              try {
                let last: Awaited<ReturnType<typeof removeCommunityMemberById>> | null = null;
                let removed = 0;
                for (const device of row.devices) {
                  last = await removeCommunityMemberById(community.communityId, device.deviceId);
                  if (last.ok) removed += 1;
                  else break;
                }
                if (!last) return;
                if (last.ok) {
                  setNotice(describeMemberRemovalSuccess(last, row.displayName));
                } else if (removed > 0) {
                  setNotice(`Removed ${removed} of ${row.devices.length} devices. ${describeMemberRemovalFailure(last, row.displayName)}`);
                } else {
                  setNotice(describeMemberRemovalFailure(last, row.displayName));
                }
              } catch {
                setNotice('Could not remove this member. Please try again.');
              } finally {
                setRemovingId(null);
                bump();
              }
            })();
          },
        },
      ],
    );
  }, [community, removeCommunityMemberById, removingId, bump]);

  /**
   * Plan 52 P5: blocking a person blocks EVERY attested device. Single-flight
   * and error-reporting, matching the web twin, so a mid-loop failure cannot
   * leave the person half-blocked with no signal.
   */
  const toggleBlockPerson = useCallback((row: PersonRow) => {
    if (!community) return;
    if (blockingKey !== null) return;
    const runBlockLoop = (next: boolean) => {
      setBlockingKey(row.key);
      setNotice(null);
      let done = 0;
      try {
        for (const device of row.devices) {
          if (next) blockCommunityPerson(db, community.communityId, device.deviceId, row.displayName);
          else clearCommunitySafetyAction(db, community.communityId, 'person', device.deviceId, 'block');
          done += 1;
        }
      } catch {
        setNotice(
          done === 0
            ? `Could not ${next ? 'block' : 'unblock'} ${row.displayName}.`
            : `Only ${done} of ${row.devices.length} devices were ${next ? 'blocked' : 'unblocked'}. Try again.`,
        );
      } finally {
        setBlockingKey(null);
        bump();
      }
    };
    if (row.blocked) {
      runBlockLoop(false);
      return;
    }
    Alert.alert(
      `Block ${row.displayName}?`,
      `This hides their local posts, messages, and files on this device. It does not remove them from the community or rotate keys. ${personRemovalDeviceLine(row).replace('removes', 'covers').replace('from the community.', 'on this device.')}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => runBlockLoop(true) },
      ],
    );
  }, [db, community, blockingKey, bump]);

  const onLeave = useCallback(() => {
    if (!community) return;
    Alert.alert(
      `Leave ${community.descriptor.name}?`,
      'This removes the community from this device. You can rejoin later with a fresh invite.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => { leaveCommunity(db, community.communityId); router.replace('/communities'); },
        },
      ],
    );
  }, [db, community, router]);

  // Plan 52 P4: collapse the member devices into persons using VERIFIED
  // announces only. A device with no link stays its own row.
  const personRows = community
    ? collapseMembersIntoPersons(
        community.descriptor.members.map((member) => {
          const label = resolveCommunityDisplayName(db, community.communityId, member.deviceId, member.displayName)
            ?? shortHex(member.deviceId);
          const profile = getCommunityProfile(db, community.communityId, member.deviceId);
          return {
            deviceId: member.deviceId,
            displayName: label,
            avatarInitial: resolveCommunityAvatarInitial(db, community.communityId, member.deviceId, label),
            avatarImage: resolveCommunityAvatarImage(db, community.communityId, member.deviceId),
            role: member.role,
            shortDeviceId: shortHex(member.deviceId),
            // A comparable safety code exists only for a device this user has
            // PAIRED with; for everyone else the honest identifier is the
            // fingerprint of the signing key, which is what we show.
            safetyCode: shortHex(getPublicKeyFingerprint(member.deviceId)),
            isSelf: member.deviceId === identity.publicKey,
            blocked: isCommunityPersonBlocked(db, community.communityId, member.deviceId),
            profileUpdatedAt: profile?.updatedAt ?? null,
          };
        }),
        personLinks(community.communityId),
      )
    : [];

  if (!community) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Header title="Settings" onBack={goBack} />
        <Text style={styles.emptyTitle}>Community not found</Text>
        <Text style={styles.emptyText}>This community is not on this device.</Text>
      </View>
    );
  }

  const d = community.descriptor;
  const { isOwner, canInvite } = communityAdminCaps(community.myRole);
  const muted = isCommunityMuted(db, community.communityId);
  const reviewItems = canInvite ? listOwnerReviewItems(db, community.communityId) : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Header title={`${d.name} settings`} onBack={goBack} />

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <View style={styles.panel}>
        <View style={styles.quickActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={muted ? `Unmute ${d.name}` : `Mute ${d.name}`}
            onPress={() => toggleCommunityMute(!muted)}
            style={({ pressed }) => [styles.smallAction, muted && styles.smallActionActive, pressed && styles.pressed]}
          >
            <Text style={[styles.smallActionText, muted && styles.smallActionTextActive]}>
              {muted ? 'Unmute community' : 'Mute community'}
            </Text>
          </Pressable>
          {muted ? <Text style={styles.mutedNote}>Hidden from Feed</Text> : null}
        </View>

        <CommunityProfileCard
          community={community}
          db={db}
          selfDeviceId={identity.publicKey}
          fallbackName={identity.displayName}
          onSave={setCommunityPresentation}
          refresh={bump}
          setNotice={setNotice}
        />
      </View>

      <View style={styles.panel}>
        <SectionHeader title="Members" />
        <Text style={styles.presenceLine}>
          {communityPresenceView(db, community.communityId, identity.publicKey).label}
        </Text>
        <Button
          title={isAppearOnlineEnabled(db, community.communityId) ? 'Appearing online here (on)' : 'Appear online here (off)'}
          variant="secondary"
          onPress={() => {
            setAppearOnlineEnabled(db, community.communityId, !isAppearOnlineEnabled(db, community.communityId));
            bump();
          }}
        />
        <Text style={styles.presenceHint}>{APPEAR_ONLINE_COPY.hint}</Text>
        {personRows.map((row) => {
          const expanded = expandedKey === row.key;
          return (
            <View key={row.key}>
              <View style={[styles.memberRow, row.blocked && styles.mutedRow]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${row.displayName}'s profile in this community`}
                  onPress={() => router.push({
                    pathname: '/community/[communityId]/member/[deviceId]',
                    params: { communityId: id, deviceId: row.devices[0]!.deviceId },
                  })}
                  style={({ pressed }) => [styles.memberIdentity, pressed && styles.pressed]}
                >
                  <Avatar imageBase64={row.avatarImage} initial={row.avatarInitial ?? '?'} size={32} />
                  <View style={styles.memberText}>
                    <Text style={styles.rowMain}>{row.isSelf ? `${row.displayName} (you)` : row.displayName}</Text>
                    <Text style={styles.channelMeta}>
                      {row.role} · {row.deviceCount > 1 ? personDeviceCountLabel(row) : row.devices[0]!.shortDeviceId}
                    </Text>
                  </View>
                </Pressable>
                <View style={styles.memberActions}>
                  {/* Plan 52 P4: devices are always ONE expand away, never hidden. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={expanded ? `Hide devices for ${row.displayName}` : `${CONNECTED_DEVICES_HEADING} for ${row.displayName}`}
                    onPress={() => setExpandedKey(expanded ? null : row.key)}
                    style={({ pressed }) => [styles.tinyAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.tinyActionText}>{expanded ? 'Hide devices' : CONNECTED_DEVICES_HEADING}</Text>
                  </Pressable>
                  {!row.isSelf ? (
                    <>
                      {isOwner ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${row.displayName} from community`}
                          disabled={removingId !== null}
                          onPress={() => removePerson(row)}
                          style={({ pressed }) => [
                            styles.tinyAction,
                            styles.dangerAction,
                            (pressed || removingId !== null) && styles.pressed,
                          ]}
                        >
                          <Text style={[styles.tinyActionText, styles.dangerActionText]}>
                            {removingId === row.key ? 'Removing…' : 'Remove'}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={row.blocked ? `Unblock ${row.displayName}` : `Block ${row.displayName}`}
                        disabled={blockingKey !== null}
                        onPress={() => toggleBlockPerson(row)}
                        style={({ pressed }) => [styles.tinyAction, row.blocked && styles.dangerAction, (pressed || blockingKey !== null) && styles.pressed]}
                      >
                        <Text style={[styles.tinyActionText, row.blocked && styles.dangerActionText]}>
                          {row.blocked ? 'Blocked' : row.partiallyBlocked ? PARTIAL_BLOCK_LABEL : 'Block'}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
              {expanded ? (
                <View style={styles.deviceList}>
                  {row.nameDisagreement ? (
                    <Text style={styles.channelMeta}>{NAME_DISAGREEMENT_HINT}</Text>
                  ) : null}
                  {row.devices.map((device) => (
                    <View key={device.deviceId} style={styles.deviceRow}>
                      <Text style={styles.rowMain}>{device.displayName}</Text>
                      <Text style={styles.channelMeta}>
                        {device.role} · {device.shortDeviceId}
                        {device.safetyCode ? ` · safety code ${device.safetyCode}` : ''}
                        {device.blocked ? ' · blocked' : ''}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.channelMeta}>{CONNECTED_DEVICES_HINT}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <CommunityNotificationSection db={db} communityId={community.communityId} />

      <CommunitySyncPolicySection communityId={community.communityId} isOwner={isOwner} />

      <CommunityServerSection communityId={community.communityId} isOwner={isOwner} />

      <CanvasRenderDialsSection db={db} communityId={community.communityId} />

      <CommunityBadgesSection
        db={db}
        identity={identity}
        communityId={community.communityId}
        isOwner={isOwner}
        isCurator={isOwner || community.myRole === 'admin'}
        members={d.members}
      />

      <CommunityAssetPacksSection
        db={db}
        identity={identity}
        communityId={community.communityId}
        isCurator={isOwner || community.myRole === 'admin'}
      />

      {isOwner ? (
        <CommunityAppearanceSection
          db={db}
          identity={identity}
          communityId={community.communityId}
          communityName={d.name}
          onSaved={bump}
          setNotice={setNotice}
        />
      ) : null}

      {isOwner ? (
        <CommunityOrganizationSection
          communityId={community.communityId}
          descriptor={d}
          onSaved={bump}
          setNotice={setNotice}
        />
      ) : null}

      {isOwner ? (
        <View style={styles.panel}>
          <SectionHeader title="Layout" />
          <Text style={styles.channelMeta}>
            Compose the community home and channel surfaces from blocks. Members receive the new layout on their next sync with you.
          </Text>
          <Button
            title="Open layout editor"
            variant="secondary"
            onPress={() => router.push({
              pathname: '/community/[communityId]/layout-editor',
              params: { communityId: community.communityId },
            })}
          />
        </View>
      ) : null}

      {isOwner ? <PublicJoinRequests db={db} communityId={community.communityId} /> : null}

      {canInvite ? (
        <View style={styles.panel}>
          <SectionHeader title="Owner review" hint="Reports saved on this device." />
          {reviewItems.length === 0 ? (
            <Text style={styles.emptySafetyText}>No local reports need review.</Text>
          ) : (
            reviewItems.map((item) => (
              <View key={item.id} style={styles.reviewRow}>
                <View style={styles.reviewText}>
                  <Text style={styles.reviewTitle} numberOfLines={1}>
                    {item.target_label ?? `${item.target_kind} ${shortHex(item.target_id)}`}
                  </Text>
                  <Text style={styles.reviewMeta} numberOfLines={2}>
                    {item.reason ?? 'Reported'} · {item.channel_id ? `#${item.channel_id}` : 'community'}
                  </Text>
                  {item.status === 'reviewed' ? (
                    <View style={styles.reviewedPill}>
                      <Text style={styles.reviewedPillText}>Reviewed - still hidden</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.reviewActions}>
                  {item.status === 'reviewed' ? null : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Mark reviewed, keep hidden"
                      onPress={() => markReviewed(item.id)}
                      style={({ pressed }) => [styles.tinyAction, pressed && styles.pressed]}
                    >
                      <Text style={styles.tinyActionText}>Reviewed</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Un-hide this content for me"
                    onPress={() => unhideReport(item.id)}
                    style={({ pressed }) => [styles.tinyAction, pressed && styles.pressed]}
                  >
                    <Text style={styles.tinyActionText}>Un-hide for me</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {canInvite ? <OwnerPublicReports db={db} identity={identity} communityId={community.communityId} /> : null}

      {canInvite ? (
        <View style={styles.panel}>
          <View style={styles.publicRow}>
            <View style={styles.publicText}>
              <Text style={styles.publicTitle}>Make public</Text>
              <Text style={styles.publicHint}>Publish a channel where anyone with a reachable host can read it.</Text>
            </View>
            <Button title="Make public" variant="secondary" onPress={() => openSheet('publish')} />
          </View>
        </View>
      ) : null}

      {canInvite ? (
        <View style={styles.panel}>
          <SectionHeader title="Invite people" hint="Share a signed invite that expires in 48 hours." />
          <Button title="Share an invite" onPress={() => openSheet('invite')} />
        </View>
      ) : null}

      <View style={styles.panel}>
        <SectionHeader title="Import history" hint="Backfill a channel from a community host snapshot." />
        <Button title="Import history" variant="secondary" onPress={() => openSheet('history')} />
      </View>

      <Button title="Leave community" variant="danger" onPress={onLeave} />

      <View style={{ height: insets.bottom + 96 }} />

      {/* Mount is gated on the stable role capability (never toggled by close),
          so a plain member's settings never mounts the invite-minting path. */}
      {canInvite ? (
        <PublishSheet
          key={`publish-${sheetOpens}`}
          visible={showPublish}
          onClose={() => setShowPublish(false)}
          communityId={community.communityId}
          channels={d.channels.map((ch) => ({ id: ch.id, name: ch.name }))}
        />
      ) : null}
      {canInvite ? (
        <InviteShareSheet
          key={`invite-${sheetOpens}`}
          community={community}
          visible={showInvite}
          onClose={() => setShowInvite(false)}
        />
      ) : null}
      <HistoryImportSheet
        key={`history-${sheetOpens}`}
        community={community}
        visible={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </ScrollView>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
      >
        <ChevronLeft size={24} color={c.text} strokeWidth={2} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={styles.iconBtn} />
    </View>
  );
}

function CommunityProfileCard({
  community,
  db,
  selfDeviceId,
  fallbackName,
  onSave,
  refresh,
  setNotice,
}: {
  community: StoredCommunity;
  db: DatabaseAdapter;
  selfDeviceId: string;
  fallbackName: string;
  // Plan 52: writes the presentation-profile OVERRIDE (the source of truth
  // every linked device adopts), then alignment re-signs this device.
  onSave: (
    communityId: string,
    displayName: string | null,
    appearance: {
      avatarInitial?: string | null;
      avatarImage?: string | null;
      bio?: string | null;
      pronouns?: string | null;
      nameColor?: ProfileNameColorToken | null;
    },
  ) => SetCommunityProfileResult;
  refresh: () => void;
  setNotice: (notice: string | null) => void;
}) {
  const styles = useMkStyles(makeStyles);
  const colors = useAppThemeColors();
  const currentProfile = getCommunityProfile(db, community.communityId, selfDeviceId);
  const currentName = resolveCommunityDisplayName(db, community.communityId, selfDeviceId, fallbackName) ?? fallbackName;
  const currentInitial = resolveCommunityAvatarInitial(db, community.communityId, selfDeviceId, currentName) ?? '';
  const currentImage = resolveCommunityAvatarImage(db, community.communityId, selfDeviceId);
  const [draftName, setDraftName] = useState(currentName);
  const [draftInitial, setDraftInitial] = useState(currentInitial);
  // undefined = untouched (keep current image); null = remove; string = new photo.
  const [draftImage, setDraftImage] = useState<string | null | undefined>(undefined);
  const currentBio = currentProfile?.bio ?? '';
  const currentPronouns = currentProfile?.pronouns ?? '';
  const currentNameColor = (currentProfile?.nameColor ?? null) as ProfileNameColorToken | null;
  const [draftBio, setDraftBio] = useState(currentBio);
  const [draftPronouns, setDraftPronouns] = useState(currentPronouns);
  const [draftNameColor, setDraftNameColor] = useState<ProfileNameColorToken | null>(currentNameColor);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoSupported = isAvatarPhotoSupported();

  useEffect(() => {
    setDraftName(currentName);
    setDraftInitial(currentInitial);
    setDraftImage(undefined);
    setDraftBio(currentBio);
    setDraftPronouns(currentPronouns);
    setDraftNameColor(currentNameColor);
  }, [community.communityId, currentBio, currentInitial, currentName, currentNameColor, currentPronouns]);

  const trimmedName = draftName.trim();
  const trimmedInitial = Array.from(draftInitial.trim())[0]?.toUpperCase() ?? '';
  const canEdit = community.myRole !== null;
  const effectiveImage = draftImage === undefined ? currentImage : draftImage;
  const imageDirty = draftImage !== undefined && (draftImage ?? null) !== (currentImage ?? null);
  const personaDirty = draftBio.trim() !== currentBio
    || draftPronouns.trim() !== currentPronouns
    || draftNameColor !== currentNameColor;
  const dirty = trimmedName !== currentName || trimmedInitial !== currentInitial || imageDirty || personaDirty;

  const describePhotoFailure = (reason: Exclude<AvatarPickResult, { ok: true }>['reason']): string => {
    switch (reason) {
      case 'permission':
        return 'Photo access was declined. Allow photo access to choose an avatar.';
      case 'too_large':
        return 'That photo is too large even after resizing. Try a different image.';
      case 'unavailable':
        return 'Photo avatars need an app update on this device.';
      case 'canceled':
        return '';
      default:
        return 'Could not prepare that photo. Try a different image.';
    }
  };

  const choosePhoto = useCallback(async () => {
    setPhotoBusy(true);
    try {
      const result = await pickAndResizeAvatar();
      if (result.ok) {
        setDraftImage(result.base64);
        setNotice(null);
      } else if (result.reason !== 'canceled') {
        setNotice(describePhotoFailure(result.reason));
      }
    } catch {
      // A thrown picker must surface, never die as an idle-looking dead tap.
      setNotice('Could not open your photos. Try again.');
    } finally {
      setPhotoBusy(false);
    }
  }, [setNotice]);

  const save = useCallback(() => {
    const result = onSave(community.communityId, trimmedName, {
      avatarInitial: trimmedInitial || null,
      avatarImage: draftImage === undefined ? currentImage : draftImage,
      bio: draftBio.trim() || null,
      pronouns: draftPronouns.trim() || null,
      nameColor: draftNameColor,
    });
    if (!result.ok) {
      setNotice(result.error);
      return;
    }
    setDraftImage(undefined);
    refresh();
    setNotice(`Saved your ${community.descriptor.name} profile. Your other linked devices use this name here too. Other members see it after their app connects and receives the update.`);
  }, [community.communityId, community.descriptor.name, currentImage, draftBio, draftImage, draftNameColor, draftPronouns, onSave, refresh, setNotice, trimmedInitial, trimmedName]);

  return (
    <View style={styles.profileCard}>
      <View style={styles.profilePreview}>
        <Avatar imageBase64={effectiveImage} initial={trimmedInitial || currentInitial} size={44} />
        <View style={styles.profileCopy}>
          <Text style={styles.profileTitle}>Name in this community</Text>
          <Text style={styles.profileDetail} numberOfLines={2}>
            {currentProfile
              ? 'This community profile is tied to your safety identity.'
              : 'Using your main profile until you choose a community name.'}
          </Text>
        </View>
      </View>
      {canEdit ? (
        photoSupported ? (
          <View style={styles.photoRow}>
            <Button
              title={photoBusy ? 'Preparing…' : effectiveImage ? 'Change photo' : 'Choose photo'}
              variant="secondary"
              onPress={choosePhoto}
              disabled={photoBusy}
            />
            {effectiveImage ? (
              <Button title="Remove photo" variant="ghost" onPress={() => setDraftImage(null)} disabled={photoBusy} />
            ) : null}
          </View>
        ) : (
          <Text style={styles.profileLimitText}>Photo avatars need an app update on this device. You can still set your name and initial.</Text>
        )
      ) : null}
      <View style={styles.profileEditorRow}>
        <TextInput
          style={[styles.fieldInput, styles.profileNameInput]}
          value={draftName}
          onChangeText={setDraftName}
          placeholder="Community name"
          accessibilityLabel={`Name shown in ${community.descriptor.name}`}
          editable={canEdit}
        />
        <TextInput
          style={[styles.fieldInput, styles.profileInitialInput]}
          value={draftInitial}
          onChangeText={(value) => setDraftInitial(Array.from(value).slice(0, 1).join('').toUpperCase())}
          placeholder="A"
          accessibilityLabel={`Initial shown in ${community.descriptor.name}`}
          editable={canEdit}
        />
      </View>
      <TextInput
        style={[styles.fieldInput, styles.profileBioInput]}
        value={draftBio}
        onChangeText={setDraftBio}
        placeholder="A short bio for this community (optional)"
        accessibilityLabel={`Bio shown in ${community.descriptor.name}`}
        editable={canEdit}
        multiline
        maxLength={PROFILE_BIO_MAX_CHARS}
      />
      <TextInput
        style={styles.fieldInput}
        value={draftPronouns}
        onChangeText={setDraftPronouns}
        placeholder="Pronouns (optional)"
        accessibilityLabel={`Pronouns shown in ${community.descriptor.name}`}
        editable={canEdit}
        maxLength={PROFILE_PRONOUNS_MAX_CHARS}
      />
      <View style={styles.nameColorRow}>
        <Text style={styles.nameColorLabel}>Name color</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Default name color"
          onPress={() => canEdit && setDraftNameColor(null)}
          style={[styles.nameColorSwatch, styles.nameColorDefault, draftNameColor === null ? styles.nameColorActive : null]}
        >
          <Text style={styles.nameColorDefaultText}>A</Text>
        </Pressable>
        {PROFILE_NAME_COLOR_TOKENS.map((token) => (
          <Pressable
            key={token}
            accessibilityRole="button"
            accessibilityLabel={`Name color ${token}`}
            onPress={() => canEdit && setDraftNameColor(token)}
            style={[
              styles.nameColorSwatch,
              { backgroundColor: nameColorValue(colors, token) },
              draftNameColor === token ? styles.nameColorActive : null,
            ]}
          />
        ))}
      </View>
      <Text style={styles.profileLimitText}>
        Members see this name on your posts, replies, messages, files, and member row. It is a pseudonym, not anonymity: owners still have safety details for trust and moderation.
      </Text>
      {!canEdit ? (
        <Text style={styles.profileLimitText}>Owner approval is still pending, so this device cannot publish a community profile yet.</Text>
      ) : null}
      <Button title="Save community profile" variant="secondary" onPress={save} disabled={!canEdit || !trimmedName || !dirty} />
    </View>
  );
}

// Feature 6: closed token -> active palette (contrast-valid by construction).
function nameColorValue(c: MkColors, token: ProfileNameColorToken): string {
  switch (token) {
    case 'accent': return c.accent;
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'info': return c.info;
  }
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { padding: 16, gap: 12 },
  centered: { alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: -8 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: c.text, fontSize: 20, fontWeight: '800' },
  noticeText: { color: c.accent, fontSize: 13 },
  panel: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: MK_RADIUS.lg,
    padding: 14,
    gap: 10,
  },
  fieldInput: {
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  quickActions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  smallAction: {
    minHeight: 34,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 10,
    backgroundColor: c.surfaceElevated,
  },
  smallActionActive: { borderColor: c.warning, backgroundColor: c.warningSoft },
  smallActionText: { color: c.textSecondary, fontSize: 12, fontWeight: '800' },
  smallActionTextActive: { color: c.warning },
  mutedNote: { color: c.warning, fontSize: 12, fontWeight: '700' },
  profileCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    borderRadius: MK_RADIUS.md,
    padding: 10,
    gap: 9,
    backgroundColor: c.surfaceElevated,
  },
  profilePreview: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.accent,
  },
  profileAvatarText: { color: c.accent, fontSize: 16, fontWeight: '900' },
  profileCopy: { flex: 1, minWidth: 0, gap: 2 },
  profileTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
  profileDetail: { color: c.textTertiary, fontSize: 12, lineHeight: 17 },
  profileEditorRow: { flexDirection: 'row', gap: 8 },
  photoRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  profileNameInput: { flex: 1 },
  profileInitialInput: { width: 56, textAlign: 'center', fontWeight: '900' },
  profileLimitText: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  profileBioInput: { minHeight: 64, textAlignVertical: 'top' },
  nameColorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nameColorLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  nameColorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  nameColorDefault: {
    backgroundColor: c.surface,
    borderColor: c.glassBorder,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameColorDefaultText: { color: c.textSecondary, fontSize: 12, fontWeight: '800' },
  nameColorActive: { borderWidth: 2, borderColor: c.text },
  // Plan 52 P4: the expanded per-device list under a collapsed person row.
  deviceList: {
    gap: 6,
    paddingLeft: 44,
    paddingRight: 8,
    paddingBottom: 8,
  },
  deviceRow: {
    gap: 2,
    paddingVertical: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: c.surfaceElevated,
    borderRadius: MK_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
  },
  memberIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  mutedRow: { opacity: 0.62, borderWidth: StyleSheet.hairlineWidth, borderColor: c.warning },
  memberInitial: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: c.glass },
  memberInitialText: { color: c.accent, fontSize: 12, fontWeight: '900' },
  memberText: { flex: 1, minWidth: 0, gap: 2 },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMain: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
  channelMeta: { color: c.textTertiary, fontSize: 12 },
  tinyAction: {
    minHeight: 30,
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.glassBorder,
    borderRadius: MK_RADIUS.sm,
    paddingHorizontal: 9,
    backgroundColor: c.surface,
  },
  tinyActionText: { color: c.textSecondary, fontSize: 11, fontWeight: '800' },
  dangerAction: { borderColor: c.danger, backgroundColor: c.dangerSoft },
  dangerActionText: { color: c.danger },
  emptySafetyText: { color: c.textTertiary, fontSize: 12 },
  publicRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  publicText: { flex: 1, minWidth: 0, gap: 2 },
  publicTitle: { color: c.text, fontSize: 13, fontWeight: '800' },
  publicHint: { color: c.textSecondary, fontSize: 12, lineHeight: 17 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  reviewText: { flex: 1, minWidth: 0, gap: 2 },
  reviewTitle: { color: c.text, fontSize: 13, fontWeight: '800' },
  reviewMeta: { color: c.textTertiary, fontSize: 11, lineHeight: 15 },
  presenceLine: { color: c.textSecondary, fontSize: 12.5, marginBottom: 6 },
  presenceHint: { color: c.textTertiary, fontSize: 11.5, lineHeight: 16, marginTop: 6, marginBottom: 4 },
  reviewActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  reviewedPill: {
    alignSelf: 'flex-start',
    marginTop: 2,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.warning,
    backgroundColor: c.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reviewedPillText: { color: c.warning, fontSize: 10, fontWeight: '800' },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
  emptyText: { color: c.textSecondary, fontSize: 13.5, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
