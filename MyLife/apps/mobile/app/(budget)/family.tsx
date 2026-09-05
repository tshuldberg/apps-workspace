import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MAX_FAMILY_SIZE,
  MaterialSymbol,
  createFamily,
  createFamilyMember,
  createSyncLogEntry,
  generateInviteCode,
  getEnvelopeSharingModes,
  getFamilyByInviteCode,
  getFamilyMembers,
  getSyncLogSince,
  isInviteExpired,
  listEnvelopes,
  removeFamilyMember,
  setEnvelopeSharingMode,
  type Envelope,
  type EnvelopeSharingRecord,
  type Family,
  type FamilyMember,
  type SyncLogEntry,
  updateFamilyMember,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type SharingMode = EnvelopeSharingRecord['sharing_mode'];
type MemberRole = FamilyMember['role'];

const SHARING_MODES: SharingMode[] = ['shared', 'visible', 'private'];
const ROLE_OPTIONS: MemberRole[] = ['admin', 'member', 'viewer'];
const DEVICE_ID = 'local-device';

function formatRelativeTimestamp(value: string | null): string {
  if (!value) {
    return 'Pending sync';
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.max(1, Math.floor(deltaMs / (1000 * 60)));

  if (deltaMinutes < 60) {
    return `Synced ${deltaMinutes}m ago`;
  }

  const deltaHours = Math.floor(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `Synced ${deltaHours}h ago`;
  }

  const deltaDays = Math.floor(deltaHours / 24);
  return `Synced ${deltaDays}d ago`;
}

function getRoleTone(role: MemberRole): string {
  switch (role) {
    case 'owner':
      return BG_ACCENT_LIGHT;
    case 'admin':
      return BG_MONEY;
    case 'viewer':
      return '#A78BFA';
    default:
      return '#8BCFF0';
  }
}

function getActivityIcon(entry: SyncLogEntry): string {
  if (entry.table_name === 'bg_family_members') {
    return entry.operation === 'delete' ? 'close' : 'group';
  }
  if (entry.table_name === 'bg_envelope_sharing') {
    return 'account_balance_wallet';
  }
  if (entry.table_name === 'bg_families') {
    return 'handshake';
  }
  return entry.operation === 'delete' ? 'delete' : 'check_circle';
}

function getActivitySummary(entry: SyncLogEntry): string {
  try {
    const payload = JSON.parse(entry.payload) as Record<string, string | undefined>;
    return payload.summary ?? payload.action ?? `${entry.operation} ${entry.table_name}`;
  } catch {
    return `${entry.operation} ${entry.table_name}`;
  }
}

function countSharedEnvelopes(sharingModes: EnvelopeSharingRecord[]): number {
  return sharingModes.filter((record) => record.sharing_mode !== 'private').length;
}

export default function FamilyScreen() {
  const db = useDatabase();

  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [sharingModes, setSharingModes] = useState<EnvelopeSharingRecord[]>([]);
  const [activity, setActivity] = useState<SyncLogEntry[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const families = db.query<Family>(
        'SELECT * FROM bg_families ORDER BY created_at DESC LIMIT 1',
        [],
      );
      const currentFamily = families[0] ?? null;

      setFamily(currentFamily);

      if (!currentFamily) {
        setMembers([]);
        setEnvelopes([]);
        setSharingModes([]);
        setActivity([]);
        return;
      }

      setMembers(getFamilyMembers(db, currentFamily.id));
      setEnvelopes(listEnvelopes(db, false));
      setSharingModes(getEnvelopeSharingModes(db, currentFamily.id));
      setActivity(
        getSyncLogSince(db, currentFamily.id, '1970-01-01T00:00:00.000Z')
          .slice(-8)
          .reverse(),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load family sharing.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const logFamilyEvent = useCallback(
    (
      familyId: string,
      operation: SyncLogEntry['operation'],
      tableName: string,
      recordId: string,
      summary: string,
    ) => {
      createSyncLogEntry(db, uuid(), {
        family_id: familyId,
        device_id: DEVICE_ID,
        operation,
        table_name: tableName,
        record_id: recordId,
        payload: JSON.stringify({ summary }),
        timestamp: new Date().toISOString(),
        applied: 1,
      });
    },
    [db],
  );

  const refreshInviteCode = useCallback(() => {
    if (!family) {
      return null;
    }

    const nextCode = generateInviteCode();
    db.execute('UPDATE bg_families SET invite_code = ?, updated_at = ? WHERE id = ?', [
      nextCode,
      new Date().toISOString(),
      family.id,
    ]);
    logFamilyEvent(family.id, 'update', 'bg_families', family.id, 'Refreshed family invite code');
    return nextCode;
  }, [db, family, logFamilyEvent]);

  const handleCreateFamily = useCallback(() => {
    try {
      const familyId = uuid();
      const createdFamily = createFamily(db, familyId, {
        name: 'Budget Circle',
        created_by_device_id: DEVICE_ID,
        invite_code: generateInviteCode(),
      });
      const createdMember = createFamilyMember(db, uuid(), {
        family_id: familyId,
        device_id: DEVICE_ID,
        display_name: 'You',
        avatar_emoji: '🪙',
        role: 'owner',
        last_sync_at: new Date().toISOString(),
      });
      logFamilyEvent(createdFamily.id, 'create', 'bg_families', createdFamily.id, 'Created a new family circle');
      logFamilyEvent(
        createdFamily.id,
        'create',
        'bg_family_members',
        createdMember.id,
        'Added yourself as the family owner',
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create family.');
    }
  }, [db, load, logFamilyEvent]);

  const handleJoinFamily = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Enter an invite code.');
      return;
    }

    try {
      const match = getFamilyByInviteCode(db, code);
      if (!match) {
        setError('Invite code not found.');
        return;
      }
      if (isInviteExpired(match.updated_at)) {
        setError('This invite code has expired.');
        return;
      }

      const existingMembers = getFamilyMembers(db, match.id);
      if (existingMembers.length >= MAX_FAMILY_SIZE) {
        setError('This family is already at capacity.');
        return;
      }

      const joinedMember = createFamilyMember(db, uuid(), {
        family_id: match.id,
        device_id: DEVICE_ID,
        display_name: 'You',
        avatar_emoji: '🧾',
        role: 'member',
        last_sync_at: new Date().toISOString(),
      });
      logFamilyEvent(match.id, 'create', 'bg_family_members', joinedMember.id, 'Joined the family via invite code');
      setJoinCode('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join family.');
    }
  }, [db, joinCode, load, logFamilyEvent]);

  const handleInviteMember = useCallback(async () => {
    if (!family) {
      return;
    }

    try {
      const inviteCode = isInviteExpired(family.updated_at)
        ? refreshInviteCode()
        : family.invite_code;

      if (!inviteCode) {
        return;
      }

      await Clipboard.setStringAsync(inviteCode);
      Alert.alert('Invite Ready', `Share code ${inviteCode} with a household member.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare invite code.');
    }
  }, [family, load, refreshInviteCode]);

  const handleRoleChange = useCallback(
    (member: FamilyMember, nextRole: MemberRole) => {
      if (!family || member.role === 'owner' || member.role === nextRole) {
        return;
      }

      try {
        updateFamilyMember(db, member.id, {
          last_sync_at: new Date().toISOString(),
          role: nextRole,
        });
        logFamilyEvent(
          family.id,
          'update',
          'bg_family_members',
          member.id,
          `Changed ${member.display_name} to ${nextRole}`,
        );
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update member role.');
      }
    },
    [db, family, load, logFamilyEvent],
  );

  const handleRemoveMember = useCallback(
    (member: FamilyMember) => {
      if (!family) {
        return;
      }

      Alert.alert('Remove Member', `Remove ${member.display_name} from this family?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            try {
              removeFamilyMember(db, member.id);
              logFamilyEvent(
                family.id,
                'delete',
                'bg_family_members',
                member.id,
                `Removed ${member.display_name} from the family`,
              );
              load();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to remove member.');
            }
          },
        },
      ]);
    },
    [db, family, load, logFamilyEvent],
  );

  const handleSharingMode = useCallback(
    (envelope: Envelope, nextMode: SharingMode) => {
      if (!family) {
        return;
      }

      try {
        const existing = sharingModes.find((record) => record.envelope_id === envelope.id);
        setEnvelopeSharingMode(db, existing?.id ?? uuid(), {
          family_id: family.id,
          envelope_id: envelope.id,
          sharing_mode: nextMode,
        });
        logFamilyEvent(
          family.id,
          'update',
          'bg_envelope_sharing',
          envelope.id,
          `Set ${envelope.name} to ${nextMode} visibility`,
        );
        load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update envelope visibility.');
      }
    },
    [db, family, load, logFamilyEvent, sharingModes],
  );

  const sharingMap = useMemo(
    () => new Map(sharingModes.map((record) => [record.envelope_id, record.sharing_mode])),
    [sharingModes],
  );

  const currentMember = members.find((member) => member.device_id === DEVICE_ID) ?? null;
  const canManageMembers = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const sharedEnvelopeCount = countSharedEnvelopes(sharingModes);
  const inviteExpired = family ? isInviteExpired(family.updated_at) : false;

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <MaterialSymbol color={BG_ACCENT_LIGHT} name="group" size={22} />
        <Text style={styles.loadingCopy}>Loading family sharing…</Text>
      </View>
    );
  }

  if (!family) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <LinearGradient
          colors={[`${BG_ACCENT}FF`, `${BG_MONEY}CC`]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.emptyHero}
        >
          <Text style={styles.emptyEyebrow}>Family Sharing</Text>
          <Text style={styles.emptyTitle}>Build your budget circle</Text>
          <Text style={styles.emptySubtitle}>
            Invite a partner, roommate, or family member to collaborate on envelopes and shared
            spending.
          </Text>
          <Pressable onPress={handleCreateFamily} style={styles.primaryHeroButton}>
            <Text style={styles.primaryHeroButtonText}>Create Family</Text>
            <MaterialSymbol color={BG_SURFACES.lowest} name="arrow_forward" size={18} />
          </Pressable>
        </LinearGradient>

        <GlassCard style={styles.joinCard}>
          <Text style={styles.sectionEyebrow}>Join With Invite Code</Text>
          <Text style={styles.sectionTitle}>Already sharing a plan?</Text>
          <Text style={styles.sectionCopy}>
            Paste a household invite code to join an existing family and sync shared envelopes.
          </Text>
          <TextInput
            autoCapitalize="characters"
            onChangeText={setJoinCode}
            placeholder="ABCD2345"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.textInput}
            value={joinCode}
          />
          <Pressable onPress={handleJoinFamily} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Join Family</Text>
          </Pressable>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.heroCopy}>
        <Text style={styles.sectionEyebrow}>Family Sharing</Text>
        <Text style={styles.heroTitle}>Manage your household budget together</Text>
        <Text style={styles.heroSubtitle}>
          Keep shared envelopes visible, track member roles, and audit sync activity from one place.
        </Text>
      </View>

      <LinearGradient
        colors={[`${BG_ACCENT}E6`, `${BG_MONEY}B3`]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.heroCard}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroIdentity}>
            <Text style={styles.heroFamilyName}>{family.name}</Text>
            <Text style={styles.heroFamilyCopy}>
              Invite code {family.invite_code}
              {inviteExpired ? ' • refresh recommended' : ''}
            </Text>
          </View>
          <Pressable onPress={handleInviteMember} style={styles.heroAction}>
            <MaterialSymbol color={BG_SURFACES.lowest} name="group" size={18} />
            <Text style={styles.heroActionText}>Invite Member</Text>
          </Pressable>
        </View>

        <View style={styles.heroStatsRow}>
          <HeroStat label="Members" value={String(members.length)} />
          <HeroStat label="Shared Envelopes" value={String(sharedEnvelopeCount)} />
          <HeroStat label="Capacity Left" value={String(Math.max(0, MAX_FAMILY_SIZE - members.length))} />
        </View>
      </LinearGradient>

      <GlassCard style={styles.membersCard}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionEyebrow}>Members</Text>
            <Text style={styles.sectionTitle}>
              {members.length} of {MAX_FAMILY_SIZE} active
            </Text>
          </View>
        </View>

        <View style={styles.stack}>
          {members.map((member) => {
            const tone = getRoleTone(member.role);
            return (
              <View key={member.id} style={styles.memberRow}>
                <View style={styles.memberIdentity}>
                  <View style={[styles.memberAvatar, { backgroundColor: `${tone}22` }]}>
                    <Text style={styles.memberAvatarText}>{member.avatar_emoji}</Text>
                  </View>
                  <View style={styles.memberCopy}>
                    <Text style={styles.memberName}>
                      {member.display_name}
                      {member.device_id === DEVICE_ID ? ' • You' : ''}
                    </Text>
                    <Text style={styles.memberStatus}>
                      {member.device_id === DEVICE_ID
                        ? 'This device'
                        : formatRelativeTimestamp(member.last_sync_at)}
                    </Text>
                  </View>
                </View>

                <View style={styles.memberActions}>
                  <View style={[styles.rolePill, { backgroundColor: `${tone}22` }]}>
                    <Text style={[styles.rolePillText, { color: tone }]}>{member.role}</Text>
                  </View>
                  {canManageMembers && member.role !== 'owner' ? (
                    <View style={styles.roleOptions}>
                      {ROLE_OPTIONS.map((role) => (
                        <Pressable
                          key={role}
                          onPress={() => handleRoleChange(member, role)}
                          style={[
                            styles.roleOption,
                            member.role === role ? styles.roleOptionActive : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleOptionText,
                              member.role === role ? styles.roleOptionTextActive : null,
                            ]}
                          >
                            {role}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {canManageMembers && member.role !== 'owner' ? (
                    <Pressable onPress={() => handleRemoveMember(member)} style={styles.removeButton}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.envelopeCard}>
        <Text style={styles.sectionEyebrow}>Shared Envelopes</Text>
        <Text style={styles.sectionTitle}>Choose what the household can see</Text>
        <Text style={styles.sectionCopy}>
          Shared means everyone can collaborate. Visible keeps the envelope read-only for others.
          Private hides it from the rest of the family circle.
        </Text>

        <View style={styles.stack}>
          {envelopes.map((envelope) => {
            const currentMode = sharingMap.get(envelope.id) ?? 'shared';
            return (
              <View key={envelope.id} style={styles.envelopeRow}>
                <View style={styles.envelopeIdentity}>
                  <View style={styles.envelopeIcon}>
                    <Text style={styles.envelopeIconText}>{envelope.icon ?? '💰'}</Text>
                  </View>
                  <View style={styles.envelopeCopy}>
                    <Text style={styles.envelopeName}>{envelope.name}</Text>
                    <Text style={styles.envelopeMeta}>
                      {envelope.rollover_enabled === 1 ? 'Rollover enabled' : 'Monthly envelope'}
                    </Text>
                  </View>
                </View>

                <View style={styles.envelopeModes}>
                  {SHARING_MODES.map((mode) => (
                    <Pressable
                      key={mode}
                      onPress={() => handleSharingMode(envelope, mode)}
                      style={[
                        styles.modePill,
                        currentMode === mode ? styles.modePillActive : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modePillText,
                          currentMode === mode ? styles.modePillTextActive : null,
                        ]}
                      >
                        {mode}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.activityCard}>
        <Text style={styles.sectionEyebrow}>Recent Activity</Text>
        <Text style={styles.sectionTitle}>Latest sync and sharing actions</Text>
        {activity.length ? (
          <View style={styles.stack}>
            {activity.map((entry) => (
              <View key={entry.id} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <MaterialSymbol color={BG_ACCENT_LIGHT} name={getActivityIcon(entry)} size={18} />
                </View>
                <View style={styles.activityCopy}>
                  <Text style={styles.activityTitle}>{getActivitySummary(entry)}</Text>
                  <Text style={styles.activityMeta}>
                    {new Date(entry.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                    {' • '}
                    {new Date(entry.timestamp).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyActivity}>No shared activity yet. Invite someone to start collaborating.</Text>
        )}
      </GlassCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 18,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  loadingCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  heroCopy: {
    gap: 8,
    paddingTop: 6,
  },
  sectionEyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  heroCard: {
    borderRadius: 28,
    gap: 22,
    padding: 24,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
  },
  heroIdentity: {
    flex: 1,
    gap: 6,
  },
  heroFamilyName: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.6,
  },
  heroFamilyCopy: {
    color: 'rgba(14, 14, 19, 0.75)',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  heroAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  heroActionText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    flex: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  heroStatValue: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 26,
  },
  heroStatLabel: {
    color: 'rgba(14, 14, 19, 0.72)',
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  membersCard: {
    gap: 16,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  sectionCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
  },
  stack: {
    gap: 12,
  },
  memberRow: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    gap: 14,
    padding: 14,
  },
  memberIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  memberAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  memberAvatarText: {
    fontSize: 20,
  },
  memberCopy: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  memberStatus: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  memberActions: {
    gap: 10,
  },
  rolePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  rolePillText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleOption: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  roleOptionActive: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  roleOptionText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'capitalize',
  },
  roleOptionTextActive: {
    color: BG_ACCENT_LIGHT,
  },
  removeButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  removeButtonText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  envelopeCard: {
    gap: 16,
  },
  envelopeRow: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    gap: 14,
    padding: 14,
  },
  envelopeIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  envelopeIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}18`,
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  envelopeIconText: {
    fontSize: 17,
  },
  envelopeCopy: {
    flex: 1,
    gap: 4,
  },
  envelopeName: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  envelopeMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  envelopeModes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modePill: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillActive: {
    backgroundColor: `${BG_MONEY}22`,
  },
  modePillText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  modePillTextActive: {
    color: BG_MONEY,
  },
  activityCard: {
    gap: 16,
  },
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  activityIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}18`,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  activityCopy: {
    flex: 1,
    gap: 4,
  },
  activityTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
  },
  activityMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyActivity: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  emptyHero: {
    borderRadius: 28,
    gap: 12,
    padding: 24,
  },
  emptyEyebrow: {
    color: 'rgba(14, 14, 19, 0.7)',
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  emptyTitle: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  emptySubtitle: {
    color: 'rgba(14, 14, 19, 0.74)',
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryHeroButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryHeroButtonText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  joinCard: {
    gap: 12,
  },
  textInput: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
});
