import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AddFAB,
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
  calculateBalances,
  createContact,
  createSettlement,
  getContacts,
  getExpenseSplits,
  getSettlementsByContact,
  getSplitParticipants,
  type BalanceSummary,
  type Contact,
  type ExpenseSplit,
  type Settlement,
  type SplitParticipant,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type SplitFilter = 'all' | 'active' | 'settled';
type SettlementDirection = 'they_paid' | 'you_paid';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function toAmountInput(cents: number): string {
  return (Math.abs(cents) / 100).toFixed(2);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SplittingScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [splits, setSplits] = useState<ExpenseSplit[]>([]);
  const [participantsBySplit, setParticipantsBySplit] = useState<Record<string, SplitParticipant[]>>({});
  const [settlementsByContact, setSettlementsByContact] = useState<Record<string, Settlement[]>>({});
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<SplitFilter>('all');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDirection, setSettleDirection] = useState<SettlementDirection>('they_paid');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nextContacts = getContacts(db);
      const nextSplits = getExpenseSplits(db);
      const nextParticipants: Record<string, SplitParticipant[]> = {};
      const nextSettlements: Record<string, Settlement[]> = {};
      const contactNames = new Map(nextContacts.map((contact) => [contact.id, contact.name]));

      nextSplits.forEach((split) => {
        nextParticipants[split.id] = getSplitParticipants(db, split.id);
      });

      const allSettlements: Array<{ contactId: string; amount: number }> = [];
      nextContacts.forEach((contact) => {
        const contactSettlements = getSettlementsByContact(db, contact.id);
        nextSettlements[contact.id] = contactSettlements;
        contactSettlements.forEach((settlement) => {
          allSettlements.push({
            amount: settlement.amount,
            contactId: settlement.contact_id,
          });
        });
      });

      const nextBalanceSummary = calculateBalances(
        nextSplits.map((split) => ({
          isSettled: split.is_settled === 1,
          paidBy: split.paid_by,
          participants: (nextParticipants[split.id] ?? []).map((participant) => ({
            contactId: participant.contact_id,
            isSelf: participant.is_self === 1,
            shareAmount: participant.share_amount,
          })),
        })),
        allSettlements,
        contactNames,
      );

      setContacts(nextContacts);
      setSplits(nextSplits);
      setParticipantsBySplit(nextParticipants);
      setSettlementsByContact(nextSettlements);
      setBalanceSummary(nextBalanceSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load splits.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const contactMetrics = useMemo(() => {
    const balanceMap = new Map(
      (balanceSummary?.entries ?? []).map((entry) => [entry.contactId, entry.netBalance]),
    );

    return contacts.map((contact) => {
      const relatedSplits = splits.filter((split) => {
        const participants = participantsBySplit[split.id] ?? [];
        return (
          split.paid_by === contact.id ||
          participants.some((participant) => participant.contact_id === contact.id)
        );
      });

      const openSplits = relatedSplits.filter((split) => split.is_settled === 0);
      const settledSplits = relatedSplits.filter((split) => split.is_settled === 1);
      const settlements = settlementsByContact[contact.id] ?? [];
      const netBalance = balanceMap.get(contact.id) ?? 0;

      return {
        contact,
        netBalance,
        openSplits,
        recentSettlements: settlements.slice(0, 3),
        relatedSplits,
        settledSplits,
      };
    });
  }, [balanceSummary?.entries, contacts, participantsBySplit, settlementsByContact, splits]);

  const visibleContacts = useMemo(() => {
    return contactMetrics.filter((metric) => {
      if (selectedFilter === 'active') {
        return metric.netBalance !== 0 || metric.openSplits.length > 0;
      }
      if (selectedFilter === 'settled') {
        return metric.netBalance === 0 && (metric.settledSplits.length > 0 || metric.recentSettlements.length > 0);
      }
      return true;
    });
  }, [contactMetrics, selectedFilter]);

  const visibleSplits = useMemo(() => {
    return splits.filter((split) => {
      if (selectedFilter === 'active') {
        return split.is_settled === 0;
      }
      if (selectedFilter === 'settled') {
        return split.is_settled === 1;
      }
      return true;
    });
  }, [selectedFilter, splits]);

  const expandedMetric = contactMetrics.find((metric) => metric.contact.id === expandedContactId) ?? null;

  const handleExpandContact = useCallback((contactId: string) => {
    setExpandedContactId((current) => {
      const next = current === contactId ? null : contactId;
      return next;
    });
  }, []);

  useEffect(() => {
    if (!expandedMetric) {
      return;
    }

    setSettleAmount(toAmountInput(expandedMetric.netBalance === 0 ? 0 : expandedMetric.netBalance));
    setSettleDirection(expandedMetric.netBalance >= 0 ? 'they_paid' : 'you_paid');
  }, [expandedMetric]);

  const handleAddContact = useCallback(() => {
    const name = newName.trim();
    if (!name) {
      setError('Enter a contact name.');
      return;
    }

    try {
      createContact(db, uuid(), {
        email: newEmail.trim() || null,
        name,
        phone: newPhone.trim() || null,
      });
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact.');
    }
  }, [db, load, newEmail, newName, newPhone]);

  const handleSettlement = useCallback(() => {
    if (!expandedMetric) {
      return;
    }

    const rawAmount = Math.round(Number(settleAmount) * 100);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      setError('Enter a valid settlement amount.');
      return;
    }

    try {
      const signedAmount = settleDirection === 'they_paid' ? rawAmount : -rawAmount;
      createSettlement(db, uuid(), {
        amount: signedAmount,
        contact_id: expandedMetric.contact.id,
        note: 'Recorded from split dashboard',
        settled_at: todayISO(),
      });

      if (Math.abs(rawAmount) >= Math.abs(expandedMetric.netBalance) && expandedMetric.openSplits.length > 0) {
        const now = new Date().toISOString();
        expandedMetric.openSplits.forEach((split) => {
          db.execute(
            'UPDATE bg_expense_splits SET is_settled = 1, updated_at = ? WHERE id = ?',
            [now, split.id],
          );
        });
      }

      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record settlement.');
    }
  }, [db, expandedMetric, load, settleAmount, settleDirection]);

  const heroTone = (balanceSummary?.netBalance ?? 0) >= 0 ? BG_MONEY : '#FFB4AB';

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <MaterialSymbol color={BG_ACCENT_LIGHT} name="handshake" size={22} />
        <Text style={styles.loadingCopy}>Loading split balances…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <View style={styles.heroCopy}>
          <Text style={styles.sectionEyebrow}>Splits</Text>
          <Text style={styles.heroTitle}>Track what friends owe and what you owe back</Text>
          <Text style={styles.heroSubtitle}>
            Keep running balances visible, jump into contact detail, and settle a full round in a
            few taps.
          </Text>
        </View>

        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Net Balance</Text>
              <Text style={styles.balanceHeadline}>
                {(balanceSummary?.netBalance ?? 0) >= 0 ? 'Owed to you' : 'You owe'}
              </Text>
            </View>
            <View style={[styles.heroBadge, { backgroundColor: `${heroTone}22` }]}>
              <MaterialSymbol color={heroTone} name="handshake" size={18} />
            </View>
          </View>

          <Text style={[styles.balanceValue, { color: heroTone }]}>
            {formatCurrency(balanceSummary?.netBalance ?? 0)}
          </Text>

          <View style={styles.balanceStatRow}>
            <BalanceStat label="They owe you" value={formatCurrency(balanceSummary?.totalOwedToYou ?? 0)} />
            <BalanceStat label="You owe" value={formatCurrency(balanceSummary?.totalYouOwe ?? 0)} />
          </View>
        </GlassCard>

        <View style={styles.segmentedRow}>
          {(['all', 'active', 'settled'] as const).map((filter) => (
            <Pressable
              key={filter}
              onPress={() => setSelectedFilter(filter)}
              style={[
                styles.segmentedPill,
                selectedFilter === filter ? styles.segmentedPillActive : null,
              ]}
            >
              <Text
                style={[
                  styles.segmentedText,
                  selectedFilter === filter ? styles.segmentedTextActive : null,
                ]}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </View>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Contacts</Text>
          <Text style={styles.sectionTitle}>Running balances by person</Text>
          <View style={styles.stack}>
            {visibleContacts.length ? (
              visibleContacts.map((metric) => {
                const expanded = expandedContactId === metric.contact.id;
                const tone = metric.netBalance > 0 ? BG_MONEY : metric.netBalance < 0 ? '#FFB4AB' : BG_TEXT_MUTED;
                return (
                  <View key={metric.contact.id} style={styles.contactCard}>
                    <Pressable onPress={() => handleExpandContact(metric.contact.id)} style={styles.contactRow}>
                      <View style={styles.contactIdentity}>
                        <View style={[styles.contactAvatar, { backgroundColor: `${tone}22` }]}>
                          <Text style={styles.contactAvatarText}>{metric.contact.avatar_emoji}</Text>
                        </View>
                        <View style={styles.contactCopy}>
                          <Text style={styles.contactName}>{metric.contact.name}</Text>
                          <Text style={styles.contactMeta}>
                            {metric.openSplits.length} active • {metric.settledSplits.length} settled
                          </Text>
                        </View>
                      </View>

                      <View style={styles.contactRight}>
                        <Text style={[styles.contactBalance, { color: tone }]}>
                          {metric.netBalance > 0
                            ? `+${formatCurrency(metric.netBalance)}`
                            : formatCurrency(metric.netBalance)}
                        </Text>
                        <Text style={styles.contactHint}>
                          {metric.netBalance > 0
                            ? 'owes you'
                            : metric.netBalance < 0
                              ? 'you owe'
                              : 'settled'}
                        </Text>
                      </View>
                    </Pressable>

                    <View style={styles.contactActionRow}>
                      <Pressable
                        onPress={() => handleExpandContact(metric.contact.id)}
                        style={styles.inlineAction}
                      >
                        <Text style={styles.inlineActionText}>
                          {expanded ? 'Hide detail' : 'View history'}
                        </Text>
                      </Pressable>
                      {metric.netBalance !== 0 ? (
                        <Pressable
                          onPress={() => handleExpandContact(metric.contact.id)}
                          style={styles.settleAction}
                        >
                          <Text style={styles.settleActionText}>Settle Up</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {expanded ? (
                      <View style={styles.expandedPanel}>
                        <Text style={styles.panelTitle}>Contact detail</Text>
                        <View style={styles.detailChips}>
                          <DetailChip
                            label="Open"
                            value={String(metric.openSplits.length)}
                          />
                          <DetailChip
                            label="Settlements"
                            value={String(metric.recentSettlements.length)}
                          />
                          <DetailChip
                            label="Net"
                            value={formatCurrency(metric.netBalance)}
                          />
                        </View>

                        {metric.netBalance !== 0 ? (
                          <View style={styles.settlementPanel}>
                            <Text style={styles.panelSubheading}>Record settlement</Text>
                            <TextInput
                              keyboardType="decimal-pad"
                              onChangeText={setSettleAmount}
                              placeholder="0.00"
                              placeholderTextColor={BG_TEXT_TERTIARY}
                              style={styles.textInput}
                              value={settleAmount}
                            />
                            <View style={styles.directionRow}>
                              <Pressable
                                onPress={() => setSettleDirection('they_paid')}
                                style={[
                                  styles.directionPill,
                                  settleDirection === 'they_paid' ? styles.directionPillActive : null,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.directionPillText,
                                    settleDirection === 'they_paid' ? styles.directionPillTextActive : null,
                                  ]}
                                >
                                  They paid you
                                </Text>
                              </Pressable>
                              <Pressable
                                onPress={() => setSettleDirection('you_paid')}
                                style={[
                                  styles.directionPill,
                                  settleDirection === 'you_paid' ? styles.directionPillActive : null,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.directionPillText,
                                    settleDirection === 'you_paid' ? styles.directionPillTextActive : null,
                                  ]}
                                >
                                  You paid them
                                </Text>
                              </Pressable>
                            </View>
                            <Pressable onPress={handleSettlement} style={styles.primaryButton}>
                              <Text style={styles.primaryButtonText}>Record Settlement</Text>
                            </Pressable>
                          </View>
                        ) : null}

                        <View style={styles.historyBlock}>
                          <Text style={styles.panelSubheading}>Recent splits</Text>
                          {metric.relatedSplits.length ? (
                            metric.relatedSplits.slice(0, 4).map((split) => (
                              <View key={split.id} style={styles.historyRow}>
                                <View>
                                  <Text style={styles.historyTitle}>{split.description}</Text>
                                  <Text style={styles.historyMeta}>
                                    {split.group_name ?? 'Split'} • {split.date}
                                  </Text>
                                </View>
                                <Text
                                  style={[
                                    styles.historyAmount,
                                    { color: split.is_settled === 1 ? BG_TEXT_MUTED : BG_ACCENT_LIGHT },
                                  ]}
                                >
                                  {formatCurrency(split.total_amount)}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.emptyCopy}>No split history yet.</Text>
                          )}
                        </View>

                        <View style={styles.historyBlock}>
                          <Text style={styles.panelSubheading}>Settlement history</Text>
                          {metric.recentSettlements.length ? (
                            metric.recentSettlements.map((settlement) => (
                              <View key={settlement.id} style={styles.historyRow}>
                                <View>
                                  <Text style={styles.historyTitle}>
                                    {settlement.amount >= 0 ? 'Received' : 'Paid'}
                                  </Text>
                                  <Text style={styles.historyMeta}>{settlement.settled_at}</Text>
                                </View>
                                <Text
                                  style={[
                                    styles.historyAmount,
                                    { color: settlement.amount >= 0 ? BG_MONEY : '#FFB4AB' },
                                  ]}
                                >
                                  {formatCurrency(settlement.amount)}
                                </Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.emptyCopy}>No settlements recorded.</Text>
                          )}
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.emptyCopy}>No contacts match this view yet.</Text>
            )}
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Recent Splits</Text>
          <Text style={styles.sectionTitle}>Active and settled requests</Text>
          <View style={styles.stack}>
            {visibleSplits.length ? (
              visibleSplits.slice(0, 6).map((split) => (
                <View key={split.id} style={styles.splitCard}>
                  <View style={styles.splitTopRow}>
                    <View style={styles.splitBadge}>
                      <MaterialSymbol
                        color={split.is_settled === 1 ? BG_TEXT_MUTED : BG_ACCENT_LIGHT}
                        name={split.is_settled === 1 ? 'check_circle' : 'handshake'}
                        size={18}
                      />
                    </View>
                    <Text style={styles.splitStatus}>
                      {split.is_settled === 1 ? 'Settled' : 'Active'}
                    </Text>
                  </View>
                  <Text style={styles.splitTitle}>{split.description}</Text>
                  <Text style={styles.splitMeta}>
                    {split.group_name ?? 'General'} • {split.date}
                  </Text>
                  <Text style={styles.splitAmount}>{formatCurrency(split.total_amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyCopy}>No split requests in this state.</Text>
            )}
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>Add Contact</Text>
          <Text style={styles.sectionTitle}>Build a reusable split roster</Text>
          <View style={styles.formStack}>
            <TextInput
              onChangeText={setNewName}
              placeholder="Name"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.textInput}
              value={newName}
            />
            <TextInput
              keyboardType="email-address"
              onChangeText={setNewEmail}
              placeholder="Email (optional)"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.textInput}
              value={newEmail}
            />
            <TextInput
              keyboardType="phone-pad"
              onChangeText={setNewPhone}
              placeholder="Phone (optional)"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.textInput}
              value={newPhone}
            />
            <Pressable onPress={handleAddContact} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Add Contact</Text>
            </Pressable>
          </View>
        </GlassCard>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>

      <AddFAB label="New Split" onPress={() => router.push('/(budget)/splitting/new' as never)} />
    </View>
  );
}

function BalanceStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.balanceStat}>
      <Text style={styles.balanceStatValue}>{value}</Text>
      <Text style={styles.balanceStatLabel}>{label}</Text>
    </View>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailChip}>
      <Text style={styles.detailChipLabel}>{label}</Text>
      <Text style={styles.detailChipValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: BG_SURFACES.base,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: 144,
    paddingHorizontal: 20,
    paddingTop: 18,
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
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
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
    gap: 18,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroBadge: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  balanceHeadline: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 22,
    lineHeight: 26,
  },
  balanceValue: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.1,
  },
  balanceStatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  balanceStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  balanceStatValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  balanceStatLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 10,
  },
  segmentedPill: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  segmentedPillActive: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  segmentedText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'capitalize',
  },
  segmentedTextActive: {
    color: BG_ACCENT_LIGHT,
  },
  sectionCard: {
    gap: 16,
  },
  stack: {
    gap: 12,
  },
  contactCard: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 22,
    gap: 12,
    padding: 14,
  },
  contactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  contactIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    flex: 1,
    gap: 12,
  },
  contactAvatar: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  contactAvatarText: {
    fontSize: 20,
  },
  contactCopy: {
    flex: 1,
    gap: 4,
  },
  contactName: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  contactMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  contactRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  contactBalance: {
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  contactHint: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  contactActionRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  inlineAction: {
    paddingVertical: 2,
  },
  inlineActionText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  settleAction: {
    backgroundColor: `${BG_MONEY}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settleActionText: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  expandedPanel: {
    gap: 14,
  },
  panelTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  panelSubheading: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 17,
  },
  detailChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailChip: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    gap: 4,
    minWidth: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailChipLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailChipValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  settlementPanel: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    gap: 10,
    padding: 12,
  },
  textInput: {
    backgroundColor: BG_SURFACES.base,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  directionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  directionPill: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  directionPillActive: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  directionPillText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  directionPillTextActive: {
    color: BG_ACCENT_LIGHT,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  historyBlock: {
    gap: 8,
  },
  historyRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  historyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  historyMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  historyAmount: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 17,
  },
  splitCard: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 20,
    gap: 10,
    padding: 14,
  },
  splitTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitBadge: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  splitStatus: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  splitTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  splitMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  splitAmount: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  formStack: {
    gap: 10,
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
  emptyCopy: {
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
});
