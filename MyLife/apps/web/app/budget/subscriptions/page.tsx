import Link from 'next/link';
import { redirect } from 'next/navigation';
import { addSubscription, editSubscription, fetchSubscriptions, fetchUpcomingSubscriptionRenewals } from '../actions';
import { BudgetDonutChart } from '../charts';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetRow,
  BudgetSelect,
  BudgetSubmitRow,
  BudgetTonePill,
} from '../primitives';
import { nullableField, parseCurrencyField, stringField, subscriptionMonthlyCost, todayIso } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetDate, relativeBudgetDate } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetSubscriptionsPage() {
  const [subscriptions, upcoming] = await Promise.all([
    fetchSubscriptions(),
    fetchUpcomingSubscriptionRenewals(8),
  ]);

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active' || subscription.status === 'trial');
  const monthlyTotal = activeSubscriptions.reduce((sum, subscription) => sum + subscriptionMonthlyCost(subscription), 0);
  const annualTotal = monthlyTotal * 12;
  const statusMix = ['active', 'trial', 'paused', 'cancelled'].map((status) => ({
    label: status,
    value: subscriptions.filter((subscription) => subscription.status === status).length,
  }));

  async function createSubscriptionAction(formData: FormData) {
    'use server';

    const startDate = stringField(formData, 'start_date') || todayIso();
    await addSubscription({
      billing_cycle: stringField(formData, 'billing_cycle') as 'annual' | 'custom' | 'monthly' | 'quarterly' | 'semi_annual' | 'weekly',
      custom_days: Number(formData.get('custom_days') ?? 0) || null,
      name: stringField(formData, 'name'),
      next_renewal: stringField(formData, 'next_renewal') || startDate,
      notes: nullableField(formData, 'notes'),
      price: parseCurrencyField(formData, 'price'),
      start_date: startDate,
      status: stringField(formData, 'status') as 'active' | 'cancelled' | 'paused' | 'trial',
      url: nullableField(formData, 'url'),
    });
    redirect('/budget/subscriptions');
  }

  async function changeStatusAction(formData: FormData) {
    'use server';

    await editSubscription(stringField(formData, 'subscription_id'), {
      status: stringField(formData, 'next_status') as 'active' | 'cancelled' | 'paused' | 'trial',
    });
    redirect('/budget/subscriptions');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={<Link href="/budget/reports" style={buttonStyle('ghost')}>Reports</Link>}
        description="Recurring spend parity for desktop with renewal monitoring, quick pause/cancel actions, and a calendar-ready renewal queue."
        eyebrow="Subscriptions"
        title="Recurring Spend"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Monthly Cost" subvalue={`${activeSubscriptions.length} active or trial`} tone="money" value={formatBudgetCurrency(monthlyTotal)} />
          <BudgetMetricCard label="Annual Run Rate" subvalue="Projected recurring spend" tone="danger" value={formatBudgetCurrency(annualTotal)} />
          <BudgetMetricCard label="Next Renewal" subvalue={upcoming[0] ? formatBudgetDate(upcoming[0].next_renewal) : 'No renewals queued'} tone="info" value={upcoming[0]?.name ?? 'None'} />
          <BudgetMetricCard label="Paused or Cancelled" subvalue="Dormant services" tone="accent" value={subscriptions.filter((subscription) => subscription.status !== 'active' && subscription.status !== 'trial').length} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Status mix across the full subscription catalog." title="Portfolio Mix">
              <BudgetDonutChart data={statusMix} emptyLabel="No subscriptions yet." />
            </BudgetPanel>

            <BudgetPanel description="Upcoming renewals sorted by due date." title="Renewal Calendar">
              {upcoming.length > 0 ? (
                upcoming.map((subscription) => (
                  <BudgetRow key={subscription.id}>
                    <div
                      style={{
                        alignItems: 'start',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 14,
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 8 }}>
                        <Link href={`/budget/subscriptions/${subscription.id}`} style={{ color: 'inherit', fontSize: 17, fontWeight: 800, textDecoration: 'none' }}>
                          {subscription.name}
                        </Link>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <BudgetTonePill tone="money">{formatBudgetCurrency(subscription.price)}</BudgetTonePill>
                          <BudgetTonePill tone="neutral">{subscription.billing_cycle.replace(/_/g, ' ')}</BudgetTonePill>
                          <BudgetTonePill tone={subscription.status === 'active' ? 'accent' : subscription.status === 'trial' ? 'info' : 'danger'}>
                            {subscription.status}
                          </BudgetTonePill>
                        </div>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        Renews {relativeBudgetDate(subscription.next_renewal)}
                      </div>
                    </div>
                  </BudgetRow>
                ))
              ) : (
                <BudgetRow>
                  <strong>No renewals due.</strong>
                </BudgetRow>
              )}
            </BudgetPanel>

            <BudgetPanel description="Hover-style desktop actions replace the mobile swipe affordances." title="All Subscriptions">
              {subscriptions.map((subscription) => (
                <BudgetRow key={subscription.id}>
                  <div
                    style={{
                      alignItems: 'start',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 14,
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 8 }}>
                      <Link href={`/budget/subscriptions/${subscription.id}`} style={{ color: 'inherit', fontSize: 18, fontWeight: 800, textDecoration: 'none' }}>
                        {subscription.name}
                      </Link>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                        {formatBudgetCurrency(subscription.price)} every {subscription.billing_cycle.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <form action={changeStatusAction}>
                        <input name="subscription_id" type="hidden" value={subscription.id} />
                        <input
                          name="next_status"
                          type="hidden"
                          value={subscription.status === 'active' || subscription.status === 'trial' ? 'paused' : 'active'}
                        />
                        <button style={buttonStyle('ghost')} type="submit">
                          {subscription.status === 'active' || subscription.status === 'trial' ? 'Pause' : 'Resume'}
                        </button>
                      </form>
                      <form action={changeStatusAction}>
                        <input name="subscription_id" type="hidden" value={subscription.id} />
                        <input name="next_status" type="hidden" value="cancelled" />
                        <button style={buttonStyle('danger')} type="submit">
                          Cancel
                        </button>
                      </form>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Monthly Equivalent</div>
                      <strong>{formatBudgetCurrency(subscriptionMonthlyCost(subscription))}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Next Renewal</div>
                      <strong>{formatBudgetDate(subscription.next_renewal)}</strong>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>URL</div>
                      <strong>{subscription.url ? 'Catalog linked' : 'Manual entry'}</strong>
                    </div>
                  </div>
                </BudgetRow>
              ))}
            </BudgetPanel>
          </>
        }
        secondary={
          <BudgetForm
            action={createSubscriptionAction}
            description="Manual entry plus renewal timing. Desktop detail pages handle price history and cancellation actions."
            title="Add Subscription"
          >
            <BudgetFormGrid>
              <BudgetField label="Name">
                <BudgetInput name="name" placeholder="Spotify" required />
              </BudgetField>
              <BudgetField label="Price">
                <BudgetInput min="0" name="price" placeholder="10.99" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Billing Cycle">
                <BudgetSelect defaultValue="monthly" name="billing_cycle">
                  {['weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'custom'].map((cycle) => (
                    <option key={cycle} value={cycle}>
                      {cycle.replace(/_/g, ' ')}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Status">
                <BudgetSelect defaultValue="active" name="status">
                  {['active', 'trial', 'paused', 'cancelled'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Start Date">
                <BudgetInput defaultValue={todayIso()} name="start_date" type="date" />
              </BudgetField>
              <BudgetField label="Next Renewal">
                <BudgetInput defaultValue={todayIso()} name="next_renewal" type="date" />
              </BudgetField>
              <BudgetField label="Custom Days">
                <BudgetInput defaultValue="30" min="1" name="custom_days" type="number" />
              </BudgetField>
              <BudgetField label="URL">
                <BudgetInput name="url" placeholder="https://service.com/manage" />
              </BudgetField>
            </BudgetFormGrid>
            <BudgetField label="Notes">
              <BudgetInput name="notes" placeholder="Shared family plan" />
            </BudgetField>
            <BudgetSubmitRow>
              <button style={buttonStyle('primary')} type="submit">
                Save Subscription
              </button>
            </BudgetSubmitRow>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
