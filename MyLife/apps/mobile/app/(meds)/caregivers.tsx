import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import {
  createCaregiver,
  deleteCaregiver,
  getAlertConfig,
  getAlertHistory,
  getCaregivers,
  updateAlertConfig,
  updateCaregiver,
  type Caregiver,
  type CaregiverRuleConfig,
} from '@mylife/meds';
import {
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_FONTS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TEXT_TERTIARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '@mylife/meds/ui';
import { ErrorState } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

const RELATIONSHIP_OPTIONS = [
  'spouse',
  'parent',
  'child',
  'sibling',
  'friend',
  'doctor',
  'nurse',
  'other',
] as const;

const METHOD_OPTIONS = ['sms', 'email', 'both'] as const;

const RULE_META: Record<
  CaregiverRuleConfig['key'],
  { title: string; subtitle: string; icon: string; color: string }
> = {
  missed_dose: {
    title: 'Missed dose',
    subtitle: 'Escalate when a scheduled dose remains unlogged.',
    icon: 'medication',
    color: MD_ACCENT_LIGHT,
  },
  abnormal_bp: {
    title: 'Abnormal BP',
    subtitle: 'Trigger an alert when blood pressure crosses your ceiling.',
    icon: 'monitor_heart',
    color: '#FFB877',
  },
  glucose_low: {
    title: 'Low glucose',
    subtitle: 'Share urgent low glucose events automatically.',
    icon: 'bloodtype',
    color: '#8BCFF0',
  },
  glucose_high: {
    title: 'High glucose',
    subtitle: 'Notify trusted contacts when glucose remains elevated.',
    icon: 'bloodtype',
    color: '#FFB4AB',
  },
  missed_check_in: {
    title: 'Missed check-in',
    subtitle: 'Alert caregivers if you miss a daily wellness check-in window.',
    icon: 'schedule',
    color: '#FFD60A',
  },
};

function RuleThreshold({ rule }: { rule: CaregiverRuleConfig }) {
  if (rule.key === 'abnormal_bp') {
    return <RNText style={styles.ruleThreshold}>{rule.threshold} / 90</RNText>;
  }
  return (
    <RNText style={styles.ruleThreshold}>
      {rule.threshold} {rule.unit}
    </RNText>
  );
}

function Pill({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active?: boolean;
  color: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        { backgroundColor: active ? withAlpha(color, 0.18) : MD_SURFACES.high },
      ]}
    >
      <RNText style={[styles.pillText, { color: active ? color : MD_TEXT_SECONDARY }]}>
        {label}
      </RNText>
    </Pressable>
  );
}

