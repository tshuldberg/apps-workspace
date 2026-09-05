import type { DatabaseAdapter } from '@mylife/db';
import type {
  AlertMethod,
  Caregiver,
  CaregiverAlert,
  CaregiverAlertConfig,
  CreateCaregiverInput,
} from '../models/caregiver';

export type CaregiverRuleKey =
  | 'missed_dose'
  | 'abnormal_bp'
  | 'glucose_low'
  | 'glucose_high'
  | 'missed_check_in';

export interface CaregiverRuleConfig {
  key: CaregiverRuleKey;
  enabled: boolean;
  threshold: number;
  unit: string;
}

export interface CaregiverRulesState {
  alertMethod: AlertMethod;
  rules: CaregiverRuleConfig[];
  updatedAt: string;
}

export interface CaregiverAlertHistoryItem extends CaregiverAlert {
  caregiverName: string;
  medicationName: string | null;
}

const CAREGIVER_ALERT_SETTINGS_KEY = 'caregiver.alert_rules';

const DEFAULT_RULES: CaregiverRulesState = {
  alertMethod: 'both',
  updatedAt: new Date(0).toISOString(),
  rules: [
    { key: 'missed_dose', enabled: true, threshold: 30, unit: 'min' },
    { key: 'abnormal_bp', enabled: true, threshold: 140, unit: 'systolic' },
    { key: 'glucose_low', enabled: true, threshold: 70, unit: 'mg/dL' },
    { key: 'glucose_high', enabled: true, threshold: 180, unit: 'mg/dL' },
    { key: 'missed_check_in', enabled: false, threshold: 12, unit: 'hr' },
  ],
};

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToCaregiver(row: Record<string, unknown>): Caregiver {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    relationship: (row.relationship as Caregiver['relationship']) ?? null,
    isActive: !!(row.is_active as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToCaregiverAlert(row: Record<string, unknown>): CaregiverAlert {
  return {
    id: row.id as string,
    caregiverId: row.caregiver_id as string,
    medicationId: (row.medication_id as string) ?? null,
    alertType: row.alert_type as CaregiverAlert['alertType'],
    message: row.message as string,
    sentAt: row.sent_at as string,
    deliveryMethod: row.delivery_method as AlertMethod,
    status: row.status as CaregiverAlert['status'],
    createdAt: row.created_at as string,
  };
}

export function getCaregivers(
  db: DatabaseAdapter,
  opts?: { activeOnly?: boolean; limit?: number },
): Caregiver[] {
  const limit = opts?.limit ?? 100;
  if (opts?.activeOnly) {
    return db
      .query<Record<string, unknown>>(
        `SELECT * FROM md_caregivers
         WHERE is_active = 1
         ORDER BY name ASC
         LIMIT ?`,
        [limit],
      )
      .map(rowToCaregiver);
  }

  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_caregivers
       ORDER BY is_active DESC, name ASC
       LIMIT ?`,
      [limit],
    )
    .map(rowToCaregiver);
}

export function createCaregiver(
  db: DatabaseAdapter,
  input: CreateCaregiverInput,
  id: string = createId('md_caregiver'),
): Caregiver {
  const now = nowIso();
  db.execute(
    `INSERT INTO md_caregivers
      (id, name, phone, email, relationship, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.name.trim(),
      input.phone?.trim() || null,
      input.email?.trim() || null,
      input.relationship ?? null,
      now,
      now,
    ],
  );

  return {
    id,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    relationship: input.relationship ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCaregiver(
  db: DatabaseAdapter,
  caregiverId: string,
  updates: Partial<CreateCaregiverInput & { isActive: boolean }>,
): Caregiver | null {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name.trim());
  }
  if (updates.phone !== undefined) {
    fields.push('phone = ?');
    params.push(updates.phone?.trim() || null);
  }
  if (updates.email !== undefined) {
    fields.push('email = ?');
    params.push(updates.email?.trim() || null);
  }
  if (updates.relationship !== undefined) {
    fields.push('relationship = ?');
    params.push(updates.relationship ?? null);
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(updates.isActive ? 1 : 0);
  }

  if (fields.length === 0) {
    const rows = db.query<Record<string, unknown>>(
      'SELECT * FROM md_caregivers WHERE id = ?',
      [caregiverId],
    );
    return rows[0] ? rowToCaregiver(rows[0]) : null;
  }

  fields.push('updated_at = ?');
  params.push(nowIso(), caregiverId);

  db.execute(
    `UPDATE md_caregivers SET ${fields.join(', ')} WHERE id = ?`,
    params,
  );

  const rows = db.query<Record<string, unknown>>(
    'SELECT * FROM md_caregivers WHERE id = ?',
    [caregiverId],
  );
  return rows[0] ? rowToCaregiver(rows[0]) : null;
}

export function deleteCaregiver(db: DatabaseAdapter, caregiverId: string): void {
  db.execute('DELETE FROM md_caregivers WHERE id = ?', [caregiverId]);
}

export function getAlertConfig(db: DatabaseAdapter): CaregiverRulesState {
  const row = db.query<{ value: string }>(
    'SELECT value FROM md_settings WHERE key = ?',
    [CAREGIVER_ALERT_SETTINGS_KEY],
  )[0];

  if (!row?.value) {
    return {
      ...DEFAULT_RULES,
      rules: DEFAULT_RULES.rules.map((rule) => ({ ...rule })),
    };
  }

  try {
    const parsed = JSON.parse(row.value) as CaregiverRulesState;
    return {
      alertMethod: parsed.alertMethod ?? DEFAULT_RULES.alertMethod,
      updatedAt: parsed.updatedAt ?? DEFAULT_RULES.updatedAt,
      rules: DEFAULT_RULES.rules.map((rule) => {
        const match = parsed.rules?.find((item) => item.key === rule.key);
        return match ? { ...rule, ...match } : { ...rule };
      }),
    };
  } catch {
    return {
      ...DEFAULT_RULES,
      rules: DEFAULT_RULES.rules.map((rule) => ({ ...rule })),
    };
  }
}

export function updateAlertConfig(
  db: DatabaseAdapter,
  nextState: CaregiverRulesState,
): CaregiverRulesState {
  const normalized: CaregiverRulesState = {
    alertMethod: nextState.alertMethod,
    updatedAt: nowIso(),
    rules: DEFAULT_RULES.rules.map((rule) => {
      const match = nextState.rules.find((item) => item.key === rule.key);
      return match ? { ...rule, ...match } : { ...rule };
    }),
  };

  db.execute(
    `INSERT INTO md_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [CAREGIVER_ALERT_SETTINGS_KEY, JSON.stringify(normalized), normalized.updatedAt],
  );

  return normalized;
}

export function recordCaregiverAlert(
  db: DatabaseAdapter,
  input: {
    caregiverId: string;
    medicationId?: string | null;
    alertType: CaregiverAlert['alertType'];
    message: string;
    deliveryMethod: AlertMethod;
    status?: CaregiverAlert['status'];
    sentAt?: string;
  },
  id: string = createId('md_cg_alert'),
): CaregiverAlert {
  const sentAt = input.sentAt ?? nowIso();
  const createdAt = nowIso();
  const status = input.status ?? 'pending';

  db.execute(
    `INSERT INTO md_caregiver_alerts
      (id, caregiver_id, medication_id, alert_type, message, sent_at, delivery_method, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.caregiverId,
      input.medicationId ?? null,
      input.alertType,
      input.message,
      sentAt,
      input.deliveryMethod,
      status,
      createdAt,
    ],
  );

  return {
    id,
    caregiverId: input.caregiverId,
    medicationId: input.medicationId ?? null,
    alertType: input.alertType,
    message: input.message,
    sentAt,
    deliveryMethod: input.deliveryMethod,
    status,
    createdAt,
  };
}

export function getAlertHistory(
  db: DatabaseAdapter,
  limit: number = 20,
): CaregiverAlertHistoryItem[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT a.*, c.name AS caregiver_name, m.name AS medication_name
       FROM md_caregiver_alerts a
       JOIN md_caregivers c ON c.id = a.caregiver_id
       LEFT JOIN md_medications m ON m.id = a.medication_id
       ORDER BY a.sent_at DESC
       LIMIT ?`,
      [limit],
    )
    .map((row) => ({
      ...rowToCaregiverAlert(row),
      caregiverName: row.caregiver_name as string,
      medicationName: (row.medication_name as string) ?? null,
    }));
}

export function getCaregiverAlertRows(
  db: DatabaseAdapter,
  caregiverId: string,
): CaregiverAlertConfig[] {
  return db
    .query<Record<string, unknown>>(
      `SELECT * FROM md_caregiver_alert_config
       WHERE caregiver_id = ?
       ORDER BY created_at ASC`,
      [caregiverId],
    )
    .map((row) => ({
      id: row.id as string,
      caregiverId: row.caregiver_id as string,
      medicationId: (row.medication_id as string) ?? null,
      alertAllMeds: !!(row.alert_all_meds as number),
      delayMinutes: row.delay_minutes as number,
      alertMethod: row.alert_method as AlertMethod,
      isActive: !!(row.is_active as number),
      createdAt: row.created_at as string,
    }));
}
