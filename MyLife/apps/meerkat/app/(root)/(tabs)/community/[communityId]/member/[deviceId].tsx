// Plan 56 C2 (features 53-54): a member's per-community profile. The standard
// card renders ONLY verified data (signed v3 profile persona, verified badge
// awards); below it, the member's designed profile canvas (kind 'profile')
// renders through CanvasHost when one exists. Viewing your own profile adds
// "Design my profile" and copy-forward from your designs in other communities
// (new signed events, re-sealed assets, honest skip counts). The route lives
// inside the community subtree, so the community theme boundary applies.

import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { communityRole, getCommunity } from '@mylife/sync';
import { useMeerkatDatabase } from '../../../../providers/DatabaseProvider';
import { useIdentity } from '../../../../providers/IdentityProvider';
import { useNode } from '../../../../providers/NodeProvider';
import { useSync } from '../../../../providers/SyncProvider';
import { CommunityThemeProvider } from '../../../../providers/CommunityThemeProvider';
import { useAppThemeColors, useMkStyles } from '../../../../providers/AppThemeProvider';
import { shortHex, type MkColors, MK_RADIUS } from '../../../../theme/tokens';
import { Avatar } from '../../../../components/Avatar';
import { Button, HonestNotice } from '../../../../components/kit';
import { CanvasHost } from '../../../../components/canvas/CanvasHost';
import {
  copyProfileDesignForward,
  ensureMyProfileCanvas,
  getCanvasForSubject,
  listMyProfileDesigns,
} from '../../../../data/canvas-core';
import { resealCanvasAssetForCommunity } from '../../../../data/canvas-assets';
import { badgesForMember } from '../../../../data/badges-core';
import {
  resolveCommunityAvatarImage,
  resolveCommunityAvatarInitial,
  resolveCommunityDisplayName,
  resolveCommunityPersona,
} from '../../../../data/community-core';

function nameColorValue(c: MkColors, token: string | null): string | null {
  switch (token) {
    case 'accent': return c.accent;
    case 'success': return c.success;
    case 'warning': return c.warning;
    case 'danger': return c.danger;
    case 'info': return c.info;
    default: return null;
  }
}

export default function MemberProfileRoute() {
  const { communityId, deviceId } = useLocalSearchParams<{ communityId: string; deviceId: string }>();
  const cid = typeof communityId === 'string' ? communityId : '';
  return (
    <CommunityThemeProvider communityId={cid}>
      <MemberProfileScreen communityId={cid} deviceId={typeof deviceId === 'string' ? deviceId : ''} />
    </CommunityThemeProvider>
  );
}

