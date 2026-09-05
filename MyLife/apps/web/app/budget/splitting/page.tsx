import { redirect } from 'next/navigation';
import { calculateBalances, calculateEqualSplit } from '@mylife/budget';
import {
  addContact,
  addExpenseSplit,
  addSettlement,
  addSplitParticipant,
  fetchContacts,
  fetchExpenseSplits,
  fetchSettlementsByContact,
  fetchSplitParticipants,
} from '../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetSelect,
  BudgetTable,
} from '../primitives';
import { nullableField, parseCurrencyField, stringField, todayIso } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetSplittingPage() {
  const [contacts, splits] = await Promise.all([fetchContacts(), fetchExpenseSplits()]);
  const participantEntries = await Promise.all(
    splits.map(async (split) => [split.id, await fetchSplitParticipants(split.id)] as const),
  );
  const participantsBySplit = new Map(participantEntries);
  const settlementEntries = await Promise.all(
    contacts.map(async (contact) => [contact.id, await fetchSettlementsByContact(contact.id)] as const),
  );
  const settlementMap = new Map(settlementEntries);
  const balances = calculateBalances(
    splits.map((split) => ({
      isSettled: split.is_settled === 1,
      paidBy: split.paid_by,
      participants: (participantsBySplit.get(split.id) ?? []).map((participant) => ({
        contactId: participant.contact_id,
        isSelf: participant.is_self === 1,
        shareAmount: participant.share_amount,
      })),
    })),
    settlementEntries.flatMap(([, settlements]) => settlements.map((settlement) => ({
      amount: settlement.amount,
      contactId: settlement.contact_id,
    }))),
    new Map(contacts.map((contact) => [contact.id, contact.name])),
  );

  async function addContactAction(formData: FormData) {
    'use server';

    await addContact({
      avatar_emoji: stringField(formData, 'avatar_emoji') || '👤',
      email: nullableField(formData, 'email'),
      name: stringField(formData, 'name'),
      notes: nullableField(formData, 'notes'),
      phone: nullableField(formData, 'phone'),
    });
    redirect('/budget/splitting');
  }

  async function addSplitAction(formData: FormData) {
    'use server';

    const contactId = stringField(formData, 'contact_id');
    const amount = parseCurrencyField(formData, 'total_amount');
    const split = await addExpenseSplit({
      date: stringField(formData, 'date') || todayIso(),
      description: stringField(formData, 'description'),
      group_name: nullableField(formData, 'group_name'),
      paid_by: 'self',
      split_type: 'equal',
      total_amount: amount,
    });

    const shares = calculateEqualSplit(amount, [
      { contactId: null, isSelf: true },
      { contactId, isSelf: false },
    ]);

    await addSplitParticipant({
      contact_id: null,
      is_self: 1,
      share_amount: shares[0].shareAmount,
      split_id: split.id,
    });
    await addSplitParticipant({
      contact_id: contactId,
      is_self: 0,
      share_amount: shares[1].shareAmount,
      split_id: split.id,
    });
    redirect('/budget/splitting');
  }

  async function addSettlementAction(formData: FormData) {
    'use server';

    await addSettlement({
      amount: parseCurrencyField(formData, 'amount'),
      contact_id: stringField(formData, 'contact_id'),
      note: nullableField(formData, 'note'),
      settled_at: stringField(formData, 'settled_at') || todayIso(),
    });
    redirect('/budget/splitting');
  }

  return (
    <BudgetPage>
      <BudgetHero
        description="Expense splitting parity with shared balances, open splits, and settlement tracking."
        eyebrow="Splitting"
        title="Expense Splitting"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Contacts" subvalue="People you split with" tone="accent" value={contacts.length} />
          <BudgetMetricCard label="Open Splits" subvalue="Unsettled expense rows" tone="info" value={splits.filter((split) => split.is_settled === 0).length} />
          <BudgetMetricCard label="Owed To You" subvalue="Net contact balance" tone="money" value={formatBudgetCurrency(balances.totalOwedToYou)} />
          <BudgetMetricCard label="You Owe" subvalue="Net contact balance" tone="danger" value={formatBudgetCurrency(balances.totalYouOwe)} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Net balances per contact." title="Balances">
              <BudgetTable
                columns={['Contact', 'Net Balance', 'Settlements']}
                rows={balances.entries.length > 0
                  ? balances.entries.map((entry) => [
                      entry.contactName,
                      formatBudgetCurrency(entry.netBalance, { signed: true }),
                      settlementMap.get(entry.contactId)?.length ?? 0,
                    ])
                  : [['No balances yet', formatBudgetCurrency(0), 0]]}
              />
            </BudgetPanel>

            <BudgetPanel description="Tracked splits and participants." title="Open Splits">
              <BudgetTable
                columns={['Description', 'Date', 'Amount', 'Participants']}
                rows={splits.map((split) => [
                  split.description,
                  split.date,
                  formatBudgetCurrency(split.total_amount),
                  (participantsBySplit.get(split.id) ?? []).length,
                ])}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={addContactAction} title="Add Contact">
              <BudgetFormGrid>
                <BudgetField label="Name">
                  <BudgetInput name="name" required />
                </BudgetField>
                <BudgetField label="Avatar">
                  <BudgetInput name="avatar_emoji" placeholder="👤" />
                </BudgetField>
                <BudgetField label="Email">
                  <BudgetInput name="email" type="email" />
                </BudgetField>
                <BudgetField label="Phone">
                  <BudgetInput name="phone" />
                </BudgetField>
              </BudgetFormGrid>
              <BudgetField label="Notes">
                <BudgetInput name="notes" />
              </BudgetField>
              <button style={buttonStyle('primary')} type="submit">
                Save Contact
              </button>
            </BudgetForm>

            <BudgetForm action={addSplitAction} title="Add Split">
              <BudgetFormGrid>
                <BudgetField label="Description">
                  <BudgetInput name="description" required />
                </BudgetField>
                <BudgetField label="Amount">
                  <BudgetInput min="0" name="total_amount" required step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Contact">
                  <BudgetSelect defaultValue={contacts[0]?.id} name="contact_id" required>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </BudgetSelect>
                </BudgetField>
                <BudgetField label="Date">
                  <BudgetInput defaultValue={todayIso()} name="date" type="date" />
                </BudgetField>
              </BudgetFormGrid>
              <BudgetField label="Group">
                <BudgetInput name="group_name" placeholder="Trip, rent, dinner..." />
              </BudgetField>
              <button style={buttonStyle('secondary')} type="submit">
                Create Split
              </button>
            </BudgetForm>

            <BudgetForm action={addSettlementAction} title="Record Settlement">
              <BudgetFormGrid>
                <BudgetField label="Contact">
                  <BudgetSelect defaultValue={contacts[0]?.id} name="contact_id" required>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </BudgetSelect>
                </BudgetField>
                <BudgetField label="Amount">
                  <BudgetInput min="0" name="amount" required step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Settled At">
                  <BudgetInput defaultValue={todayIso()} name="settled_at" type="date" />
                </BudgetField>
              </BudgetFormGrid>
              <BudgetField label="Note">
                <BudgetInput name="note" />
              </BudgetField>
              <button style={buttonStyle('ghost')} type="submit">
                Save Settlement
              </button>
            </BudgetForm>
          </>
        }
      />
    </BudgetPage>
  );
}
