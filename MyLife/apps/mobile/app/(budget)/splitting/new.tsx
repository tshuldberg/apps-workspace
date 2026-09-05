import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  calculateEqualSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
  createExpenseSplit,
  createSplitParticipant,
  getContacts,
  listEnvelopes,
  validatePercentages,
  validateSplitAmounts,
  type Contact,
  type Envelope,
  type SplitResult,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type SplitMethod = 'equal' | 'percentage' | 'shares' | 'custom';

type ParticipantDescriptor = {
  key: string;
  contactId: string | null;
  isSelf: boolean;
  label: string;
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCents(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}

function toParticipantKey(contactId: string | null): string {
  return contactId ?? 'self';
}

export default function NewSplitScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>('self');
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);
  const [valueInputs, setValueInputs] = useState<Record<string, string>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      setContacts(getContacts(db));
      setEnvelopes(listEnvelopes(db, false));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts or categories.');
    }
  }, [db]);

  const participants = useMemo<ParticipantDescriptor[]>(() => {
    return [
      { key: 'self', contactId: null, isSelf: true, label: 'You' },
      ...selectedContacts
        .map((contactId) => contacts.find((contact) => contact.id === contactId))
        .filter((contact): contact is Contact => Boolean(contact))
        .map((contact) => ({
          key: contact.id,
          contactId: contact.id,
          isSelf: false,
          label: contact.name,
        })),
    ];
  }, [contacts, selectedContacts]);

  const splitPreview = useMemo(() => {
    const totalCents = toCents(amount);
    if (totalCents === null || totalCents <= 0) {
      return { message: 'Enter a total amount to preview the split.', results: [] as SplitResult[] };
    }

    if (participants.length < 2) {
      return { message: 'Select at least one contact besides yourself.', results: [] as SplitResult[] };
    }

    try {
      if (splitMethod === 'equal') {
        return {
          message: null,
          results: calculateEqualSplit(totalCents, participants),
        };
      }

      if (splitMethod === 'percentage') {
        const percentageParticipants = participants.map((participant) => {
          const raw = valueInputs[participant.key];
          const numeric = raw ? Number(raw) : 100 / participants.length;
          return {
            ...participant,
            shareValue: numeric / 100,
          };
        });
        const validation = validatePercentages(
          percentageParticipants.map((participant) => participant.shareValue),
        );
        if (!validation.valid) {
          return {
            message: 'Percentages need to add up to 100%.',
            results: [] as SplitResult[],
          };
        }
        return {
          message: null,
          results: calculatePercentageSplit(totalCents, percentageParticipants),
        };
      }

      if (splitMethod === 'shares') {
        const shareParticipants = participants.map((participant) => ({
          ...participant,
          shareValue: Math.max(0, Number(valueInputs[participant.key] || '1')),
        }));
        if (shareParticipants.some((participant) => participant.shareValue <= 0)) {
          return {
            message: 'Every participant needs at least one share.',
            results: [] as SplitResult[],
          };
        }
        return {
          message: null,
          results: calculateSharesSplit(totalCents, shareParticipants),
        };
      }

      const amounts = participants.map((participant) => toCents(customAmounts[participant.key] || '0') ?? 0);
      const validation = validateSplitAmounts(amounts, totalCents);
      if (!validation.valid) {
        return {
          message: `Custom amounts are off by ${formatCurrency(validation.difference)}.`,
          results: [] as SplitResult[],
        };
      }

      return {
        message: null,
        results: participants.map((participant, index) => ({
          contactId: participant.contactId,
          isSelf: participant.isSelf,
          shareAmount: amounts[index] ?? 0,
        })),
      };
    } catch (err) {
      return {
        message: err instanceof Error ? err.message : 'Unable to calculate split preview.',
        results: [] as SplitResult[],
      };
    }
  }, [amount, customAmounts, participants, splitMethod, valueInputs]);

  const selectedEnvelope = envelopes.find((envelope) => envelope.id === selectedEnvelopeId) ?? null;

  const handleToggleContact = (contactId: string) => {
    setSelectedContacts((current) => {
      const next = current.includes(contactId)
        ? current.filter((value) => value !== contactId)
        : [...current, contactId];

      if (!next.includes(paidBy)) {
        setPaidBy('self');
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (submitting) {
      return;
    }

    const totalCents = toCents(amount);
    if (totalCents === null || totalCents <= 0) {
      setError('Enter a valid total amount.');
      return;
    }
    if (!description.trim()) {
      setError('Add a split description.');
      return;
    }
    if (!splitPreview.results.length || splitPreview.message) {
      setError(splitPreview.message ?? 'Fix the split before saving.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const splitId = uuid();
      createExpenseSplit(db, splitId, {
        date,
        description: description.trim(),
        group_name: selectedEnvelope?.name ?? null,
        paid_by: paidBy,
        split_type: splitMethod === 'custom' ? 'unequal' : splitMethod,
        total_amount: totalCents,
      });

      splitPreview.results.forEach((result) => {
        const key = toParticipantKey(result.contactId);
        const shareValue =
          splitMethod === 'percentage'
            ? Number(valueInputs[key] ?? 0) / 100
            : splitMethod === 'shares'
              ? Number(valueInputs[key] ?? 1)
              : null;

        createSplitParticipant(db, uuid(), {
          contact_id: result.contactId,
          is_self: result.isSelf ? 1 : 0,
          share_amount: result.shareAmount,
          share_value: shareValue,
          split_id: splitId,
        });
      });

      router.replace('/(budget)/splitting' as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save split.');
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.heroCopy}>
        <Text style={styles.sectionEyebrow}>New Split</Text>
        <Text style={styles.heroTitle}>Create a clean split request</Text>
        <Text style={styles.heroSubtitle}>
          Choose the payer, participants, split method, and category before sending it to your
          running balance tracker.
        </Text>
      </View>

      <View style={styles.heroGrid}>
        <GlassCard style={styles.amountCard}>
          <Text style={styles.sectionEyebrow}>Total Amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currencyMark}>$</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.amountInput}
              value={amount}
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.methodCard}>
          <Text style={styles.sectionEyebrow}>Method</Text>
          <View style={styles.methodBadge}>
            <MaterialSymbol color={BG_MONEY} name="handshake" size={18} />
            <Text style={styles.methodBadgeText}>{splitMethod}</Text>
          </View>
        </GlassCard>
      </View>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Details</Text>
        <Text style={styles.sectionTitle}>What is this split for?</Text>
        <TextInput
          onChangeText={setDescription}
          placeholder="Dinner, rent, concert tickets…"
          placeholderTextColor={BG_TEXT_TERTIARY}
          style={styles.textInput}
          value={description}
        />
        <TextInput
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={BG_TEXT_TERTIARY}
          style={styles.textInput}
          value={date}
        />
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Category</Text>
        <Text style={styles.sectionTitle}>Attach the split to a budget category</Text>
        <View style={styles.wrapRow}>
          {envelopes.map((envelope) => (
            <Pressable
              key={envelope.id}
              onPress={() =>
                setSelectedEnvelopeId((current) => (current === envelope.id ? null : envelope.id))
              }
              style={[
                styles.chip,
                selectedEnvelopeId === envelope.id ? styles.chipActive : null,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedEnvelopeId === envelope.id ? styles.chipTextActive : null,
                ]}
              >
                {envelope.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Paid By</Text>
        <Text style={styles.sectionTitle}>Choose who covered the charge</Text>
        <View style={styles.wrapRow}>
          <Pressable
            onPress={() => setPaidBy('self')}
            style={[styles.chip, paidBy === 'self' ? styles.chipActive : null]}
          >
            <Text style={[styles.chipText, paidBy === 'self' ? styles.chipTextActive : null]}>
              You
            </Text>
          </Pressable>
          {selectedContacts
            .map((contactId) => contacts.find((contact) => contact.id === contactId))
            .filter((contact): contact is Contact => Boolean(contact))
            .map((contact) => (
              <Pressable
                key={contact.id}
                onPress={() => setPaidBy(contact.id)}
                style={[styles.chip, paidBy === contact.id ? styles.chipActive : null]}
              >
                <Text
                  style={[styles.chipText, paidBy === contact.id ? styles.chipTextActive : null]}
                >
                  {contact.name}
                </Text>
              </Pressable>
            ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Participants</Text>
        <Text style={styles.sectionTitle}>Select everyone involved</Text>
        <View style={styles.participantGrid}>
          <View style={[styles.participantCard, styles.participantCardSelected]}>
            <View style={[styles.participantAvatar, { backgroundColor: `${BG_MONEY}22` }]}>
              <Text style={styles.participantAvatarText}>🧾</Text>
            </View>
            <Text style={styles.participantName}>You</Text>
            <Text style={styles.participantMeta}>Always included</Text>
          </View>
          {contacts.map((contact) => {
            const selected = selectedContacts.includes(contact.id);
            return (
              <Pressable
                key={contact.id}
                onPress={() => handleToggleContact(contact.id)}
                style={[
                  styles.participantCard,
                  selected ? styles.participantCardSelected : null,
                ]}
              >
                <View
                  style={[
                    styles.participantAvatar,
                    { backgroundColor: `${selected ? BG_ACCENT_LIGHT : BG_TEXT_MUTED}22` },
                  ]}
                >
                  <Text style={styles.participantAvatarText}>{contact.avatar_emoji}</Text>
                </View>
                <Text style={styles.participantName}>{contact.name}</Text>
                <Text style={styles.participantMeta}>{selected ? 'Included' : 'Tap to add'}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionEyebrow}>Split Method</Text>
        <Text style={styles.sectionTitle}>Choose how the total is divided</Text>
        <View style={styles.wrapRow}>
          {(['equal', 'percentage', 'shares', 'custom'] as const).map((method) => (
            <Pressable
              key={method}
              onPress={() => setSplitMethod(method)}
              style={[styles.methodPill, splitMethod === method ? styles.methodPillActive : null]}
            >
              <Text
                style={[
                  styles.methodPillText,
                  splitMethod === method ? styles.methodPillTextActive : null,
                ]}
              >
                {method}
              </Text>
            </Pressable>
          ))}
        </View>

        {splitMethod !== 'equal' ? (
          <View style={styles.editorStack}>
            {participants.map((participant) => {
              const result = splitPreview.results.find((entry) => entry.contactId === participant.contactId);
              const key = participant.key;
              const inputValue =
                splitMethod === 'custom'
                  ? customAmounts[key] ?? ''
                  : valueInputs[key] ?? '';

              return (
                <View key={participant.key} style={styles.editorRow}>
                  <View style={styles.editorLabelWrap}>
                    <Text style={styles.editorLabel}>{participant.label}</Text>
                    <Text style={styles.editorHint}>
                      {splitMethod === 'percentage'
                        ? 'Percent'
                        : splitMethod === 'shares'
                          ? 'Shares'
                          : 'Amount'}
                    </Text>
                  </View>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={(value) => {
                      if (splitMethod === 'custom') {
                        setCustomAmounts((current) => ({ ...current, [key]: value }));
                      } else {
                        setValueInputs((current) => ({ ...current, [key]: value }));
                      }
                    }}
                    placeholder={splitMethod === 'percentage' ? '25' : splitMethod === 'shares' ? '1' : '0.00'}
                    placeholderTextColor={BG_TEXT_TERTIARY}
                    style={styles.editorInput}
                    value={inputValue}
                  />
                  <Text style={styles.editorPreview}>
                    {result ? formatCurrency(result.shareAmount) : '—'}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.equalPreview}>
            {splitPreview.results.map((result) => (
              <View key={toParticipantKey(result.contactId)} style={styles.equalPreviewRow}>
                <Text style={styles.equalPreviewLabel}>
                  {participants.find((participant) => participant.contactId === result.contactId)?.label ?? 'You'}
                </Text>
                <Text style={styles.equalPreviewValue}>{formatCurrency(result.shareAmount)}</Text>
              </View>
            ))}
          </View>
        )}
      </GlassCard>

      <GlassCard style={styles.previewCard}>
        <View style={styles.previewHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Preview</Text>
            <Text style={styles.sectionTitle}>Per-person amount</Text>
          </View>
          <View style={styles.previewBadge}>
            <MaterialSymbol color={BG_MONEY} name="receipt_long" size={18} />
          </View>
        </View>
        {splitPreview.results.length ? (
          <>
            <AmountDisplay
              cents={splitPreview.results[0]?.shareAmount ?? 0}
              size="xl"
              type="income"
            />
            <View style={styles.previewList}>
              {splitPreview.results.map((result) => (
                <View key={toParticipantKey(result.contactId)} style={styles.previewRow}>
                  <Text style={styles.previewLabel}>
                    {participants.find((participant) => participant.contactId === result.contactId)?.label ?? 'You'}
                  </Text>
                  <Text style={styles.previewValue}>{formatCurrency(result.shareAmount)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.previewMessage}>{splitPreview.message}</Text>
        )}
      </GlassCard>

      <Pressable onPress={handleSave} style={styles.saveButton}>
        <Text style={styles.saveButtonText}>{submitting ? 'Saving…' : 'Save Split'}</Text>
        <MaterialSymbol color={BG_SURFACES.lowest} name="arrow_forward" size={18} />
      </Pressable>

      {selectedEnvelope ? (
        <Text style={styles.selectionHint}>Category: {selectedEnvelope.name}</Text>
      ) : null}
      {splitPreview.message && splitPreview.results.length === 0 ? (
        <Text style={styles.errorText}>{splitPreview.message}</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BG_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: 48,
    paddingHorizontal: 20,
    paddingTop: 18,
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
  heroGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  amountCard: {
    flex: 1,
    gap: 10,
  },
  methodCard: {
    gap: 10,
    width: 118,
  },
  amountRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  currencyMark: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.bold,
    fontSize: 28,
    lineHeight: 32,
    marginBottom: 8,
  },
  amountInput: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.1,
    paddingVertical: 0,
  },
  methodBadge: {
    alignItems: 'center',
    backgroundColor: `${BG_MONEY}18`,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  methodBadgeText: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  sectionCard: {
    gap: 14,
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
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
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  chipText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  chipTextActive: {
    color: BG_ACCENT_LIGHT,
  },
  participantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  participantCard: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: 108,
  },
  participantCardSelected: {
    backgroundColor: `${BG_ACCENT}16`,
  },
  participantAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  participantAvatarText: {
    fontSize: 20,
  },
  participantName: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  participantMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  methodPill: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  methodPillActive: {
    backgroundColor: `${BG_MONEY}22`,
  },
  methodPillText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  methodPillTextActive: {
    color: BG_MONEY,
  },
  editorStack: {
    gap: 10,
  },
  editorRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editorLabelWrap: {
    flex: 1,
    gap: 4,
  },
  editorLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  editorHint: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  editorInput: {
    backgroundColor: BG_SURFACES.base,
    borderRadius: 14,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
  editorPreview: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    minWidth: 72,
    textAlign: 'right',
  },
  equalPreview: {
    gap: 8,
  },
  equalPreviewRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  equalPreviewLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  equalPreviewValue: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  previewCard: {
    gap: 12,
  },
  previewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewBadge: {
    alignItems: 'center',
    backgroundColor: `${BG_MONEY}18`,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  previewList: {
    gap: 8,
  },
  previewRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  previewValue: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  previewMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  saveButtonText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  selectionHint: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