function MemberProfileScreen({ communityId, deviceId }: { communityId: string; deviceId: string }) {
  const styles = useMkStyles(makeStyles);
  const colors = useAppThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useMeerkatDatabase();
  const { identity } = useIdentity();
  const { store } = useNode();
  const { recordLocalChange } = useSync();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  // Per-design busy: only the tapped row reads "Copying…" (a single boolean
  // would make every design row claim the in-flight verb).
  const [busyCanvasId, setBusyCanvasId] = useState<string | null>(null);

  useFocusEffect(useCallback(() => { setRevision((v) => v + 1); }, []));
  const bump = useCallback(() => setRevision((v) => v + 1), []);

  // Deep-linkable route: Back falls back to the community home (or the list)
  // when this screen is the stack's only route.
  const goBack = useCallback(() => {
    if (router.canGoBack()) { router.back(); return; }
    if (communityId) router.replace({ pathname: '/community/[communityId]', params: { communityId } });
    else router.replace('/communities');
  }, [router, communityId]);

  const isSelf = deviceId === identity.publicKey;
  const community = useMemo(() => { void revision; return getCommunity(db, communityId); }, [db, communityId, revision]);
  const isMember = community ? communityRole(community.descriptor, deviceId) !== null : false;
  const displayName = useMemo(
    () => { void revision; return resolveCommunityDisplayName(db, communityId, deviceId) ?? shortHex(deviceId); },
    [db, communityId, deviceId, revision],
  );
  const avatarInitial = resolveCommunityAvatarInitial(db, communityId, deviceId, displayName) ?? '?';
  const avatarImage = resolveCommunityAvatarImage(db, communityId, deviceId);
  const persona = useMemo(
    () => { void revision; return resolveCommunityPersona(db, communityId, deviceId); },
    [db, communityId, deviceId, revision],
  );
  const badges = useMemo(
    () => { void revision; return badgesForMember(db, communityId, deviceId); },
    [db, communityId, deviceId, revision],
  );
  const profileCanvas = useMemo(
    () => { void revision; return getCanvasForSubject(db, communityId, 'profile', deviceId); },
    [db, communityId, deviceId, revision],
  );
  // Copy-forward sources: MY designed profiles in OTHER communities with content.
  const otherDesigns = useMemo(() => {
    void revision;
    if (!isSelf) return [];
    return listMyProfileDesigns(db, identity)
      .filter((d) => d.canvas.communityId !== communityId && d.nodeCount > 0)
      .map((d) => ({
        ...d,
        communityName: getCommunity(db, d.canvas.communityId)?.descriptor.name ?? shortHex(d.canvas.communityId),
      }));
  }, [db, identity, isSelf, communityId, revision]);

  const designMyProfile = useCallback(() => {
    try {
      ensureMyProfileCanvas(db, identity, communityId, recordLocalChange);
      setNotice(null);
      bump();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not create your profile canvas.');
    }
  }, [db, identity, communityId, recordLocalChange, bump]);

  const copyForward = useCallback((fromCanvasId: string) => {
    if (busyCanvasId !== null) return;
    setBusyCanvasId(fromCanvasId);
    void (async () => {
      try {
        const result = await copyProfileDesignForward(db, identity, {
          fromCanvasId,
          toCommunityId: communityId,
          resealAsset: (asset, fromCommunityId) => resealCanvasAssetForCommunity({
            db, store, identity, asset, fromCommunityId, toCommunityId: communityId, authorDevice: identity.publicKey,
          }),
        }, recordLocalChange);
        setNotice(result.skipped > 0
          ? `Copied ${result.copied} pieces. ${result.skipped} could not be copied here (their sealed files belong to the other community) and were skipped.`
          : `Copied ${result.copied} pieces into your profile here.`);
        bump();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : 'Could not copy that design.');
      } finally {
        setBusyCanvasId(null);
      }
    })();
  }, [db, identity, store, communityId, recordLocalChange, bump, busyCanvasId]);

  const nameColor = nameColorValue(colors, persona.nameColor);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 24, gap: 12 }}>
      <View style={styles.headerRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={goBack} style={styles.backBtn}>
          <ArrowLeft size={20} color={styles.headerText.color as string} />
        </Pressable>
        <Text style={styles.headerText} numberOfLines={1}>{isSelf ? 'My profile here' : displayName}</Text>
      </View>

      {!community ? (
        <HonestNotice text="This community is not on this device." />
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Avatar imageBase64={avatarImage} initial={avatarInitial} size={52} />
              <View style={styles.cardCopy}>
                <Text style={[styles.cardName, nameColor ? { color: nameColor } : null]} numberOfLines={1}>
                  {displayName}
                </Text>
                {persona.pronouns ? <Text style={styles.cardPronouns}>{persona.pronouns}</Text> : null}
                {!isMember ? <Text style={styles.cardPronouns}>Not currently a member of this community.</Text> : null}
              </View>
            </View>
            {persona.bio ? <Text style={styles.cardBio}>{persona.bio}</Text> : null}
            {badges.length > 0 ? (
              <View style={styles.badgeRow}>
                {badges.map((badge) => (
                  <View key={badge.badgeId} style={styles.badgeChip}>
                    <Text style={styles.badgeGlyph}>{badge.glyph}</Text>
                    <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {isSelf ? (
              <Text style={styles.selfHint}>
                Edit your name, photo, bio, pronouns, and name color in this community's settings.
              </Text>
            ) : null}
          </View>

          {profileCanvas ? (
            <CanvasHost community={community} canvas={profileCanvas} />
          ) : isSelf ? (
            <View style={styles.card}>
              <Text style={styles.cardBio}>
                You have not designed this profile yet. A designed profile is a freeform canvas other members see here.
              </Text>
              <Button title="Design my profile" onPress={designMyProfile} />
            </View>
          ) : (
            <Text style={styles.selfHint}>
              {displayName} has not designed a profile here, or it has not arrived on this device yet.
            </Text>
          )}

          {isSelf && otherDesigns.length > 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardName}>Use one of my other designs</Text>
              <Text style={styles.selfHint}>
                Copies the pieces into this community as your own new work; the original stays untouched. Sealed images are re-sealed for this community when this device can open them.
              </Text>
              {otherDesigns.map((design) => (
                <View key={design.canvas.id} style={styles.designRow}>
                  <View style={styles.cardCopy}>
                    <Text style={styles.designName} numberOfLines={1}>{design.communityName}</Text>
                    <Text style={styles.cardPronouns}>{design.nodeCount} pieces</Text>
                  </View>
                  <Button
                    title={busyCanvasId === design.canvas.id ? 'Copying…' : 'Use this design here'}
                    variant="secondary"
                    onPress={() => copyForward(design.canvas.id)}
                    disabled={busyCanvasId !== null}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {notice ? <HonestNotice text={notice} /> : null}
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
    backBtn: { padding: 6 },
    headerText: { color: c.text, fontSize: 17, fontWeight: '700', flex: 1 },
    card: {
      marginHorizontal: 12,
      backgroundColor: c.surface,
      borderColor: c.glassBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: MK_RADIUS.lg,
      padding: 14,
      gap: 10,
    },
    cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    cardCopy: { flex: 1, gap: 2 },
    cardName: { color: c.text, fontSize: 17, fontWeight: '800' },
    cardPronouns: { color: c.textTertiary, fontSize: 13 },
    cardBio: { color: c.textSecondary, fontSize: 14, lineHeight: 20 },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    badgeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.surfaceElevated,
      borderRadius: MK_RADIUS.sm,
      paddingHorizontal: 8,
      paddingVertical: 4,
      maxWidth: 180,
    },
    badgeGlyph: { fontSize: 15 },
    badgeName: { color: c.textSecondary, fontSize: 12, fontWeight: '700', flexShrink: 1 },
    selfHint: { color: c.textTertiary, fontSize: 12, paddingHorizontal: 12 },
    designRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    designName: { color: c.text, fontSize: 14, fontWeight: '700' },
  });
