import { redirect } from 'next/navigation';
import { fetchBudgetSetting, saveBudgetSetting } from '../actions';
import { BudgetField, BudgetForm, BudgetFormGrid, BudgetHero, BudgetInput, BudgetPage } from '../primitives';
import { buttonStyle } from '../ui';

export const dynamic = 'force-dynamic';

const SETTING_KEYS = [
  'budget.default_account_id',
  'budget.default_currency',
  'budget.onboarding_complete',
  'budget.weekly_digest_opt_in',
];

export default async function BudgetSettingsPage() {
  const settings = await Promise.all(
    SETTING_KEYS.map(async (key) => [key, await fetchBudgetSetting(key)] as const),
  );

  async function saveSettingsAction(formData: FormData) {
    'use server';

    await Promise.all(
      SETTING_KEYS.map((key) => saveBudgetSetting(key, String(formData.get(key) ?? ''))),
    );
    redirect('/budget/settings');
  }

  return (
    <BudgetPage maxWidth={1024}>
      <BudgetHero description="Budget-specific settings persisted through the shared module settings table." eyebrow="Settings" title="Budget Settings" />

      <BudgetForm action={saveSettingsAction} title="General Settings">
        <BudgetFormGrid columns={1}>
          {settings.map(([key, value]) => (
            <BudgetField key={key} label={key}>
              <BudgetInput defaultValue={value ?? ''} name={key} />
            </BudgetField>
          ))}
        </BudgetFormGrid>
        <button style={buttonStyle('primary')} type="submit">
          Save Settings
        </button>
      </BudgetForm>
    </BudgetPage>
  );
}
