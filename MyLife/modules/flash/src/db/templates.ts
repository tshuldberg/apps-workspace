import type { DatabaseAdapter } from '@mylife/db';
import type { Template, TemplateField, CreateTemplateInput } from '../templates/types';

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToField(row: Record<string, unknown>): TemplateField {
  return {
    id: row.id as string,
    templateId: row.template_id as string,
    name: row.name as string,
    fieldType: row.field_type as TemplateField['fieldType'],
    isRequired: Boolean(row.is_required),
    sortOrder: row.sort_order as number,
    placeholder: (row.placeholder as string) ?? '',
    createdAt: row.created_at as string,
  };
}

function rowToTemplate(row: Record<string, unknown>, fields: TemplateField[]): Template {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    isBuiltin: Boolean(row.is_builtin),
    cardCountPerNote: row.card_count_per_note as number,
    frontFormat: row.front_format as string,
    backFormat: row.back_format as string,
    css: (row.css as string) ?? '',
    sortOrder: row.sort_order as number,
    fields,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function listTemplates(db: DatabaseAdapter): Template[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_templates ORDER BY sort_order ASC, created_at ASC`,
  );
  const allFields = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_template_fields ORDER BY template_id, sort_order ASC`,
  );
  const fieldsByTemplate = new Map<string, TemplateField[]>();
  for (const row of allFields) {
    const tplId = row.template_id as string;
    const list = fieldsByTemplate.get(tplId) ?? [];
    list.push(rowToField(row));
    fieldsByTemplate.set(tplId, list);
  }
  return rows.map((row) => rowToTemplate(row, fieldsByTemplate.get(row.id as string) ?? []));
}

export function getTemplateById(db: DatabaseAdapter, templateId: string): Template | null {
  const row = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_templates WHERE id = ?`,
    [templateId],
  )[0];
  if (!row) return null;
  const fields = db.query<Record<string, unknown>>(
    `SELECT * FROM fl_template_fields WHERE template_id = ? ORDER BY sort_order ASC`,
    [templateId],
  ).map(rowToField);
  return rowToTemplate(row, fields);
}

export function createTemplate(db: DatabaseAdapter, input: CreateTemplateInput): Template {
  const id = createId('fl_tpl');
  const now = nowIso();
  const fields: TemplateField[] = [];

  db.transaction(() => {
    db.execute(
      `INSERT INTO fl_templates (id, name, description, is_builtin, card_count_per_note, front_format, back_format, css, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, 0, ?, ?)`,
      [id, input.name.trim(), input.description ?? '', input.cardCountPerNote ?? 1, input.frontFormat, input.backFormat, input.css ?? '', now, now],
    );

    for (let i = 0; i < input.fields.length; i++) {
      const f = input.fields[i];
      const fid = createId('fl_fld');
      db.execute(
        `INSERT INTO fl_template_fields (id, template_id, name, field_type, is_required, sort_order, placeholder, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [fid, id, f.name.trim(), f.fieldType ?? 'text', f.isRequired ? 1 : 0, i, f.placeholder ?? '', now],
      );
      fields.push({
        id: fid,
        templateId: id,
        name: f.name.trim(),
        fieldType: f.fieldType ?? 'text',
        isRequired: f.isRequired ?? false,
        sortOrder: i,
        placeholder: f.placeholder ?? '',
        createdAt: now,
      });
    }
  });

  return {
    id,
    name: input.name.trim(),
    description: input.description ?? '',
    isBuiltin: false,
    cardCountPerNote: input.cardCountPerNote ?? 1,
    frontFormat: input.frontFormat,
    backFormat: input.backFormat,
    css: input.css ?? '',
    sortOrder: 0,
    fields,
    createdAt: now,
    updatedAt: now,
  };
}

export function deleteTemplate(db: DatabaseAdapter, templateId: string): boolean {
  const tpl = getTemplateById(db, templateId);
  if (!tpl) return false;
  if (tpl.isBuiltin) throw new Error('Cannot delete built-in template.');
  db.execute(`DELETE FROM fl_templates WHERE id = ?`, [templateId]);
  return true;
}
