'use server';

import { revalidatePath } from 'next/cache';
import {
  createDocument,
  createLoyaltyProgram,
  DocumentInputSchema,
  LoyaltyProgramInputSchema,
  type DocumentInput,
  type LoyaltyProgramInput,
} from '@mylife/travel';
import { ensureModuleMigrations, getAdapter } from '@/lib/db';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('travel');
  return adapter;
}

export interface LogisticsFormResult {
  ok: boolean;
  error?: string;
}

export async function createDocumentAction(
  _prev: LogisticsFormResult | null,
  formData: FormData,
): Promise<LogisticsFormResult> {
  const type = String(formData.get('type') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const number = String(formData.get('number') ?? '').trim();
  const country = String(formData.get('country') ?? '').trim();
  const issueDate = String(formData.get('issue_date') ?? '').trim();
  const expiryDate = String(formData.get('expiry_date') ?? '').trim();
  const reminderDays = String(formData.get('renewal_reminder_days') ?? '').trim();

  const candidate: DocumentInput = {
    type: type as DocumentInput['type'],
    name,
    number: number || undefined,
    country: country || undefined,
    issue_date: issueDate || undefined,
    expiry_date: expiryDate || undefined,
    renewal_reminder_days: reminderDays ? Number(reminderDays) : undefined,
  };

  const parsed = DocumentInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid document.',
    };
  }

  try {
    createDocument(db(), parsed.data);
  } catch {
    return { ok: false, error: 'Could not save document. Please try again.' };
  }

  revalidatePath('/travel/logistics');
  return { ok: true };
}

export async function createLoyaltyAction(
  _prev: LogisticsFormResult | null,
  formData: FormData,
): Promise<LogisticsFormResult> {
  const type = String(formData.get('type') ?? '').trim();
  const provider = String(formData.get('provider') ?? '').trim();
  const memberNumber = String(formData.get('member_number') ?? '').trim();
  const statusTier = String(formData.get('status_tier') ?? '').trim();
  const points = String(formData.get('points_balance') ?? '').trim();
  const miles = String(formData.get('miles_balance') ?? '').trim();
  const expiryDate = String(formData.get('expiry_date') ?? '').trim();

  const candidate: LoyaltyProgramInput = {
    type: type as LoyaltyProgramInput['type'],
    provider,
    member_number: memberNumber || undefined,
    status_tier: statusTier || undefined,
    points_balance: points ? Number(points) : undefined,
    miles_balance: miles ? Number(miles) : undefined,
    expiry_date: expiryDate || undefined,
  };

  const parsed = LoyaltyProgramInputSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid loyalty program.',
    };
  }

  try {
    createLoyaltyProgram(db(), parsed.data);
  } catch {
    return { ok: false, error: 'Could not save program. Please try again.' };
  }

  revalidatePath('/travel/logistics');
  return { ok: true };
}
