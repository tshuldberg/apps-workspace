import { redirect } from 'next/navigation';
import { addCurrency, fetchBaseCurrency, fetchCurrencies, fetchExchangeRates, saveExchangeRate } from '../actions';
import {
  BudgetColumns,
  BudgetField,
  BudgetForm,
  BudgetFormGrid,
  BudgetHero,
  BudgetInput,
  BudgetPage,
  BudgetPanel,
  BudgetTable,
} from '../primitives';
import { parseNumberField, stringField } from '../route-utils';
import { BudgetMetricCard, buttonStyle } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetCurrenciesPage() {
  const [baseCurrency, currencies, exchangeRates] = await Promise.all([
    fetchBaseCurrency(),
    fetchCurrencies(),
    fetchExchangeRates(),
  ]);

  async function addCurrencyAction(formData: FormData) {
    'use server';

    await addCurrency({
      code: stringField(formData, 'code'),
      decimalPlaces: parseNumberField(formData, 'decimal_places', 2),
      isBase: stringField(formData, 'is_base') === '1',
      name: stringField(formData, 'name'),
      symbol: stringField(formData, 'symbol'),
    });
    redirect('/budget/currencies');
  }

  async function addRateAction(formData: FormData) {
    'use server';

    await saveExchangeRate({
      fromCurrency: stringField(formData, 'from_currency'),
      rate: parseNumberField(formData, 'rate'),
      rateDecimal: stringField(formData, 'rate_decimal'),
      toCurrency: stringField(formData, 'to_currency'),
    });
    redirect('/budget/currencies');
  }

  return (
    <BudgetPage>
      <BudgetHero
        description="Currency registry and manual exchange-rate management for the desktop shell."
        eyebrow="Currencies"
        title="Currency Desk"
      >
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <BudgetMetricCard label="Base Currency" subvalue="Primary reporting currency" tone="money" value={baseCurrency?.code ?? 'USD'} />
          <BudgetMetricCard label="Currencies" subvalue="Supported codes" tone="accent" value={currencies.length} />
          <BudgetMetricCard label="Exchange Rates" subvalue="Stored FX rows" tone="info" value={exchangeRates.length} />
        </div>
      </BudgetHero>

      <BudgetColumns
        primary={
          <>
            <BudgetPanel description="Available currencies." title="Currency List">
              <BudgetTable
                columns={['Code', 'Name', 'Symbol', 'Base']}
                rows={currencies.map((currency) => [
                  currency.code,
                  currency.name,
                  currency.symbol,
                  currency.is_base === 1 ? 'Yes' : 'No',
                ])}
              />
            </BudgetPanel>
            <BudgetPanel description="Manual exchange-rate entries." title="Exchange Rates">
              <BudgetTable
                columns={['From', 'To', 'Rate', 'Decimal', 'Fetched']}
                rows={exchangeRates.map((rate) => [
                  rate.from_currency,
                  rate.to_currency,
                  rate.rate,
                  rate.rate_decimal,
                  rate.fetched_at,
                ])}
              />
            </BudgetPanel>
          </>
        }
        secondary={
          <>
            <BudgetForm action={addCurrencyAction} title="Add Currency">
              <BudgetFormGrid>
                <BudgetField label="Code">
                  <BudgetInput maxLength={3} name="code" required />
                </BudgetField>
                <BudgetField label="Name">
                  <BudgetInput name="name" required />
                </BudgetField>
                <BudgetField label="Symbol">
                  <BudgetInput name="symbol" required />
                </BudgetField>
                <BudgetField label="Decimal Places">
                  <BudgetInput defaultValue="2" min="0" name="decimal_places" type="number" />
                </BudgetField>
                <BudgetField label="Base Flag">
                  <BudgetInput defaultValue="0" name="is_base" type="number" />
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('primary')} type="submit">
                Save Currency
              </button>
            </BudgetForm>
            <BudgetForm action={addRateAction} title="Add Exchange Rate">
              <BudgetFormGrid>
                <BudgetField label="From">
                  <BudgetInput maxLength={3} name="from_currency" required />
                </BudgetField>
                <BudgetField label="To">
                  <BudgetInput maxLength={3} name="to_currency" required />
                </BudgetField>
                <BudgetField label="Rate">
                  <BudgetInput min="0" name="rate" required step="0.000001" type="number" />
                </BudgetField>
                <BudgetField label="Rate Decimal">
                  <BudgetInput name="rate_decimal" required />
                </BudgetField>
              </BudgetFormGrid>
              <button style={buttonStyle('secondary')} type="submit">
                Save Rate
              </button>
            </BudgetForm>
          </>
        }
      />
    </BudgetPage>
  );
}
