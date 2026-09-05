'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BudgetTransactionInsert } from '@mylife/budget';
import {
  applyReceiptToBudgetAction,
  dismissAutomationAction,
  isAutomationRuleEnabledAction,
} from '@/app/actions';
import { addTransaction } from '../../actions';
import { AutomationPreviewCard } from '@/components/automations/AutomationPreviewCard';

interface Option {
  id: string;
  name: string;
}

interface Props {
  accounts: Option[];
  envelopes: Option[];
}

interface PreviewContext {
  title: string;
  subtitle: string;
  draft: BudgetTransactionInsert;
  photoUri: string;
  photoMime: string;
}

const RULE_ID = 'receipt-to-budget';

export function NewTransactionClient({ accounts, envelopes }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [direction, setDirection] =
    useState<'outflow' | 'inflow' | 'transfer'>('outflow');
  const [occurredOn, setOccurredOn] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [envelopeId, setEnvelopeId] = useState<string>('');
  const [photoUri, setPhotoUri] = useState('');
  const [photoMime, setPhotoMime] = useState('image/jpeg');
  const [ruleEnabled, setRuleEnabled] = useState(false);
  const [preview, setPreview] = useState<PreviewContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    isAutomationRuleEnabledAction(RULE_ID).then(setRuleEnabled).catch(() => {
      setRuleEnabled(false);
    });
  }, []);

  const buildDraft = (): BudgetTransactionInsert => {
    const cents = Math.round((Number(amount || '0') || 0) * 100);
    return {
      account_id: accountId || null,
      envelope_id: envelopeId || null,
      amount: Math.max(0, cents),
      direction,
      merchant: merchant || null,
      note: note || null,
      occurred_on: occurredOn,
    } as BudgetTransactionInsert;
  };

  const legacySave = (draft: BudgetTransactionInsert) => {
    startTransition(async () => {
      try {
        await addTransaction(draft);
        router.push('/budget/transactions?saved=1');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const draft = buildDraft();

    if (!ruleEnabled || !photoUri) {
      legacySave(draft);
      return;
    }

    // Client-side preview stub — the rule's own previewCard() is not safe
    // to call in a server-action return value, so we compute a parallel
    // subtitle from the form values. Apply still runs the real rule.
    const cents = draft.amount ?? 0;
    const dollars = (cents / 100).toFixed(2);
    const payee = draft.merchant ?? 'transaction';
    setPreview({
      title: 'Attach receipt to transaction?',
      subtitle: `$${dollars} at ${payee}`,
      draft,
      photoUri,
      photoMime,
    });
  };

  const handleApply = async () => {
    if (!preview) return;
    setError(null);
    const result = await applyReceiptToBudgetAction({
      photoUri: preview.photoUri,
      photoMime: preview.photoMime,
      transactionDraft: preview.draft,
    });
    if (result.ok) {
      router.push('/budget/transactions?automation=receipt-to-budget');
    } else {
      setError(result.error);
      setPreview(null);
    }
  };

  const handleDismiss = async () => {
    if (!preview) return;
    try {
      await dismissAutomationAction(RULE_ID);
    } catch (err) {
      console.error('[automations] dismiss failed', err);
    }
    const draft = preview.draft;
    setPreview(null);
    legacySave(draft);
  };

  const disabled = isPending || preview !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 20,
          background: '#2A292F',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 12,
        }}
      >
        <Field label="Amount">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled}
            required
            style={inputStyle}
          />
        </Field>
        <Field label="Merchant">
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          />
        </Field>
        <Field label="Direction">
          <select
            value={direction}
            onChange={(e) =>
              setDirection(e.target.value as typeof direction)
            }
            disabled={disabled}
            style={inputStyle}
          >
            <option value="outflow">outflow</option>
            <option value="inflow">inflow</option>
            <option value="transfer">transfer</option>
          </select>
        </Field>
        <Field label="Occurred on">
          <input
            type="date"
            value={occurredOn}
            onChange={(e) => setOccurredOn(e.target.value)}
            disabled={disabled}
            required
            style={inputStyle}
          />
        </Field>
        <Field label="Account">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          >
            <option value="">None</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Envelope">
          <select
            value={envelopeId}
            onChange={(e) => setEnvelopeId(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          >
            <option value="">None</option>
            {envelopes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Note">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          />
        </Field>
        <Field label="Receipt photo URI (optional)">
          <input
            type="text"
            value={photoUri}
            onChange={(e) => setPhotoUri(e.target.value)}
            placeholder="file://... or https://..."
            disabled={disabled}
            style={inputStyle}
          />
        </Field>
        <Field label="Photo MIME">
          <input
            type="text"
            value={photoMime}
            onChange={(e) => setPhotoMime(e.target.value)}
            disabled={disabled}
            style={inputStyle}
          />
        </Field>
        <button
          type="submit"
          disabled={disabled}
          style={{
            marginTop: 8,
            padding: '12px 16px',
            fontSize: 15,
            fontWeight: 600,
            color: '#131318',
            background: '#FFB877',
            border: 'none',
            borderRadius: 8,
            cursor: disabled ? 'wait' : 'pointer',
          }}
        >
          {isPending ? 'Saving…' : 'Save transaction'}
        </button>
        {error && (
          <p style={{ color: '#FFB4AB', fontSize: 13, margin: 0 }}>{error}</p>
        )}
      </form>

      {preview && (
        <AutomationPreviewCard
          title={preview.title}
          subtitle={preview.subtitle}
          onApply={handleApply}
          onDismiss={handleDismiss}
          applyLabel="Attach + save"
          dismissLabel="Save without receipt"
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        color: '#D6C3B5',
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 15,
  color: '#E4E1E9',
  background: '#131318',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  borderRadius: 8,
};
