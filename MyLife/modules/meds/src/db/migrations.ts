import type { Migration } from '@mylife/module-registry';
import { V2_TABLES, V2_INDEXES } from './schema';

// -- ALTER TABLE statements for extending md_medications ---------------------
const ALTER_MEDICATIONS = [
  `ALTER TABLE md_medications ADD COLUMN pill_count INTEGER`,
  `ALTER TABLE md_medications ADD COLUMN pills_per_dose INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE md_medications ADD COLUMN time_slots TEXT DEFAULT '[]'`,
  `ALTER TABLE md_medications ADD COLUMN end_date TEXT`,
];

// -- Top 50 common drug interactions (seed data) ----------------------------
const SEED_INTERACTIONS = [
  `INSERT OR IGNORE INTO md_interactions (id, drug_a, drug_b, severity, description, source) VALUES
    ('int-001', 'warfarin', 'aspirin', 'severe', 'Increased risk of bleeding when combined', 'FDA'),
    ('int-002', 'warfarin', 'ibuprofen', 'severe', 'NSAIDs increase anticoagulant effect and bleeding risk', 'FDA'),
    ('int-003', 'metformin', 'alcohol', 'moderate', 'Alcohol increases risk of lactic acidosis with metformin', 'FDA'),
    ('int-004', 'lisinopril', 'potassium', 'moderate', 'ACE inhibitors increase potassium levels; supplements may cause hyperkalemia', 'FDA'),
    ('int-005', 'simvastatin', 'grapefruit', 'moderate', 'Grapefruit inhibits CYP3A4, increasing statin levels and risk of rhabdomyolysis', 'FDA'),
    ('int-006', 'methotrexate', 'ibuprofen', 'severe', 'NSAIDs reduce renal clearance of methotrexate, increasing toxicity', 'FDA'),
    ('int-007', 'fluoxetine', 'tramadol', 'severe', 'Serotonin syndrome risk from combined serotonergic agents', 'FDA'),
    ('int-008', 'ciprofloxacin', 'antacids', 'moderate', 'Antacids reduce absorption of fluoroquinolone antibiotics', 'FDA'),
    ('int-009', 'amiodarone', 'simvastatin', 'severe', 'Amiodarone increases statin levels; risk of myopathy', 'FDA'),
    ('int-010', 'digoxin', 'amiodarone', 'severe', 'Amiodarone increases digoxin levels, risk of toxicity', 'FDA'),
    ('int-011', 'clopidogrel', 'omeprazole', 'moderate', 'PPIs reduce antiplatelet effect of clopidogrel via CYP2C19 inhibition', 'FDA'),
    ('int-012', 'ssri', 'maoi', 'severe', 'Serotonin syndrome risk; contraindicated combination', 'FDA'),
    ('int-013', 'lithium', 'ibuprofen', 'moderate', 'NSAIDs increase lithium levels by reducing renal clearance', 'FDA'),
    ('int-014', 'metronidazole', 'alcohol', 'severe', 'Disulfiram-like reaction: nausea, vomiting, flushing', 'FDA'),
    ('int-015', 'sildenafil', 'nitroglycerin', 'severe', 'Severe hypotension when PDE5 inhibitors combined with nitrates', 'FDA'),
    ('int-016', 'theophylline', 'ciprofloxacin', 'severe', 'Ciprofloxacin inhibits theophylline metabolism, risk of toxicity', 'FDA'),
    ('int-017', 'warfarin', 'acetaminophen', 'mild', 'High-dose acetaminophen may increase INR in warfarin patients', 'FDA'),
    ('int-018', 'tetracycline', 'calcium', 'moderate', 'Calcium chelates tetracycline, reducing absorption', 'FDA'),
    ('int-019', 'levothyroxine', 'calcium', 'moderate', 'Calcium reduces levothyroxine absorption; separate by 4 hours', 'FDA'),
    ('int-020', 'levothyroxine', 'iron', 'moderate', 'Iron reduces levothyroxine absorption; separate by 4 hours', 'FDA'),
    ('int-021', 'carbamazepine', 'oral_contraceptives', 'moderate', 'Carbamazepine induces CYP3A4, reducing contraceptive efficacy', 'FDA'),
    ('int-022', 'phenytoin', 'warfarin', 'severe', 'Complex interaction: may increase or decrease warfarin effect', 'FDA'),
    ('int-023', 'erythromycin', 'simvastatin', 'severe', 'CYP3A4 inhibition increases statin levels and myopathy risk', 'FDA'),
    ('int-024', 'ketoconazole', 'midazolam', 'severe', 'Ketoconazole inhibits CYP3A4, greatly increasing benzodiazepine levels', 'FDA'),
    ('int-025', 'spironolactone', 'potassium', 'severe', 'Combined use causes dangerous hyperkalemia', 'FDA'),
    ('int-026', 'ace_inhibitors', 'spironolactone', 'moderate', 'Combined use increases hyperkalemia risk', 'FDA'),
    ('int-027', 'ssri', 'nsaids', 'moderate', 'Increased GI bleeding risk when SSRIs combined with NSAIDs', 'FDA'),
    ('int-028', 'benzodiazepines', 'opioids', 'severe', 'Respiratory depression and sedation risk; FDA black box warning', 'FDA'),
    ('int-029', 'rifampin', 'oral_contraceptives', 'severe', 'Rifampin strongly induces CYP3A4, reducing contraceptive efficacy', 'FDA'),
    ('int-030', 'clarithromycin', 'colchicine', 'severe', 'CYP3A4 inhibition increases colchicine toxicity risk', 'FDA'),
    ('int-031', 'prednisone', 'nsaids', 'moderate', 'Increased GI ulceration and bleeding risk', 'FDA'),
    ('int-032', 'allopurinol', 'azathioprine', 'severe', 'Allopurinol inhibits xanthine oxidase, increasing azathioprine toxicity', 'FDA'),
    ('int-033', 'potassium', 'trimethoprim', 'moderate', 'Trimethoprim reduces renal potassium excretion; hyperkalemia risk', 'FDA'),
    ('int-034', 'verapamil', 'beta_blockers', 'severe', 'Additive cardiac depression; risk of bradycardia and heart block', 'FDA'),
    ('int-035', 'cyclosporine', 'nsaids', 'moderate', 'NSAIDs increase cyclosporine nephrotoxicity', 'FDA'),
    ('int-036', 'doxycycline', 'antacids', 'moderate', 'Antacids chelate doxycycline, reducing absorption', 'FDA'),
    ('int-037', 'sertraline', 'tramadol', 'severe', 'Serotonin syndrome risk; both increase serotonin activity', 'FDA'),
    ('int-038', 'alprazolam', 'ketoconazole', 'severe', 'CYP3A4 inhibition greatly increases alprazolam levels', 'FDA'),
    ('int-039', 'atorvastatin', 'grapefruit', 'mild', 'Grapefruit may modestly increase atorvastatin levels', 'FDA'),
    ('int-040', 'diazepam', 'alcohol', 'severe', 'Enhanced CNS depression; respiratory depression risk', 'FDA'),
    ('int-041', 'diltiazem', 'simvastatin', 'moderate', 'Diltiazem inhibits CYP3A4, increasing statin levels', 'FDA'),
    ('int-042', 'furosemide', 'gentamicin', 'severe', 'Both are ototoxic; combined use increases hearing damage risk', 'FDA'),
    ('int-043', 'insulin', 'beta_blockers', 'moderate', 'Beta blockers mask hypoglycemia symptoms in diabetic patients', 'FDA'),
    ('int-044', 'metformin', 'contrast_dye', 'severe', 'Iodinated contrast may cause lactic acidosis with metformin', 'FDA'),
    ('int-045', 'phenobarbital', 'warfarin', 'moderate', 'Phenobarbital induces warfarin metabolism, reducing efficacy', 'FDA'),
    ('int-046', 'quinidine', 'digoxin', 'severe', 'Quinidine doubles digoxin levels; toxicity risk', 'FDA'),
    ('int-047', 'tamoxifen', 'paroxetine', 'severe', 'Paroxetine inhibits CYP2D6, reducing tamoxifen active metabolite', 'FDA'),
    ('int-048', 'valproic_acid', 'lamotrigine', 'moderate', 'Valproate doubles lamotrigine half-life; dose reduction needed', 'FDA'),
    ('int-049', 'amoxicillin', 'methotrexate', 'moderate', 'Penicillins may reduce methotrexate renal clearance', 'FDA'),
    ('int-050', 'propranolol', 'epinephrine', 'severe', 'Beta blockade with epinephrine causes severe hypertension and bradycardia', 'FDA')`,
];

export const MEDS_MIGRATION_V2: Migration = {
  version: 2,
  description: 'Extended meds schema: dose logs, reminders, refills, interactions, measurements, mood, symptoms',
  up: [
    // Extend md_medications with new columns
    ...ALTER_MEDICATIONS,
    // Create new tables
    ...V2_TABLES,
    // Create indexes for new tables
    ...V2_INDEXES,
    // Seed interaction data
    ...SEED_INTERACTIONS,
  ],
  down: [
    'DROP TABLE IF EXISTS md_symptom_logs',
    'DROP TABLE IF EXISTS md_symptoms',
    'DROP TABLE IF EXISTS md_mood_activities',
    'DROP TABLE IF EXISTS md_mood_entries',
    'DROP TABLE IF EXISTS md_measurements',
    'DROP TABLE IF EXISTS md_interactions',
    'DROP TABLE IF EXISTS md_refills',
    'DROP TABLE IF EXISTS md_reminders',
    'DROP TABLE IF EXISTS md_dose_logs',
  ],
};
