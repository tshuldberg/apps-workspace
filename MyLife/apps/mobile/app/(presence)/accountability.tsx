import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  GlassPanel,
  PR_ACCENT_LIGHT,
  PR_FONTS,
  PR_SURFACES,
  PR_TEXT,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
  createAccountabilityPartner,
  getAccountabilityPartners,
  revokeAccountabilityPartner,
  updateAccountabilityPartner,
  type AccountabilityPartner,
} from '@mylife/presence';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  PresenceBottomSheet,
  PresenceEmptyState,
  PresenceHero,
  PresencePillButton,
  PresenceRow,
  PresenceScrollScreen,
  presenceScreenKitStyles,
} from './_screen-kit';

export default function AccountabilityScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [partnerName, setPartnerName] = useState('');
  const [createdPartner, setCreatedPartner] = useState<AccountabilityPartner | null>(null);
  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const partners = useMemo(() => getAccountabilityPartners(db), [db, tick]);

  const closeSheet = () => {
    setSheetVisible(false);
    setPartnerName('');
    setCreatedPartner(null);
  };

  const handleCreate = () => {
    if (partnerName.trim().length === 0) {
      Alert.alert('Missing name', 'Enter a partner name before saving.');
      return;
    }
    try {
      const partner = createAccountabilityPartner(db, partnerName);
      setCreatedPartner(partner);
      setPartnerName(partner.partnerName);
      refresh();
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not create the partner.');
    }
  };

  const sharePartnerCode = async (partner: AccountabilityPartner) => {
    try {
      await Share.share({
        message: `MyPresence accountability code for ${partner.partnerName}: ${partner.shareCode}`,
      });
    } catch {
      Alert.alert('Share failed', 'Could not open the system share sheet.');
    }
  };

  return (
    <>
      <PresenceScrollScreen>
        <PresenceHero
          eyebrow="Privacy first support"
          title="Accountability Partners"
          subtitle="Partners only see whether you hit your goal, never your raw screen-time data."
          action={<PresencePillButton label="Add Partner" icon="person_add" onPress={() => setSheetVisible(true)} />}
        />

        {partners.length === 0 ? (
          <PresenceEmptyState
            icon="handshake"
            title="No partners connected"
            body="Create a share code for a friend, coach, or partner who should only see whether you stayed aligned with your goals."
          />
        ) : (
          <View style={presenceScreenKitStyles.stack}>
            {partners.map((partner) => (
              <PresenceRow
                key={partner.id}
                icon="groups"
                title={partner.partnerName}
                subtitle={`${partner.shareCode} · ${partner.active ? 'active' : 'revoked'}`}
                right={(
                  <View style={styles.rowRight}>
                    <Switch
                      value={partner.notifyOverGoal}
                      onValueChange={(value) => {
                        try {
                          updateAccountabilityPartner(db, partner.id, { notifyOverGoal: value });
                          refresh();
                        } catch {
                          Alert.alert('Update failed', 'Could not update partner notifications.');
                        }
                      }}
                      trackColor={{ false: PR_SURFACES.high, true: `${PR_ACCENT_LIGHT}66` }}
                      thumbColor={partner.notifyOverGoal ? PR_ACCENT_LIGHT : '#ffffff'}
                    />
                    <Pressable
                      onPress={async () => {
                        try {
                          await Clipboard.setStringAsync(partner.shareCode);
                          Alert.alert('Copied', `${partner.shareCode} copied to clipboard.`);
                        } catch {
                          Alert.alert('Copy failed', 'Could not copy the share code.');
                        }
                      }}
                    >
                      <Text style={styles.inlineAction}>Copy</Text>
                    </Pressable>
                    {partner.active ? (
                      <Pressable
                        onPress={() => {
                          Alert.alert('Revoke partner', `Remove ${partner.partnerName}'s access code?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Revoke',
                              style: 'destructive',
                              onPress: () => {
                                try {
                                  revokeAccountabilityPartner(db, partner.id);
                                  refresh();
                                } catch {
                                  Alert.alert('Revoke failed', 'Could not revoke the partner.');
                                }
                              },
                            },
                          ]);
                        }}
                      >
                        <Text style={[styles.inlineAction, styles.dangerAction]}>Revoke</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
                onPress={() => void sharePartnerCode(partner)}
              />
            ))}
          </View>
        )}
      </PresenceScrollScreen>

      <PresenceBottomSheet visible={sheetVisible} onClose={closeSheet}>
        <Text style={styles.sheetTitle}>Add accountability partner</Text>

        <View>
          <Text style={presenceScreenKitStyles.fieldLabel}>Partner name</Text>
          <TextInput
            value={partnerName}
            onChangeText={setPartnerName}
            placeholder="Alex"
            placeholderTextColor={PR_TEXT_SECONDARY}
            style={presenceScreenKitStyles.input}
          />
        </View>

        {createdPartner != null ? (
          <GlassPanel padding={18} style={styles.shareCard}>
            <Text style={styles.shareLabel}>Share code</Text>
            <Text style={styles.shareCode}>{createdPartner.shareCode}</Text>
            <Text style={styles.shareBody}>Give this code to {createdPartner.partnerName} so they can receive over-goal accountability signals later.</Text>
            <View style={presenceScreenKitStyles.actionRow}>
              <Pressable
                style={presenceScreenKitStyles.secondaryButton}
                onPress={async () => {
                  try {
                    await Clipboard.setStringAsync(createdPartner.shareCode);
                    Alert.alert('Copied', 'The share code is on your clipboard.');
                  } catch {
                    Alert.alert('Copy failed', 'Could not copy the share code.');
                  }
                }}
              >
                <Text style={presenceScreenKitStyles.secondaryButtonText}>Copy Code</Text>
              </Pressable>
              <Pressable
                style={presenceScreenKitStyles.primaryButton}
                onPress={() => void sharePartnerCode(createdPartner)}
              >
                <Text style={presenceScreenKitStyles.primaryButtonText}>Send Code</Text>
              </Pressable>
            </View>
          </GlassPanel>
        ) : null}

        <View style={presenceScreenKitStyles.actionRow}>
          <Pressable style={presenceScreenKitStyles.secondaryButton} onPress={closeSheet}>
            <Text style={presenceScreenKitStyles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={presenceScreenKitStyles.primaryButton} onPress={handleCreate}>
            <Text style={presenceScreenKitStyles.primaryButtonText}>Create</Text>
          </Pressable>
        </View>
      </PresenceBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inlineAction: {
    ...PR_TYPOGRAPHY.bodySm,
    color: PR_ACCENT_LIGHT,
    fontFamily: PR_FONTS.semiBold,
  },
  dangerAction: {
    color: '#FFB4AB',
  },
  sheetTitle: {
    ...PR_TYPOGRAPHY.headlineMd,
    color: PR_TEXT,
    fontFamily: PR_FONTS.bold,
  },
  shareCard: {
    gap: 10,
  },
  shareLabel: {
    ...PR_TYPOGRAPHY.labelUpper,
    color: PR_TEXT_SECONDARY,
  },
  shareCode: {
    ...PR_TYPOGRAPHY.displayLg,
    color: PR_ACCENT_LIGHT,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: 3,
    fontFamily: PR_FONTS.extraBold,
  },
  shareBody: {
    ...PR_TYPOGRAPHY.bodyMd,
    color: PR_TEXT_SECONDARY,
  },
});
