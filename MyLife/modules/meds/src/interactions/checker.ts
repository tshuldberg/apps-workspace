import type { DatabaseAdapter } from '@mylife/db';
import type { InteractionWarning } from '../models/interaction';
import { ADDITIONAL_INTERACTIONS } from './database';

/**
 * Seed additional bundled interactions beyond the 50 in migration v2.
 * Idempotent: uses INSERT OR IGNORE so it can be called multiple times.
 */
export function seedAdditionalInteractions(db: DatabaseAdapter): void {
  db.transaction(() => {
    for (const ix of ADDITIONAL_INTERACTIONS) {
      db.execute(
        `INSERT OR IGNORE INTO md_interactions (id, drug_a, drug_b, severity, description, source)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ix.id, ix.drugA, ix.drugB, ix.severity, ix.description, ix.source],
      );
    }
  });
}

/**
 * Check a drug against a list of active medication names for interactions.
 * Case-insensitive matching. Returns warnings for any found interactions.
 */
export function checkInteractions(
  db: DatabaseAdapter,
  drugName: string,
  activeMedNames: string[],
): InteractionWarning[] {
  if (activeMedNames.length === 0) return [];

  const normalizedDrug = drugName.toLowerCase().trim();
  const normalizedActive = activeMedNames.map((n) => n.toLowerCase().trim());
  const warnings: InteractionWarning[] = [];

  // Build a single query to find all interactions involving our drug
  const rows = db.query<{
    drug_a: string;
    drug_b: string;
    severity: string;
    description: string;
  }>(
    `SELECT drug_a, drug_b, severity, description FROM md_interactions
     WHERE LOWER(drug_a) = ? OR LOWER(drug_b) = ?`,
    [normalizedDrug, normalizedDrug],
  );

  for (const row of rows) {
    const drugA = row.drug_a.toLowerCase();
    const drugB = row.drug_b.toLowerCase();
    // Determine which is the "other" drug in this pair
    const other = drugA === normalizedDrug ? drugB : drugA;

    // Check if the other drug matches any active medication
    if (normalizedActive.includes(other)) {
      warnings.push({
        drug: other,
        severity: row.severity as InteractionWarning['severity'],
        description: row.description,
      });
    }
  }

  return warnings;
}

/**
 * Get all known interactions for a specific medication by its database ID.
 * Looks up the medication name, then finds all interaction pairs involving it.
 */
export function getInteractionsForMedication(
  db: DatabaseAdapter,
  medicationId: string,
): InteractionWarning[] {
  // First, get the medication name
  const meds = db.query<{ name: string }>(
    'SELECT name FROM md_medications WHERE id = ?',
    [medicationId],
  );
  if (meds.length === 0) return [];

  const medName = meds[0].name.toLowerCase().trim();

  const rows = db.query<{
    drug_a: string;
    drug_b: string;
    severity: string;
    description: string;
  }>(
    `SELECT drug_a, drug_b, severity, description FROM md_interactions
     WHERE LOWER(drug_a) = ? OR LOWER(drug_b) = ?`,
    [medName, medName],
  );

  return rows.map((row) => {
    const other = row.drug_a.toLowerCase() === medName ? row.drug_b : row.drug_a;
    return {
      drug: other,
      severity: row.severity as InteractionWarning['severity'],
      description: row.description,
    };
  });
}
