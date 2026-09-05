// Extended drug interaction database -- top 200 medications
// These supplement the 50 interactions seeded in migration v2.

export interface BundledInteraction {
  readonly id: string;
  readonly drugA: string;
  readonly drugB: string;
  readonly severity: 'mild' | 'moderate' | 'severe';
  readonly description: string;
  readonly source: string;
}

/**
 * Additional drug interactions beyond the 50 in the migration seed.
 * IDs start at int-051 to avoid collisions with migration-seeded data.
 */
export const ADDITIONAL_INTERACTIONS: readonly BundledInteraction[] = [
  // -- Anticoagulant interactions -----------------------------------------------
  { id: 'int-051', drugA: 'warfarin', drugB: 'vitamin_k', severity: 'moderate', description: 'Vitamin K antagonizes warfarin; dietary changes may destabilize INR', source: 'FDA' },
  { id: 'int-052', drugA: 'warfarin', drugB: 'fluconazole', severity: 'severe', description: 'Fluconazole inhibits CYP2C9, significantly increasing warfarin levels', source: 'FDA' },
  { id: 'int-053', drugA: 'warfarin', drugB: 'amiodarone', severity: 'severe', description: 'Amiodarone inhibits warfarin metabolism; INR may double', source: 'FDA' },
  { id: 'int-054', drugA: 'warfarin', drugB: 'metronidazole', severity: 'severe', description: 'Metronidazole inhibits warfarin metabolism, increasing bleeding risk', source: 'FDA' },
  { id: 'int-055', drugA: 'warfarin', drugB: 'sulfamethoxazole', severity: 'severe', description: 'Sulfamethoxazole inhibits CYP2C9, potentiating warfarin effect', source: 'FDA' },
  { id: 'int-056', drugA: 'apixaban', drugB: 'ketoconazole', severity: 'severe', description: 'Strong CYP3A4 inhibition increases apixaban levels and bleeding risk', source: 'FDA' },
  { id: 'int-057', drugA: 'rivaroxaban', drugB: 'ketoconazole', severity: 'severe', description: 'CYP3A4/P-gp inhibition increases rivaroxaban exposure', source: 'FDA' },
  { id: 'int-058', drugA: 'dabigatran', drugB: 'amiodarone', severity: 'moderate', description: 'P-gp inhibition by amiodarone increases dabigatran levels', source: 'FDA' },

  // -- SSRI/SNRI interactions ---------------------------------------------------
  { id: 'int-059', drugA: 'fluoxetine', drugB: 'maoi', severity: 'severe', description: 'Serotonin syndrome risk; wait 5 weeks after fluoxetine before starting MAOI', source: 'FDA' },
  { id: 'int-060', drugA: 'sertraline', drugB: 'maoi', severity: 'severe', description: 'Serotonin syndrome risk; contraindicated combination', source: 'FDA' },
  { id: 'int-061', drugA: 'paroxetine', drugB: 'maoi', severity: 'severe', description: 'Serotonin syndrome risk; contraindicated combination', source: 'FDA' },
  { id: 'int-062', drugA: 'fluoxetine', drugB: 'nsaids', severity: 'moderate', description: 'Increased GI bleeding risk when SSRIs combined with NSAIDs', source: 'FDA' },
  { id: 'int-063', drugA: 'sertraline', drugB: 'nsaids', severity: 'moderate', description: 'Increased GI bleeding risk with SSRI/NSAID combination', source: 'FDA' },
  { id: 'int-064', drugA: 'venlafaxine', drugB: 'tramadol', severity: 'severe', description: 'Serotonin syndrome risk from combined serotonergic agents', source: 'FDA' },
  { id: 'int-065', drugA: 'duloxetine', drugB: 'tramadol', severity: 'severe', description: 'Serotonin syndrome risk; both increase serotonin', source: 'FDA' },
  { id: 'int-066', drugA: 'fluoxetine', drugB: 'metoprolol', severity: 'moderate', description: 'Fluoxetine inhibits CYP2D6, increasing metoprolol levels and bradycardia risk', source: 'FDA' },
  { id: 'int-067', drugA: 'paroxetine', drugB: 'metoprolol', severity: 'moderate', description: 'Paroxetine inhibits CYP2D6, increasing metoprolol levels', source: 'FDA' },
  { id: 'int-068', drugA: 'citalopram', drugB: 'omeprazole', severity: 'moderate', description: 'Omeprazole inhibits CYP2C19, increasing citalopram levels', source: 'FDA' },
  { id: 'int-069', drugA: 'escitalopram', drugB: 'tramadol', severity: 'severe', description: 'Serotonin syndrome risk; both increase serotonergic activity', source: 'FDA' },

  // -- Statin interactions ------------------------------------------------------
  { id: 'int-070', drugA: 'atorvastatin', drugB: 'clarithromycin', severity: 'severe', description: 'CYP3A4 inhibition increases statin levels and myopathy risk', source: 'FDA' },
  { id: 'int-071', drugA: 'simvastatin', drugB: 'cyclosporine', severity: 'severe', description: 'Cyclosporine greatly increases simvastatin levels; myopathy risk', source: 'FDA' },
  { id: 'int-072', drugA: 'lovastatin', drugB: 'erythromycin', severity: 'severe', description: 'CYP3A4 inhibition increases lovastatin levels and rhabdomyolysis risk', source: 'FDA' },
  { id: 'int-073', drugA: 'rosuvastatin', drugB: 'gemfibrozil', severity: 'severe', description: 'Gemfibrozil increases rosuvastatin exposure; myopathy risk', source: 'FDA' },
  { id: 'int-074', drugA: 'atorvastatin', drugB: 'cyclosporine', severity: 'severe', description: 'Cyclosporine increases atorvastatin levels; use lowest dose', source: 'FDA' },
  { id: 'int-075', drugA: 'simvastatin', drugB: 'niacin', severity: 'moderate', description: 'Combined use increases risk of myopathy', source: 'FDA' },
  { id: 'int-076', drugA: 'atorvastatin', drugB: 'diltiazem', severity: 'moderate', description: 'Diltiazem increases atorvastatin levels via CYP3A4 inhibition', source: 'FDA' },

  // -- Diabetes medication interactions -----------------------------------------
  { id: 'int-077', drugA: 'metformin', drugB: 'cimetidine', severity: 'moderate', description: 'Cimetidine reduces renal clearance of metformin', source: 'FDA' },
  { id: 'int-078', drugA: 'glipizide', drugB: 'fluconazole', severity: 'moderate', description: 'Fluconazole inhibits sulfonylurea metabolism; hypoglycemia risk', source: 'FDA' },
  { id: 'int-079', drugA: 'insulin', drugB: 'ace_inhibitors', severity: 'moderate', description: 'ACE inhibitors may enhance insulin sensitivity; hypoglycemia risk', source: 'FDA' },
  { id: 'int-080', drugA: 'glyburide', drugB: 'fluconazole', severity: 'moderate', description: 'Fluconazole increases sulfonylurea levels; hypoglycemia risk', source: 'FDA' },
  { id: 'int-081', drugA: 'pioglitazone', drugB: 'gemfibrozil', severity: 'moderate', description: 'Gemfibrozil increases pioglitazone exposure via CYP2C8 inhibition', source: 'FDA' },

  // -- Blood pressure medication interactions -----------------------------------
  { id: 'int-082', drugA: 'lisinopril', drugB: 'spironolactone', severity: 'moderate', description: 'Combined use increases hyperkalemia risk', source: 'FDA' },
  { id: 'int-083', drugA: 'enalapril', drugB: 'potassium', severity: 'moderate', description: 'ACE inhibitors with potassium supplements increase hyperkalemia risk', source: 'FDA' },
  { id: 'int-084', drugA: 'losartan', drugB: 'potassium', severity: 'moderate', description: 'ARBs with potassium supplements increase hyperkalemia risk', source: 'FDA' },
  { id: 'int-085', drugA: 'amlodipine', drugB: 'simvastatin', severity: 'moderate', description: 'Amlodipine increases simvastatin levels; limit simvastatin to 20mg', source: 'FDA' },
  { id: 'int-086', drugA: 'verapamil', drugB: 'digoxin', severity: 'severe', description: 'Verapamil increases digoxin levels; toxicity risk', source: 'FDA' },
  { id: 'int-087', drugA: 'diltiazem', drugB: 'beta_blockers', severity: 'severe', description: 'Additive cardiac depression; bradycardia and heart block risk', source: 'FDA' },
  { id: 'int-088', drugA: 'clonidine', drugB: 'beta_blockers', severity: 'severe', description: 'Rebound hypertension if clonidine stopped while on beta blockers', source: 'FDA' },
  { id: 'int-089', drugA: 'lisinopril', drugB: 'nsaids', severity: 'moderate', description: 'NSAIDs reduce antihypertensive effect and increase renal risk', source: 'FDA' },
  { id: 'int-090', drugA: 'losartan', drugB: 'nsaids', severity: 'moderate', description: 'NSAIDs reduce ARB efficacy and increase renal impairment risk', source: 'FDA' },

  // -- Opioid interactions ------------------------------------------------------
  { id: 'int-091', drugA: 'oxycodone', drugB: 'benzodiazepines', severity: 'severe', description: 'Respiratory depression risk; FDA black box warning', source: 'FDA' },
  { id: 'int-092', drugA: 'hydrocodone', drugB: 'benzodiazepines', severity: 'severe', description: 'Respiratory depression risk; FDA black box warning', source: 'FDA' },
  { id: 'int-093', drugA: 'codeine', drugB: 'benzodiazepines', severity: 'severe', description: 'Respiratory depression risk; avoid combination', source: 'FDA' },
  { id: 'int-094', drugA: 'morphine', drugB: 'benzodiazepines', severity: 'severe', description: 'Respiratory depression; FDA black box warning', source: 'FDA' },
  { id: 'int-095', drugA: 'fentanyl', drugB: 'benzodiazepines', severity: 'severe', description: 'Life-threatening respiratory depression; FDA black box warning', source: 'FDA' },
  { id: 'int-096', drugA: 'tramadol', drugB: 'ssri', severity: 'severe', description: 'Serotonin syndrome risk and lowered seizure threshold', source: 'FDA' },
  { id: 'int-097', drugA: 'oxycodone', drugB: 'alcohol', severity: 'severe', description: 'Enhanced CNS depression and respiratory depression risk', source: 'FDA' },
  { id: 'int-098', drugA: 'methadone', drugB: 'benzodiazepines', severity: 'severe', description: 'Fatal respiratory depression; FDA black box warning', source: 'FDA' },
  { id: 'int-099', drugA: 'hydrocodone', drugB: 'muscle_relaxants', severity: 'moderate', description: 'Additive CNS depression; excessive sedation', source: 'FDA' },

  // -- Antibiotic interactions --------------------------------------------------
  { id: 'int-100', drugA: 'ciprofloxacin', drugB: 'warfarin', severity: 'severe', description: 'Ciprofloxacin inhibits warfarin metabolism; increased bleeding risk', source: 'FDA' },
  { id: 'int-101', drugA: 'clarithromycin', drugB: 'simvastatin', severity: 'severe', description: 'CYP3A4 inhibition increases statin levels; myopathy risk', source: 'FDA' },
  { id: 'int-102', drugA: 'azithromycin', drugB: 'amiodarone', severity: 'severe', description: 'QT prolongation risk with combined use', source: 'FDA' },
  { id: 'int-103', drugA: 'metronidazole', drugB: 'lithium', severity: 'moderate', description: 'Metronidazole may increase lithium levels', source: 'FDA' },
  { id: 'int-104', drugA: 'trimethoprim', drugB: 'ace_inhibitors', severity: 'moderate', description: 'Combined hyperkalemia risk', source: 'FDA' },
  { id: 'int-105', drugA: 'rifampin', drugB: 'warfarin', severity: 'severe', description: 'Rifampin strongly induces warfarin metabolism; reduced efficacy', source: 'FDA' },
  { id: 'int-106', drugA: 'rifampin', drugB: 'simvastatin', severity: 'severe', description: 'Rifampin induces CYP3A4; reduces statin levels significantly', source: 'FDA' },
  { id: 'int-107', drugA: 'linezolid', drugB: 'ssri', severity: 'severe', description: 'Linezolid is a weak MAOI; serotonin syndrome risk with SSRIs', source: 'FDA' },
  { id: 'int-108', drugA: 'fluoroquinolones', drugB: 'theophylline', severity: 'severe', description: 'Fluoroquinolones inhibit theophylline metabolism; seizure risk', source: 'FDA' },

  // -- Cardiac drug interactions ------------------------------------------------
  { id: 'int-109', drugA: 'digoxin', drugB: 'verapamil', severity: 'severe', description: 'Verapamil increases digoxin levels and additive AV block risk', source: 'FDA' },
  { id: 'int-110', drugA: 'digoxin', drugB: 'clarithromycin', severity: 'severe', description: 'Clarithromycin increases digoxin levels via P-gp inhibition', source: 'FDA' },
  { id: 'int-111', drugA: 'amiodarone', drugB: 'warfarin', severity: 'severe', description: 'Amiodarone inhibits warfarin metabolism; reduce warfarin dose by 30-50%', source: 'FDA' },
  { id: 'int-112', drugA: 'amiodarone', drugB: 'metoprolol', severity: 'moderate', description: 'Additive bradycardia and conduction delay', source: 'FDA' },
  { id: 'int-113', drugA: 'sotalol', drugB: 'amiodarone', severity: 'severe', description: 'QT prolongation risk; combined use contraindicated', source: 'FDA' },
  { id: 'int-114', drugA: 'flecainide', drugB: 'amiodarone', severity: 'severe', description: 'Amiodarone increases flecainide levels; proarrhythmia risk', source: 'FDA' },

  // -- Psychiatric medication interactions --------------------------------------
  { id: 'int-115', drugA: 'lithium', drugB: 'ace_inhibitors', severity: 'moderate', description: 'ACE inhibitors reduce lithium clearance; toxicity risk', source: 'FDA' },
  { id: 'int-116', drugA: 'lithium', drugB: 'thiazide_diuretics', severity: 'moderate', description: 'Thiazides reduce lithium clearance; monitor levels closely', source: 'FDA' },
  { id: 'int-117', drugA: 'carbamazepine', drugB: 'erythromycin', severity: 'severe', description: 'Erythromycin inhibits carbamazepine metabolism; toxicity risk', source: 'FDA' },
  { id: 'int-118', drugA: 'carbamazepine', drugB: 'valproic_acid', severity: 'moderate', description: 'Complex interaction; carbamazepine reduces valproate levels', source: 'FDA' },
  { id: 'int-119', drugA: 'quetiapine', drugB: 'ketoconazole', severity: 'severe', description: 'CYP3A4 inhibition increases quetiapine levels significantly', source: 'FDA' },
  { id: 'int-120', drugA: 'clozapine', drugB: 'fluvoxamine', severity: 'severe', description: 'Fluvoxamine inhibits CYP1A2; clozapine levels may triple', source: 'FDA' },
  { id: 'int-121', drugA: 'haloperidol', drugB: 'lithium', severity: 'moderate', description: 'Rare encephalopathic syndrome reported with combination', source: 'FDA' },
  { id: 'int-122', drugA: 'aripiprazole', drugB: 'fluoxetine', severity: 'moderate', description: 'CYP2D6 inhibition increases aripiprazole levels; reduce dose', source: 'FDA' },

  // -- Seizure medication interactions ------------------------------------------
  { id: 'int-123', drugA: 'phenytoin', drugB: 'carbamazepine', severity: 'moderate', description: 'Complex interaction; both are enzyme inducers affecting each other', source: 'FDA' },
  { id: 'int-124', drugA: 'phenytoin', drugB: 'valproic_acid', severity: 'moderate', description: 'Valproate displaces phenytoin from protein binding', source: 'FDA' },
  { id: 'int-125', drugA: 'phenytoin', drugB: 'oral_contraceptives', severity: 'moderate', description: 'Phenytoin induces CYP3A4; reduced contraceptive efficacy', source: 'FDA' },
  { id: 'int-126', drugA: 'phenobarbital', drugB: 'oral_contraceptives', severity: 'moderate', description: 'Phenobarbital induces metabolism; reduced contraceptive efficacy', source: 'FDA' },
  { id: 'int-127', drugA: 'topiramate', drugB: 'oral_contraceptives', severity: 'moderate', description: 'Topiramate reduces estrogen levels at doses above 200mg/day', source: 'FDA' },

  // -- Immunosuppressant interactions -------------------------------------------
  { id: 'int-128', drugA: 'cyclosporine', drugB: 'ketoconazole', severity: 'severe', description: 'CYP3A4 inhibition increases cyclosporine levels; nephrotoxicity risk', source: 'FDA' },
  { id: 'int-129', drugA: 'cyclosporine', drugB: 'st_johns_wort', severity: 'severe', description: 'St. Johns Wort induces CYP3A4; organ rejection risk', source: 'FDA' },
  { id: 'int-130', drugA: 'tacrolimus', drugB: 'ketoconazole', severity: 'severe', description: 'CYP3A4 inhibition significantly increases tacrolimus levels', source: 'FDA' },
  { id: 'int-131', drugA: 'tacrolimus', drugB: 'nsaids', severity: 'moderate', description: 'Additive nephrotoxicity with NSAID combination', source: 'FDA' },
  { id: 'int-132', drugA: 'mycophenolate', drugB: 'antacids', severity: 'moderate', description: 'Antacids reduce mycophenolate absorption', source: 'FDA' },

  // -- GI medication interactions -----------------------------------------------
  { id: 'int-133', drugA: 'omeprazole', drugB: 'methotrexate', severity: 'moderate', description: 'PPIs may delay methotrexate elimination; toxicity risk', source: 'FDA' },
  { id: 'int-134', drugA: 'omeprazole', drugB: 'clopidogrel', severity: 'moderate', description: 'CYP2C19 inhibition reduces clopidogrel activation', source: 'FDA' },
  { id: 'int-135', drugA: 'pantoprazole', drugB: 'methotrexate', severity: 'moderate', description: 'PPIs may reduce methotrexate excretion', source: 'FDA' },
  { id: 'int-136', drugA: 'sucralfate', drugB: 'fluoroquinolones', severity: 'moderate', description: 'Sucralfate chelates fluoroquinolones; separate by 2 hours', source: 'FDA' },
  { id: 'int-137', drugA: 'metoclopramide', drugB: 'levodopa', severity: 'moderate', description: 'Metoclopramide blocks dopamine; reduces levodopa efficacy', source: 'FDA' },

  // -- Pain/anti-inflammatory interactions --------------------------------------
  { id: 'int-138', drugA: 'ibuprofen', drugB: 'aspirin', severity: 'moderate', description: 'Ibuprofen may reduce aspirin cardioprotective effect', source: 'FDA' },
  { id: 'int-139', drugA: 'naproxen', drugB: 'lithium', severity: 'moderate', description: 'NSAIDs reduce lithium renal clearance; toxicity risk', source: 'FDA' },
  { id: 'int-140', drugA: 'celecoxib', drugB: 'warfarin', severity: 'moderate', description: 'COX-2 inhibitors may increase warfarin effect and bleeding risk', source: 'FDA' },
  { id: 'int-141', drugA: 'aspirin', drugB: 'methotrexate', severity: 'severe', description: 'Aspirin reduces methotrexate clearance; toxicity risk', source: 'FDA' },
  { id: 'int-142', drugA: 'acetaminophen', drugB: 'alcohol', severity: 'moderate', description: 'Chronic alcohol use increases hepatotoxicity risk with acetaminophen', source: 'FDA' },
  { id: 'int-143', drugA: 'pregabalin', drugB: 'opioids', severity: 'severe', description: 'Additive CNS depression; respiratory depression risk', source: 'FDA' },
  { id: 'int-144', drugA: 'gabapentin', drugB: 'opioids', severity: 'severe', description: 'Additive CNS depression; FDA warning for respiratory depression', source: 'FDA' },

  // -- Thyroid medication interactions ------------------------------------------
  { id: 'int-145', drugA: 'levothyroxine', drugB: 'antacids', severity: 'moderate', description: 'Antacids reduce levothyroxine absorption; separate by 4 hours', source: 'FDA' },
  { id: 'int-146', drugA: 'levothyroxine', drugB: 'warfarin', severity: 'moderate', description: 'Thyroid hormones increase warfarin sensitivity; INR monitoring needed', source: 'FDA' },
  { id: 'int-147', drugA: 'levothyroxine', drugB: 'sucralfate', severity: 'moderate', description: 'Sucralfate reduces levothyroxine absorption', source: 'FDA' },
  { id: 'int-148', drugA: 'levothyroxine', drugB: 'cholestyramine', severity: 'moderate', description: 'Cholestyramine binds thyroid hormone; separate by 4 hours', source: 'FDA' },

  // -- Muscle relaxant interactions ---------------------------------------------
  { id: 'int-149', drugA: 'cyclobenzaprine', drugB: 'maoi', severity: 'severe', description: 'Serotonin syndrome and hyperpyretic crisis risk', source: 'FDA' },
  { id: 'int-150', drugA: 'cyclobenzaprine', drugB: 'ssri', severity: 'moderate', description: 'Serotonin syndrome risk; cyclobenzaprine is structurally similar to TCAs', source: 'FDA' },
  { id: 'int-151', drugA: 'baclofen', drugB: 'opioids', severity: 'severe', description: 'Additive CNS depression; respiratory depression risk', source: 'FDA' },
  { id: 'int-152', drugA: 'tizanidine', drugB: 'ciprofloxacin', severity: 'severe', description: 'Ciprofloxacin inhibits CYP1A2; tizanidine levels increase 10-fold', source: 'FDA' },
  { id: 'int-153', drugA: 'tizanidine', drugB: 'fluvoxamine', severity: 'severe', description: 'Fluvoxamine inhibits CYP1A2; tizanidine levels increase 33-fold', source: 'FDA' },

  // -- Antifungal interactions --------------------------------------------------
  { id: 'int-154', drugA: 'itraconazole', drugB: 'simvastatin', severity: 'severe', description: 'CYP3A4 inhibition; rhabdomyolysis risk with statins', source: 'FDA' },
  { id: 'int-155', drugA: 'fluconazole', drugB: 'phenytoin', severity: 'moderate', description: 'Fluconazole inhibits phenytoin metabolism; toxicity risk', source: 'FDA' },
  { id: 'int-156', drugA: 'ketoconazole', drugB: 'cyclosporine', severity: 'severe', description: 'CYP3A4 inhibition greatly increases cyclosporine levels', source: 'FDA' },
  { id: 'int-157', drugA: 'voriconazole', drugB: 'sirolimus', severity: 'severe', description: 'Voriconazole increases sirolimus levels dramatically; contraindicated', source: 'FDA' },

  // -- Herbal/supplement interactions -------------------------------------------
  { id: 'int-158', drugA: 'st_johns_wort', drugB: 'ssri', severity: 'severe', description: 'Serotonin syndrome risk; both increase serotonin', source: 'FDA' },
  { id: 'int-159', drugA: 'st_johns_wort', drugB: 'oral_contraceptives', severity: 'moderate', description: 'St. Johns Wort induces CYP3A4; reduced contraceptive efficacy', source: 'FDA' },
  { id: 'int-160', drugA: 'st_johns_wort', drugB: 'warfarin', severity: 'severe', description: 'CYP induction reduces warfarin levels; clotting risk', source: 'FDA' },
  { id: 'int-161', drugA: 'ginkgo', drugB: 'warfarin', severity: 'moderate', description: 'Ginkgo has antiplatelet effects; increased bleeding risk', source: 'FDA' },
  { id: 'int-162', drugA: 'ginkgo', drugB: 'aspirin', severity: 'moderate', description: 'Combined antiplatelet effects increase bleeding risk', source: 'FDA' },
  { id: 'int-163', drugA: 'garlic_supplements', drugB: 'warfarin', severity: 'mild', description: 'Garlic may have mild antiplatelet effects', source: 'FDA' },
  { id: 'int-164', drugA: 'fish_oil', drugB: 'warfarin', severity: 'mild', description: 'Fish oil may have mild anticoagulant effect', source: 'FDA' },
  { id: 'int-165', drugA: 'kava', drugB: 'benzodiazepines', severity: 'moderate', description: 'Additive sedation and hepatotoxicity risk', source: 'FDA' },

  // -- HIV/antiviral interactions -----------------------------------------------
  { id: 'int-166', drugA: 'ritonavir', drugB: 'simvastatin', severity: 'severe', description: 'Ritonavir greatly increases statin levels; contraindicated', source: 'FDA' },
  { id: 'int-167', drugA: 'ritonavir', drugB: 'midazolam', severity: 'severe', description: 'CYP3A4 inhibition increases midazolam levels dramatically', source: 'FDA' },
  { id: 'int-168', drugA: 'ritonavir', drugB: 'oral_contraceptives', severity: 'moderate', description: 'Ritonavir may reduce ethinyl estradiol levels', source: 'FDA' },
  { id: 'int-169', drugA: 'efavirenz', drugB: 'oral_contraceptives', severity: 'moderate', description: 'Efavirenz induces CYP3A4; reduced contraceptive efficacy', source: 'FDA' },

  // -- Corticosteroid interactions ----------------------------------------------
  { id: 'int-170', drugA: 'prednisone', drugB: 'warfarin', severity: 'moderate', description: 'Corticosteroids may alter warfarin effect; monitor INR', source: 'FDA' },
  { id: 'int-171', drugA: 'prednisone', drugB: 'insulin', severity: 'moderate', description: 'Corticosteroids raise blood sugar; may need insulin dose adjustment', source: 'FDA' },
  { id: 'int-172', drugA: 'dexamethasone', drugB: 'phenytoin', severity: 'moderate', description: 'Phenytoin induces dexamethasone metabolism; reduced steroid effect', source: 'FDA' },

  // -- Diuretic interactions ----------------------------------------------------
  { id: 'int-173', drugA: 'furosemide', drugB: 'lithium', severity: 'moderate', description: 'Loop diuretics reduce lithium clearance; toxicity risk', source: 'FDA' },
  { id: 'int-174', drugA: 'hydrochlorothiazide', drugB: 'lithium', severity: 'moderate', description: 'Thiazides reduce lithium clearance; monitor levels', source: 'FDA' },
  { id: 'int-175', drugA: 'furosemide', drugB: 'nsaids', severity: 'moderate', description: 'NSAIDs reduce diuretic efficacy and increase renal risk', source: 'FDA' },
  { id: 'int-176', drugA: 'hydrochlorothiazide', drugB: 'nsaids', severity: 'moderate', description: 'NSAIDs blunt diuretic and antihypertensive effects', source: 'FDA' },
  { id: 'int-177', drugA: 'spironolactone', drugB: 'ace_inhibitors', severity: 'moderate', description: 'Combined hyperkalemia risk; monitor potassium', source: 'FDA' },

  // -- Migraine medication interactions -----------------------------------------
  { id: 'int-178', drugA: 'sumatriptan', drugB: 'ssri', severity: 'moderate', description: 'Serotonin syndrome risk with triptan/SSRI combination', source: 'FDA' },
  { id: 'int-179', drugA: 'sumatriptan', drugB: 'maoi', severity: 'severe', description: 'MAOIs increase sumatriptan levels; contraindicated', source: 'FDA' },
  { id: 'int-180', drugA: 'ergotamine', drugB: 'clarithromycin', severity: 'severe', description: 'CYP3A4 inhibition increases ergotamine levels; vasospasm risk', source: 'FDA' },

  // -- Prostate/urological interactions -----------------------------------------
  { id: 'int-181', drugA: 'tamsulosin', drugB: 'ketoconazole', severity: 'moderate', description: 'CYP3A4 inhibition increases tamsulosin levels', source: 'FDA' },
  { id: 'int-182', drugA: 'sildenafil', drugB: 'alpha_blockers', severity: 'moderate', description: 'Additive hypotension; start sildenafil at lowest dose', source: 'FDA' },

  // -- Respiratory medication interactions --------------------------------------
  { id: 'int-183', drugA: 'theophylline', drugB: 'erythromycin', severity: 'severe', description: 'Erythromycin inhibits theophylline metabolism; seizure risk', source: 'FDA' },
  { id: 'int-184', drugA: 'theophylline', drugB: 'cimetidine', severity: 'moderate', description: 'Cimetidine inhibits theophylline metabolism; toxicity risk', source: 'FDA' },
  { id: 'int-185', drugA: 'montelukast', drugB: 'phenobarbital', severity: 'moderate', description: 'Phenobarbital induces montelukast metabolism; reduced efficacy', source: 'FDA' },

  // -- Gout medication interactions ---------------------------------------------
  { id: 'int-186', drugA: 'colchicine', drugB: 'ketoconazole', severity: 'severe', description: 'CYP3A4 inhibition increases colchicine toxicity risk', source: 'FDA' },
  { id: 'int-187', drugA: 'colchicine', drugB: 'cyclosporine', severity: 'severe', description: 'P-gp inhibition increases colchicine levels; fatal toxicity reported', source: 'FDA' },
  { id: 'int-188', drugA: 'allopurinol', drugB: 'ace_inhibitors', severity: 'moderate', description: 'Increased risk of hypersensitivity reactions', source: 'FDA' },
  { id: 'int-189', drugA: 'probenecid', drugB: 'methotrexate', severity: 'severe', description: 'Probenecid reduces methotrexate clearance; toxicity risk', source: 'FDA' },

  // -- Antiemetic interactions --------------------------------------------------
  { id: 'int-190', drugA: 'ondansetron', drugB: 'tramadol', severity: 'moderate', description: 'Ondansetron may reduce tramadol analgesic efficacy', source: 'FDA' },
  { id: 'int-191', drugA: 'ondansetron', drugB: 'apomorphine', severity: 'severe', description: 'Profound hypotension and loss of consciousness; contraindicated', source: 'FDA' },

  // -- Osteoporosis medication interactions -------------------------------------
  { id: 'int-192', drugA: 'alendronate', drugB: 'calcium', severity: 'moderate', description: 'Calcium reduces bisphosphonate absorption; separate by 30+ minutes', source: 'FDA' },
  { id: 'int-193', drugA: 'alendronate', drugB: 'nsaids', severity: 'moderate', description: 'Additive GI irritation and ulceration risk', source: 'FDA' },

  // -- Additional common interactions ------------------------------------------
  { id: 'int-194', drugA: 'methotrexate', drugB: 'trimethoprim', severity: 'severe', description: 'Both are folate antagonists; pancytopenia risk', source: 'FDA' },
  { id: 'int-195', drugA: 'dapsone', drugB: 'trimethoprim', severity: 'moderate', description: 'Both cause methemoglobinemia; additive risk', source: 'FDA' },
  { id: 'int-196', drugA: 'azathioprine', drugB: 'ace_inhibitors', severity: 'moderate', description: 'Combined risk of leukopenia', source: 'FDA' },
  { id: 'int-197', drugA: 'potassium', drugB: 'arb', severity: 'moderate', description: 'ARBs with potassium supplements increase hyperkalemia risk', source: 'FDA' },
  { id: 'int-198', drugA: 'mirtazapine', drugB: 'maoi', severity: 'severe', description: 'Serotonin syndrome risk; contraindicated combination', source: 'FDA' },
  { id: 'int-199', drugA: 'bupropion', drugB: 'maoi', severity: 'severe', description: 'Hypertensive crisis risk; contraindicated combination', source: 'FDA' },
  { id: 'int-200', drugA: 'nortriptyline', drugB: 'maoi', severity: 'severe', description: 'Serotonin syndrome and hypertensive crisis; contraindicated', source: 'FDA' },
] as const;