export default function CaregiversScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relationship, setRelationship] = useState<(typeof RELATIONSHIP_OPTIONS)[number]>('friend');

  const data = useMemo(() => {
    try {
      return {
        error: null,
        caregivers: getCaregivers(db),
        config: getAlertConfig(db),
        history: getAlertHistory(db, 10),
      };
    } catch {
      return {
        error: 'Failed to load caregiver settings.',
        caregivers: [] as Caregiver[],
        config: null,
        history: [],
      };
    }
  }, [db, tick]);

  const refresh = () => setTick((value) => value + 1);

  const resetEditor = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setRelationship('friend');
    setEditorVisible(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setEmail('');
    setRelationship('friend');
    setEditorVisible(true);
  };

  const openEdit = (caregiver: Caregiver) => {
    setEditingId(caregiver.id);
    setName(caregiver.name);
    setPhone(caregiver.phone ?? '');
    setEmail(caregiver.email ?? '');
    setRelationship((caregiver.relationship ?? 'friend') as (typeof RELATIONSHIP_OPTIONS)[number]);
    setEditorVisible(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }
    if (!phone.trim() && !email.trim()) {
      Alert.alert('Contact required', 'Add either a phone number or email.');
      return;
    }

    try {
      if (editingId) {
        updateCaregiver(db, editingId, {
          name,
          phone,
          email,
          relationship,
        });
      } else {
        createCaregiver(db, {
          name,
          phone,
          email,
          relationship,
        });
      }
      resetEditor();
      refresh();
    } catch {
      Alert.alert('Unable to save caregiver', 'Please review the contact details.');
    }
  };

  const handleDelete = (caregiver: Caregiver) => {
    Alert.alert('Remove caregiver', `Remove ${caregiver.name} from your trusted circle?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteCaregiver(db, caregiver.id);
          refresh();
        },
      },
    ]);
  };

  const handleToggleActive = (caregiver: Caregiver) => {
    updateCaregiver(db, caregiver.id, { isActive: !caregiver.isActive });
    refresh();
  };

  const handleRuleChange = (nextRule: CaregiverRuleConfig) => {
    if (!data.config) {
      return;
    }

    updateAlertConfig(db, {
      ...data.config,
      rules: data.config.rules.map((rule) => (
        rule.key === nextRule.key ? nextRule : rule
      )),
    });
    refresh();
  };

  const handleMethodChange = (method: (typeof METHOD_OPTIONS)[number]) => {
    if (!data.config) {
      return;
    }
    updateAlertConfig(db, {
      ...data.config,
      alertMethod: method,
    });
    refresh();
  };

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Unable to open', url);
    }
  };

  if (data.error || !data.config) {
    return (
      <View style={styles.errorShell}>
        <ErrorState message={data.error ?? 'Failed to load caregivers.'} onRetry={refresh} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <RNText style={styles.eyebrow}>Guardian Network</RNText>
            <RNText style={styles.heroTitle}>Caregivers</RNText>
            <RNText style={styles.heroBody}>
              Choose exactly who gets health updates, how fast they get them,
              and which rules warrant interruption.
            </RNText>
          </View>
          <Pressable onPress={openCreate} style={styles.heroButton}>
            <MaterialSymbol color="#2B1704" name="person_add" size={20} />
            <RNText style={styles.heroButtonText}>Add</RNText>
          </Pressable>
        </View>

        <GlassCard padding={20}>
          <SectionHeader title="Trusted Circle" />
          <View style={styles.sectionList}>
            {data.caregivers.length === 0 ? (
              <RNText style={styles.emptyCopy}>
                Add at least one caregiver so missed doses or severe vital events
                can leave your device intentionally and on your terms.
              </RNText>
            ) : (
              data.caregivers.map((caregiver) => (
                <View key={caregiver.id} style={styles.caregiverCard}>
                  <View style={styles.caregiverHeader}>
                    <View style={styles.avatarShell}>
                      <RNText style={styles.avatarLetter}>
                        {caregiver.name.charAt(0).toUpperCase()}
                      </RNText>
                    </View>
                    <View style={styles.caregiverCopy}>
                      <RNText style={styles.caregiverName}>{caregiver.name}</RNText>
                      <RNText style={styles.caregiverMeta}>
                        {(caregiver.relationship ?? 'trusted contact').replace('_', ' ')}
                      </RNText>
                      {caregiver.phone ? (
                        <RNText style={styles.caregiverMeta}>{caregiver.phone}</RNText>
                      ) : null}
                      {caregiver.email ? (
                        <RNText style={styles.caregiverMeta}>{caregiver.email}</RNText>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleToggleActive(caregiver)}
                      style={[
                        styles.togglePill,
                        {
                          backgroundColor: caregiver.isActive
                            ? withAlpha(MD_ACCENT_LIGHT, 0.18)
                            : MD_SURFACES.high,
                        },
                      ]}
                    >
                      <RNText
                        style={[
                          styles.toggleLabel,
                          { color: caregiver.isActive ? MD_ACCENT_LIGHT : MD_TEXT_TERTIARY },
                        ]}
                      >
                        {caregiver.isActive ? 'On' : 'Off'}
                      </RNText>
                    </Pressable>
                  </View>

                  <View style={styles.actionsRow}>
                    {caregiver.phone ? (
                      <>
                        <Pressable
                          onPress={() => openLink(`tel:${caregiver.phone}`)}
                          style={styles.actionButton}
                        >
                          <MaterialSymbol color={MD_ACCENT_LIGHT} name="call" size={18} />
                          <RNText style={styles.actionButtonText}>Call</RNText>
                        </Pressable>
                        <Pressable
                          onPress={() => openLink(`sms:${caregiver.phone}`)}
                          style={styles.actionButton}
                        >
                          <MaterialSymbol color={MD_ACCENT_LIGHT} name="message" size={18} />
                          <RNText style={styles.actionButtonText}>Message</RNText>
                        </Pressable>
                      </>
                    ) : null}
                    {caregiver.email ? (
                      <Pressable
                        onPress={() => openLink(`mailto:${caregiver.email}`)}
                        style={styles.actionButton}
                      >
                        <MaterialSymbol color={MD_ACCENT_LIGHT} name="description" size={18} />
                        <RNText style={styles.actionButtonText}>Email</RNText>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => openEdit(caregiver)} style={styles.actionButton}>
                      <MaterialSymbol color={MD_TEXT_SECONDARY} name="edit" size={18} />
                      <RNText style={styles.actionButtonText}>Edit</RNText>
                    </Pressable>
                    <Pressable onPress={() => handleDelete(caregiver)} style={styles.actionButton}>
                      <MaterialSymbol color="#FFB4AB" name="delete" size={18} />
                      <RNText style={[styles.actionButtonText, { color: '#FFB4AB' }]}>
                        Remove
                      </RNText>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        </GlassCard>

        <GlassCard padding={20}>
          <SectionHeader title="Alert Rules" />
          <View style={styles.methodRow}>
            {METHOD_OPTIONS.map((method) => (
              <Pill
                key={method}
                active={data.config.alertMethod === method}
                color={MD_ACCENT_LIGHT}
                label={method}
                onPress={() => handleMethodChange(method)}
              />
            ))}
          </View>

          <View style={styles.sectionList}>
            {data.config.rules.map((rule) => {
              const meta = RULE_META[rule.key];
              return (
                <View key={rule.key} style={styles.ruleCard}>
                  <View style={styles.ruleHeader}>
                    <View style={[styles.ruleIcon, { backgroundColor: withAlpha(meta.color, 0.14) }]}>
                      <MaterialSymbol color={meta.color} name={meta.icon} size={18} />
                    </View>
                    <View style={styles.caregiverCopy}>
                      <RNText style={styles.caregiverName}>{meta.title}</RNText>
                      <RNText style={styles.caregiverMeta}>{meta.subtitle}</RNText>
                    </View>
                    <Pressable
                      onPress={() => handleRuleChange({ ...rule, enabled: !rule.enabled })}
                      style={[
                        styles.togglePill,
                        { backgroundColor: rule.enabled ? withAlpha(meta.color, 0.18) : MD_SURFACES.high },
                      ]}
                    >
                      <RNText
                        style={[
                          styles.toggleLabel,
                          { color: rule.enabled ? meta.color : MD_TEXT_TERTIARY },
                        ]}
                      >
                        {rule.enabled ? 'Enabled' : 'Paused'}
                      </RNText>
                    </Pressable>
                  </View>

                  <View style={styles.ruleFooter}>
                    <View style={styles.ruleStepper}>
                      <Pressable
                        onPress={() => handleRuleChange({ ...rule, threshold: Math.max(1, rule.threshold - 1) })}
                        style={styles.stepperButton}
                      >
                        <RNText style={styles.stepperGlyph}>-</RNText>
                      </Pressable>
                      <RuleThreshold rule={rule} />
                      <Pressable
                        onPress={() => handleRuleChange({ ...rule, threshold: rule.threshold + 1 })}
                        style={styles.stepperButton}
                      >
                        <RNText style={styles.stepperGlyph}>+</RNText>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard padding={20}>
          <SectionHeader title="Alert History" />
          <View style={styles.sectionList}>
            {data.history.length === 0 ? (
              <RNText style={styles.emptyCopy}>
                No caregiver alerts have fired yet. MyMeds will only surface
                alerts here when a configured threshold is crossed.
              </RNText>
            ) : (
              data.history.map((entry) => (
                <View key={entry.id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <RNText style={styles.caregiverName}>{entry.caregiverName}</RNText>
                    <RNText style={styles.historyPill}>{entry.status}</RNText>
                  </View>
                  <RNText style={styles.historyMessage}>{entry.message}</RNText>
                  <RNText style={styles.caregiverMeta}>
                    {entry.alertType.replace('_', ' ')}
                    {entry.medicationName ? ` • ${entry.medicationName}` : ''}
                    {' • '}
                    {new Date(entry.sentAt).toLocaleString()}
                  </RNText>
                </View>
              ))
            )}
          </View>
        </GlassCard>

        <GlassCard padding={20} style={styles.privacyCard}>
          <SectionHeader title="Privacy Note" />
          <RNText style={styles.privacyCopy}>
            Caregivers only see what you explicitly allow. Medication reminders,
            critical thresholds, and summary reports stay local unless a rule
            sends them out.
          </RNText>
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={resetEditor}
        transparent
        visible={editorVisible}
      >
        <Pressable onPress={resetEditor} style={styles.modalScrim}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <RNText style={styles.sheetTitle}>
              {editingId ? 'Edit Caregiver' : 'Add Caregiver'}
            </RNText>

            <View style={styles.sheetFields}>
              <TextInput
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={name}
              />
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhone}
                placeholder="Phone number"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={phone}
              />
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={MD_TEXT_TERTIARY}
                style={styles.input}
                value={email}
              />

              <View style={styles.pillWrap}>
                {RELATIONSHIP_OPTIONS.map((option) => (
                  <Pill
                    key={option}
                    active={relationship === option}
                    color={MD_ACCENT_LIGHT}
                    label={option.replace('_', ' ')}
                    onPress={() => setRelationship(option)}
                  />
                ))}
              </View>

              <Pressable onPress={handleSave} style={styles.saveButton}>
                <RNText style={styles.saveButtonText}>
                  {editingId ? 'Save Changes' : 'Add Caregiver'}
                </RNText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 20,
    paddingBottom: 140,
  },
  errorShell: {
    backgroundColor: MD_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  heroRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  eyebrow: {
    ...MD_TYPOGRAPHY.labelUpper,
    color: MD_ACCENT_LIGHT,
  },
  heroTitle: {
    ...MD_TYPOGRAPHY.displayLg,
    color: MD_TEXT,
    fontSize: 40,
    lineHeight: 44,
  },
  heroBody: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
  },
  heroButton: {
    alignItems: 'center',
    backgroundColor: '#FFDCC0',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroButtonText: {
    color: '#2B1704',
    fontFamily: MD_FONTS.bold,
    fontSize: 13,
  },
  sectionList: {
    gap: 12,
    marginTop: 18,
  },
  emptyCopy: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  caregiverCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 14,
    padding: 14,
  },
  caregiverHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  avatarShell: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.16),
    borderRadius: 20,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarLetter: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 18,
  },
  caregiverCopy: {
    flex: 1,
    gap: 2,
  },
  caregiverName: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.semiBold,
    fontSize: 15,
  },
  caregiverMeta: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 12,
  },
  togglePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  toggleLabel: {
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  actionButtonText: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: MD_FONTS.medium,
    fontSize: 12,
    textTransform: 'capitalize',
  },
  ruleCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 14,
    padding: 14,
  },
  ruleHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  ruleIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  ruleFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  ruleStepper: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  ruleThreshold: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 12,
    minWidth: 74,
    textAlign: 'center',
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: MD_SURFACES.highest,
    borderRadius: 999,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  stepperGlyph: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 16,
    lineHeight: 18,
  },
  historyCard: {
    backgroundColor: MD_SURFACES.low,
    borderRadius: 20,
    gap: 6,
    padding: 14,
  },
  historyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyPill: {
    color: MD_ACCENT_LIGHT,
    fontFamily: MD_FONTS.bold,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  historyMessage: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  privacyCard: {
    backgroundColor: withAlpha(MD_ACCENT, 0.08),
  },
  privacyCopy: {
    color: MD_TEXT_SECONDARY,
    fontFamily: MD_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 18,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: MD_SURFACES.low,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
  },
  sheetHandle: {
    alignSelf: 'center',
    backgroundColor: withAlpha(MD_TEXT_TERTIARY, 0.45),
    borderRadius: 999,
    height: 4,
    marginBottom: 16,
    width: 42,
  },
  sheetTitle: {
    color: MD_TEXT,
    fontFamily: MD_FONTS.bold,
    fontSize: 20,
    marginBottom: 16,
  },
  sheetFields: {
    gap: 12,
  },
  input: {
    backgroundColor: MD_SURFACES.high,
    borderRadius: 18,
    color: MD_TEXT,
    fontFamily: MD_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: MD_ACCENT_LIGHT,
    borderRadius: 18,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: '#001F2A',
    fontFamily: MD_FONTS.bold,
    fontSize: 14,
  },
});
