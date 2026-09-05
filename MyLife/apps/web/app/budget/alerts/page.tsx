import { redirect } from 'next/navigation';
import { addBudgetAlert, fetchAlertHistory, fetchBudgetAlerts, fetchEnvelopes } from '../actions';
import { currentMonthKey, parseNumberField, stringField } from '../route-utils';
import { BudgetField, BudgetForm, BudgetFormGrid, BudgetHero, BudgetInput, BudgetPage, BudgetPanel, BudgetSelect, BudgetTable } from '../primitives';
import { BudgetMetricCard, buttonStyle, formatBudgetCurrency } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetAlertsPage() {
  const [alerts, alertHistory, envelopes] = await Promise.all([
    fetchBudgetAlerts(),
    fetchAlertHistory(currentMonthKey()),
    fetchEnvelopes(),
  ]);

  async function addAlertAction(formData: FormData) {
    'use server';

    await addBudgetAlert({
      envelope_id: stringField(formData, 'envelope_id'),
      is_enabled: stringField(formData, 'is_enabled') === '1' ? 1 : 0,
      threshold_pct: parseNumberField(formData, 'threshold_pct', 80),
    });
    redirect('/budget/alerts');
  }

  return (
    <BudgetPage>
      <BudgetHero description="Budget alert thresholds and recent trigger history." eyebrow="Alerts" title="Alert Management" />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <BudgetMetricCard label="Active Alerts" subvalue="Enabled envelope alerts" tone="accent" value={alerts.filter((alert) => alert.is_enabled === 1).length} />
        <BudgetMetricCard label="Triggered This Month" subvalue={currentMonthKey()} tone="danger" value={alertHistory.length} />
      </div>

      <BudgetPanel description="Envelope threshold configuration." title="Alert Rules">
        <BudgetTable
          columns={['Envelope', 'Threshold', 'Enabled']}
          rows={alerts.map((alert) => [
            envelopes.find((envelope) => envelope.id === alert.envelope_id)?.name ?? alert.envelope_id,
            `${alert.threshold_pct}%`,
            alert.is_enabled === 1 ? 'Yes' : 'No',
          ])}
        />
      </BudgetPanel>

      <BudgetPanel description="Triggered alerts for the current month." title="History">
        <BudgetTable
          columns={['Envelope', 'Spent', 'Target', 'Threshold']}
          rows={alertHistory.length > 0
            ? alertHistory.map((entry) => [
                envelopes.find((envelope) => envelope.id === entry.envelope_id)?.name ?? entry.envelope_id,
                formatBudgetCurrency(entry.amount_spent),
                formatBudgetCurrency(entry.target_amount),
                `${entry.spent_pct}% / ${entry.threshold_pct}%`,
              ])
            : [['No alert history', '-', '-', '-']]}
        />
      </BudgetPanel>

      <BudgetForm action={addAlertAction} title="Add Alert">
        <BudgetFormGrid>
          <BudgetField label="Envelope">
            <BudgetSelect defaultValue={envelopes[0]?.id} name="envelope_id">
              {envelopes.map((envelope) => (
                <option key={envelope.id} value={envelope.id}>
                  {envelope.name}
                </option>
              ))}
            </BudgetSelect>
          </BudgetField>
          <BudgetField label="Threshold %">
            <BudgetInput defaultValue="80" max="200" min="1" name="threshold_pct" type="number" />
          </BudgetField>
          <BudgetField label="Enabled">
            <BudgetInput defaultValue="1" name="is_enabled" type="number" />
          </BudgetField>
        </BudgetFormGrid>
        <button style={buttonStyle('primary')} type="submit">
          Save Alert
        </button>
      </BudgetForm>
    </BudgetPage>
  );
}
