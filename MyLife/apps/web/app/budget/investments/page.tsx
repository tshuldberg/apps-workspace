import Link from 'next/link';
import { redirect } from 'next/navigation';
import { calculateAllocation, calculateHoldingGainLoss, calculatePortfolioSummary } from '@mylife/budget';
import { addHolding, fetchAccounts, fetchActiveHoldings, refreshHoldingSnapshots } from '../actions';
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
  BudgetSelect,
  BudgetTable,
} from '../primitives';
import { holdingsToEngine, parseCurrencyField, parseNumberField, stringField, todayIso } from '../route-utils';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency, formatBudgetPercent } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetInvestmentsPage() {
  const [accounts, holdings] = await Promise.all([fetchAccounts(), fetchActiveHoldings()]);
  const engineHoldings = holdingsToEngine(holdings);
  const portfolio = calculatePortfolioSummary(engineHoldings);
  const allocation = calculateAllocation(engineHoldings);

  async function addHoldingAction(formData: FormData) {
    'use server';

    const shares = parseNumberField(formData, 'shares');
    const currentPrice = parseCurrencyField(formData, 'current_price');
    await addHolding({
      account_id: stringField(formData, 'account_id'),
      asset_class: stringField(formData, 'asset_class') as 'bond' | 'cash_equivalent' | 'commodity' | 'crypto' | 'etf' | 'mutual_fund' | 'other' | 'reit' | 'stock',
      cost_basis: parseCurrencyField(formData, 'cost_basis'),
      current_price: currentPrice,
      current_value: Math.round(shares * currentPrice),
      last_price_update: todayIso(),
      name: stringField(formData, 'name'),
      shares,
      symbol: stringField(formData, 'symbol'),
    });
    redirect('/budget/investments');
  }

  async function refreshSnapshotsAction() {
    'use server';

    await refreshHoldingSnapshots();
    redirect('/budget/investments');
  }

  return (
    <BudgetPage>
      <BudgetHero
        actions={
          <>
            <form action={refreshSnapshotsAction}>
              <button style={buttonStyle('secondary')} type="submit">
                Refresh Snapshots
              </button>
            </form>
            <Link href="/budget/net-worth" style={buttonStyle('ghost')}>
              Net Worth
            </Link>
          </>
        }
        description="Desktop portfolio tracking with live holdings, allocation mix, and snapshot refresh from the shared budget module."
        eyebrow="Investments"
        title="Portfolio Tracker"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Portfolio Value" subvalue={`${portfolio.holdingCount} holdings`} tone="money" value={formatBudgetCurrency(portfolio.totalValue)} />
          <BudgetMetricCard label="Cost Basis" subvalue="Invested capital" tone="neutral" value={formatBudgetCurrency(portfolio.totalCostBasis)} />
          <BudgetMetricCard label="Gain / Loss" subvalue={formatBudgetPercent(portfolio.totalReturnPct)} tone={portfolio.totalGainLoss >= 0 ? 'accent' : 'danger'} value={formatBudgetCurrency(portfolio.totalGainLoss, { signed: true })} />
          <BudgetMetricCard label="Top Asset Class" subvalue="Largest allocation" tone="info" value={allocation[0]?.assetClass ?? 'None'} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Allocation by asset class." title="Allocation">
              <BudgetDonutChart
                data={allocation.map((entry) => ({
                  label: entry.assetClass,
                  value: entry.value,
                }))}
                emptyLabel="No active holdings."
              />
            </BudgetPanel>

            <BudgetPanel description="All active holdings." title="Holdings">
              <BudgetTable
                columns={['Holding', 'Value', 'Gain/Loss', 'Return']}
                rows={engineHoldings.map((holding) => {
                  const performance = calculateHoldingGainLoss(holding);
                  return [
                    `${holding.symbol} · ${holding.name}`,
                    formatBudgetCurrency(performance.currentValue),
                    formatBudgetCurrency(performance.gainLoss, { signed: true }),
                    formatBudgetPercent(performance.returnPct),
                  ];
                })}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <BudgetForm action={addHoldingAction} description="Add a holding and let desktop parity drive the snapshot refresh." title="Add Holding">
            <BudgetFormGrid>
              <BudgetField label="Account">
                <BudgetSelect defaultValue={accounts.find((account) => account.type === 'investment')?.id} name="account_id" required>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Symbol">
                <BudgetInput name="symbol" placeholder="VOO" required />
              </BudgetField>
              <BudgetField label="Name">
                <BudgetInput name="name" placeholder="Vanguard S&P 500 ETF" required />
              </BudgetField>
              <BudgetField label="Asset Class">
                <BudgetSelect defaultValue="etf" name="asset_class">
                  {['stock', 'bond', 'etf', 'mutual_fund', 'reit', 'crypto', 'commodity', 'cash_equivalent', 'other'].map((value) => (
                    <option key={value} value={value}>
                      {value.replace(/_/g, ' ')}
                    </option>
                  ))}
                </BudgetSelect>
              </BudgetField>
              <BudgetField label="Shares">
                <BudgetInput min="0" name="shares" required step="0.0001" type="number" />
              </BudgetField>
              <BudgetField label="Cost Basis">
                <BudgetInput min="0" name="cost_basis" required step="0.01" type="number" />
              </BudgetField>
              <BudgetField label="Current Price">
                <BudgetInput min="0" name="current_price" required step="0.01" type="number" />
              </BudgetField>
            </BudgetFormGrid>
            <button style={buttonStyle('primary')} type="submit">
              Save Holding
            </button>
          </BudgetForm>
        }
      />
    </BudgetPage>
  );
}
