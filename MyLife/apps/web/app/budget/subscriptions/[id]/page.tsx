import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  addCancellationAction,
  editSubscription,
  fetchSubscriptionById,
  fetchSubscriptionCancellationActions,
  fetchSubscriptionLifetimeCost,
  fetchSubscriptionPriceHistory,
} from '../../actions';
import { BudgetLineChart } from '../../charts';
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
  BudgetTextArea,
} from '../../primitives';
import { nullableField, parseCurrencyField, stringField, subscriptionMonthlyCost } from '../../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate, relativeBudgetDate } from '../../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetSubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subscriptionRecord = await fetchSubscriptionById(id);

  if (!subscriptionRecord) {
    notFound();
  }
  const subscription = subscriptionRecord;

  const [cancellationActions, lifetimeCost, priceHistory] = await Promise.all([
    fetchSubscriptionCancellationActions(subscription.id),
    fetchSubscriptionLifetimeCost(subscription.id),
    fetchSubscriptionPriceHistory(subscription.id),
  ]);

  async function logCancellationAction(formData: FormData) {
    'use server';

    await addCancellationAction({
      action: stringField(formData, 'action') as 'cancelled' | 'dismissed' | 'downgraded' | 'kept' | 'reminded',
      notes: nullableField(formData, 'notes'),
      savingsAmount: parseCurrencyField(formData, 'savings_amount'),
      subscriptionId: subscription.id,
    });
    redirect(`/budget/subscriptions/${subscription.id}`);
  }

  async function updateSubscriptionAction(formData: FormData) {
    'use server';

    const startDate = stringField(formData, 'start_date') || subscription.start_date;
    const nextRenewal = stringField(formData, 'next_renewal') || subscription.next_renewal;
    await editSubscription(subscription.id, {
      billing_cycle: stringField(formData, 'billing_cycle') as 'annual' | 'custom' | 'monthly' | 'quarterly' | 'semi_annual' | 'weekly',
      next_renewal: nextRenewal,
      notes: nullableField(formData, 'notes'),
      price: parseCurrencyField(formData, 'price'),
      start_date: startDate,
      status: stringField(formData, 'status') as 'active' | 'cancelled' | 'paused' | 'trial',
      url: nullableField(formData, 'url'),
    });
    redirect(`/budget/subscriptions/${subscription.id}`);
  }

  return (
    <BudgetPage maxWidth={1280}>
      <BudgetHero
        actions={
          <>
            <Link href="/budget/subscriptions" style={buttonStyle('ghost')}>
              All Subscriptions
            </Link>
            {subscription.url ? (
              <Link href={subscription.url} style={buttonStyle('secondary')}>
                Open Provider
              </Link>
            ) : null}
          </>
        }
        description={`Started ${formatBudgetDate(subscription.start_date)}. This desktop detail route mirrors the mobile cancellation assist and price history workflow.`}
        eyebrow="Subscription Detail"
        title={subscription.name}
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Current Price" subvalue={subscription.billing_cycle.replace(/_/g, ' ')} tone="money" value={formatBudgetCurrency(subscription.price)} />
          <BudgetMetricCard label="Monthly Equivalent" subvalue={`Status ${subscription.status}`} tone="accent" value={formatBudgetCurrency(subscriptionMonthlyCost(subscription))} />
          <BudgetMetricCard label="Next Renewal" subvalue={relativeBudgetDate(subscription.next_renewal)} tone="info" value={formatBudgetDate(subscription.next_renewal)} />
          <BudgetMetricCard label="Lifetime Cost" subvalue={`${priceHistory.length} price changes`} tone="danger" value={formatBudgetCurrency(lifetimeCost)} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Track pricing over time." title="Price History">
              <BudgetLineChart
                data={
                  priceHistory.length > 0
                    ? priceHistory.map((entry) => ({
                        label: formatBudgetDate(entry.effective_date, { month: 'short' }),
                        value: entry.price,
                      }))
                    : [{ label: 'Current', value: subscription.price }]
                }
              />
              <BudgetTable
                columns={['Effective', 'Price']}
                rows={
                  priceHistory.length > 0
                    ? priceHistory.map((entry) => [formatBudgetDate(entry.effective_date), formatBudgetCurrency(entry.price)])
                    : [[formatBudgetDate(subscription.start_date), formatBudgetCurrency(subscription.price)]]
                }
              />
            </BudgetPanel>

            <BudgetPanel description="Cancellation assist actions logged from desktop." title="Cancellation Log">
              <BudgetTable
                columns={['Date', 'Action', 'Savings', 'Notes']}
                rows={
                  cancellationActions.length > 0
                    ? cancellationActions.map((entry) => [
                        formatBudgetDate(entry.acted_on),
                        entry.action,
                        formatBudgetCurrency(entry.savings_amount ?? 0),
                        entry.notes ?? 'None',
                      ])
                    : [['No actions yet', 'Pending', formatBudgetCurrency(0), 'Track outreach, reminders, or downgrades here.']]
                }
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={logCancellationAction} description="Log reminders, downgrades, and cancellations from desktop." title="Log Action">
              <BudgetFormGrid>
                <BudgetField label="Action">
                  <BudgetSelect defaultValue="reminded" name="action">
                    <option value="reminded">Reminded</option>
                    <option value="downgraded">Downgraded</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="dismissed">Dismissed</option>
                    <option value="kept">Kept</option>
                  </BudgetSelect>
                </BudgetField>
                <BudgetField label="Savings Amount">
                  <BudgetInput defaultValue="0" min="0" name="savings_amount" step="0.01" type="number" />
                </BudgetField>
              </BudgetFormGrid>
              <BudgetField label="Notes">
                <BudgetTextArea name="notes" placeholder="Called support, accepted annual downgrade..." />
              </BudgetField>
              <button style={buttonStyle('primary')} type="submit">
                Save Action
              </button>
            </BudgetForm>

            <BudgetForm action={updateSubscriptionAction} description="Edit the core subscription details." title="Edit Subscription">
              <BudgetFormGrid>
                <BudgetField label="Price">
                  <BudgetInput defaultValue={String(subscription.price / 100)} min="0" name="price" step="0.01" type="number" />
                </BudgetField>
                <BudgetField label="Billing Cycle">
                  <BudgetInput defaultValue={subscription.billing_cycle} name="billing_cycle" />
                </BudgetField>
                <BudgetField label="Status">
                  <BudgetInput defaultValue={subscription.status} name="status" />
                </BudgetField>
                <BudgetField label="Next Renewal">
                  <BudgetInput defaultValue={subscription.next_renewal} name="next_renewal" type="date" />
                </BudgetField>
              </BudgetFormGrid>
              <BudgetField label="Start Date">
                <BudgetInput defaultValue={subscription.start_date} name="start_date" type="date" />
              </BudgetField>
              <BudgetField label="URL">
                <BudgetInput defaultValue={subscription.url ?? ''} name="url" />
              </BudgetField>
              <BudgetField label="Notes">
                <BudgetTextArea defaultValue={subscription.notes ?? ''} name="notes" />
              </BudgetField>
              <button style={buttonStyle('secondary')} type="submit">
                Update Subscription
              </button>
            </BudgetForm>
          </>
        }
      />
    </BudgetPage>
  );
}
