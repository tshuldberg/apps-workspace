import { fetchAccounts, fetchEnvelopes, fetchGoals, fetchSubscriptions } from '../actions';
import { BudgetHero, BudgetMetricGrid, BudgetPage, BudgetPanel, BudgetRouteCard, BudgetRouteGrid } from '../primitives';
import { BudgetMetricCard } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetOnboardingPage() {
  const [accounts, envelopes, goals, subscriptions] = await Promise.all([
    fetchAccounts(),
    fetchEnvelopes(),
    fetchGoals(),
    fetchSubscriptions(),
  ]);

  return (
    <BudgetPage maxWidth={1024}>
      <BudgetHero
        description="Desktop onboarding checklist with direct links into the most important setup surfaces."
        eyebrow="Onboarding"
        title="Get MyBudget Ready"
      />

      <BudgetMetricGrid>
        <BudgetMetricCard label="Accounts" subvalue="Connect or add cash sources" tone={accounts.length > 0 ? 'money' : 'danger'} value={accounts.length} />
        <BudgetMetricCard label="Envelopes" subvalue="Assign spending categories" tone={envelopes.length > 0 ? 'money' : 'danger'} value={envelopes.length} />
        <BudgetMetricCard label="Goals" subvalue="Savings milestones" tone={goals.length > 0 ? 'accent' : 'neutral'} value={goals.length} />
        <BudgetMetricCard label="Subscriptions" subvalue="Recurring spend audit" tone={subscriptions.length > 0 ? 'accent' : 'neutral'} value={subscriptions.length} />
      </BudgetMetricGrid>

      <BudgetPanel description="Recommended order for desktop setup." title="Checklist">
        <BudgetRouteGrid>
          <BudgetRouteCard description="Add or reconcile your main checking, savings, and credit accounts." href="/budget/accounts" icon="account_balance" title="1. Accounts" />
          <BudgetRouteCard description="Create envelope groups and assign monthly budget amounts." href="/budget" icon="account_balance_wallet" title="2. Budget Home" />
          <BudgetRouteCard description="Audit recurring services and pause anything unnecessary." href="/budget/subscriptions" icon="repeat" title="3. Subscriptions" />
          <BudgetRouteCard description="Set a savings target or debt payoff plan to guide the month." href="/budget/goals" icon="flag" title="4. Goals" />
        </BudgetRouteGrid>
      </BudgetPanel>
    </BudgetPage>
  );
}
