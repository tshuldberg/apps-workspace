import { redirect } from 'next/navigation';
import { addTransactionRule, fetchEnvelopes, fetchTransactionRules } from '../actions';
import { parseNumberField, stringField } from '../route-utils';
import { BudgetField, BudgetForm, BudgetFormGrid, BudgetHero, BudgetInput, BudgetPage, BudgetPanel, BudgetSelect, BudgetTable } from '../primitives';
import { BudgetMetricCard, buttonStyle } from '../ui';

export const dynamic = 'force-dynamic';

export default async function BudgetRulesPage() {
  const [envelopes, rules] = await Promise.all([fetchEnvelopes(), fetchTransactionRules()]);

  async function addRuleAction(formData: FormData) {
    'use server';

    await addTransactionRule({
      envelope_id: stringField(formData, 'envelope_id'),
      is_enabled: stringField(formData, 'is_enabled') === '1' ? 1 : 0,
      match_type: stringField(formData, 'match_type') as 'contains' | 'exact' | 'starts_with',
      payee_pattern: stringField(formData, 'payee_pattern'),
      priority: parseNumberField(formData, 'priority', rules.length + 1),
    });
    redirect('/budget/rules');
  }

  return (
    <BudgetPage>
      <BudgetHero description="Transaction automation rules for the web shell." eyebrow="Rules" title="Rule Engine" />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <BudgetMetricCard label="Total Rules" subvalue="Stored match rules" tone="accent" value={rules.length} />
        <BudgetMetricCard label="Enabled" subvalue="Rules ready for review/import flows" tone="money" value={rules.filter((rule) => rule.is_enabled === 1).length} />
      </div>

      <BudgetPanel description="Payee patterns route uncategorized imports into the right envelope." title="Rules">
        <BudgetTable
          columns={['Pattern', 'Match', 'Envelope', 'Priority', 'Enabled']}
          rows={rules.map((rule) => [
            rule.payee_pattern,
            rule.match_type,
            envelopes.find((envelope) => envelope.id === rule.envelope_id)?.name ?? rule.envelope_id,
            rule.priority,
            rule.is_enabled === 1 ? 'Yes' : 'No',
          ])}
        />
      </BudgetPanel>

      <BudgetForm action={addRuleAction} title="Add Rule">
        <BudgetFormGrid>
          <BudgetField label="Payee Pattern">
            <BudgetInput name="payee_pattern" required />
          </BudgetField>
          <BudgetField label="Match Type">
            <BudgetSelect defaultValue="contains" name="match_type">
              <option value="contains">contains</option>
              <option value="exact">exact</option>
              <option value="starts_with">starts with</option>
            </BudgetSelect>
          </BudgetField>
          <BudgetField label="Envelope">
            <BudgetSelect defaultValue={envelopes[0]?.id} name="envelope_id">
              {envelopes.map((envelope) => (
                <option key={envelope.id} value={envelope.id}>
                  {envelope.name}
                </option>
              ))}
            </BudgetSelect>
          </BudgetField>
          <BudgetField label="Priority">
            <BudgetInput defaultValue={String(rules.length + 1)} min="1" name="priority" type="number" />
          </BudgetField>
          <BudgetField label="Enabled">
            <BudgetInput defaultValue="1" name="is_enabled" type="number" />
          </BudgetField>
        </BudgetFormGrid>
        <button style={buttonStyle('primary')} type="submit">
          Save Rule
        </button>
      </BudgetForm>
    </BudgetPage>
  );
}
