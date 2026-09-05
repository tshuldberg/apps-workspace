import { useCallback, useEffect, useMemo, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  getAccounts,
  getNotificationPreferences,
  upsertNotificationPreferences,
  isQuietHours,
  getContacts,
} from '@mylife/mail';
import type { MailAccount, NotificationPreferences } from '@mylife/mail';
import { Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.mail;

const SOUNDS = ['Default', 'Chime', 'Ping', 'None'];

interface AccountPrefs {
  account: MailAccount;
  prefs: NotificationPreferences | null;
  vipCount: number;
}

export default function NotificationsScreen() {
  const db = useDatabase();
  const [loading, setLoading] = useState(true);
  const [accountPrefs, setAccountPrefs] = useState<AccountPrefs[]>([]);

  const accounts = useMemo(() => getAccounts(db), [db]);

  const loadData = useCallback(() => {
    try {
      const result: AccountPrefs[] = [];
      for (const a of accounts) {
        let prefs: NotificationPreferences | null = null;
        try { prefs = getNotificationPreferences(db, a.id); } catch { /* ignored */ }
        const contacts = getContacts(db, a.id);
        const vipCount = contacts.filter((c) => c.isVip).length;
        result.push({ account: a, prefs, vipCount });
      }
      setAccountPrefs(result);
    } catch { /* ignored */ } finally { setLoading(false); }
  }, [db, accounts]);

  useEffect(() => { loadData(); }, [loadData]);

  const updatePref = useCallback((accountId: string, update: Partial<NotificationPreferences>) => {
    try {
      const existing = accountPrefs.find((ap) => ap.account.id === accountId)?.prefs;
      const id = existing?.id ?? `notif_${uuid()}`;
      upsertNotificationPreferences(db, id, accountId, {
        enabled: update.enabled ?? existing?.enabled ?? true,
        vipOnly: update.vipOnly ?? existing?.vipOnly ?? false,
        showPreview: update.showPreview ?? existing?.showPreview ?? true,
        sound: update.sound ?? existing?.sound ?? 'Default',
        quietStart: update.quietStart !== undefined ? update.quietStart : (existing?.quietStart ?? null),
        quietEnd: update.quietEnd !== undefined ? update.quietEnd : (existing?.quietEnd ?? null),
      });
      loadData();
    } catch { /* ignored */ }
  }, [db, accountPrefs, loadData]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {accountPrefs.map(({ account, prefs, vipCount }) => {
        const enabled = prefs?.enabled ?? true;
        const quietActive = prefs?.quietStart && prefs?.quietEnd
          ? isQuietHours(prefs.quietStart, prefs.quietEnd)
          : false;

        return (
          <View key={account.id} style={styles.section}>
            {accounts.length > 1 && (
              <View style={styles.accountHeader}>
                <View style={[styles.accountDot, { backgroundColor: ACCENT }]} />
                <Text variant="subheading" color={colors.text}>{account.email}</Text>
              </View>
            )}

            {/* Master toggle */}
            <View style={styles.settingRow}>
              <Text variant="body" color={colors.text}>Enable Notifications</Text>
              <Switch
                value={enabled}
                onValueChange={(val) => updatePref(account.id, { enabled: val })}
                trackColor={{ true: ACCENT, false: colors.border }}
              />
            </View>

            {enabled && (
              <>
                {/* VIP Only */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text variant="body" color={colors.text}>VIP Only</Text>
                    <Text variant="caption" color={colors.textSecondary}>
                      {vipCount} contact{vipCount !== 1 ? 's' : ''} marked as VIP
                    </Text>
                  </View>
                  <Switch
                    value={prefs?.vipOnly ?? false}
                    onValueChange={(val) => updatePref(account.id, { vipOnly: val })}
                    trackColor={{ true: ACCENT, false: colors.border }}
                  />
                </View>

                {/* Show Preview */}
                <View style={styles.settingRow}>
                  <Text variant="body" color={colors.text}>Show Preview</Text>
                  <Switch
                    value={prefs?.showPreview ?? true}
                    onValueChange={(val) => updatePref(account.id, { showPreview: val })}
                    trackColor={{ true: ACCENT, false: colors.border }}
                  />
                </View>

                {/* Sound */}
                <View style={styles.soundSection}>
                  <Text variant="body" color={colors.text}>Sound</Text>
                  <View style={styles.soundRow}>
                    {SOUNDS.map((s) => (
                      <Pressable
                        key={s}
                        style={[styles.soundChip, (prefs?.sound ?? 'Default') === s && styles.soundChipActive]}
                        onPress={() => updatePref(account.id, { sound: s })}
                      >
                        <Text
                          variant="caption"
                          color={(prefs?.sound ?? 'Default') === s ? ACCENT : colors.textSecondary}
                        >
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Quiet Hours */}
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text variant="body" color={colors.text}>Quiet Hours</Text>
                    {prefs?.quietStart && prefs?.quietEnd && (
                      <Text variant="caption" color={quietActive ? ACCENT : colors.textSecondary}>
                        {prefs.quietStart} - {prefs.quietEnd}
                        {quietActive ? ' (active now)' : ''}
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={!!(prefs?.quietStart && prefs?.quietEnd)}
                    onValueChange={(val) => {
                      if (val) {
                        updatePref(account.id, { quietStart: '22:00', quietEnd: '07:00' });
                      } else {
                        updatePref(account.id, { quietStart: null, quietEnd: null });
                      }
                    }}
                    trackColor={{ true: ACCENT, false: colors.border }}
                  />
                </View>
              </>
            )}

            {!enabled && (
              <Text variant="caption" color={colors.textTertiary} style={styles.disabledHint}>
                All notification settings are disabled for this account
              </Text>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background,
  },
  section: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingBottom: spacing.md, marginBottom: spacing.md,
  },
  accountHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  accountDot: { width: 8, height: 8, borderRadius: 4 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    minHeight: 48,
  },
  settingInfo: { flex: 1, gap: 2 },
  soundSection: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  soundRow: { flexDirection: 'row', gap: spacing.sm },
  soundChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  soundChipActive: { borderColor: ACCENT, backgroundColor: 'rgba(59,130,246,0.1)' },
  disabledHint: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
