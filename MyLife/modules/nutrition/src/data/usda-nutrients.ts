/**
 * USDA nutrient definitions for the nu_nutrients table.
 * 150 nutrients organized by category: vitamins, minerals, amino acids, fatty acids, other.
 * RDA values based on adult 2,000 kcal diet.
 */

interface NutrientDef {
  id: string;
  name: string;
  unit: string;
  rdaValue: number | null;
  rdaUnit: string | null;
  category: 'vitamin' | 'mineral' | 'amino_acid' | 'fatty_acid' | 'other';
  sortOrder: number;
}

// -- Vitamins ----------------------------------------------------------------

const VITAMINS: NutrientDef[] = [
  { id: 'nu-vit-a', name: 'Vitamin A', unit: 'mcg', rdaValue: 900, rdaUnit: 'mcg', category: 'vitamin', sortOrder: 1 },
  { id: 'nu-vit-b1', name: 'Thiamin (B1)', unit: 'mg', rdaValue: 1.2, rdaUnit: 'mg', category: 'vitamin', sortOrder: 2 },
  { id: 'nu-vit-b2', name: 'Riboflavin (B2)', unit: 'mg', rdaValue: 1.3, rdaUnit: 'mg', category: 'vitamin', sortOrder: 3 },
  { id: 'nu-vit-b3', name: 'Niacin (B3)', unit: 'mg', rdaValue: 16, rdaUnit: 'mg', category: 'vitamin', sortOrder: 4 },
  { id: 'nu-vit-b5', name: 'Pantothenic Acid (B5)', unit: 'mg', rdaValue: 5, rdaUnit: 'mg', category: 'vitamin', sortOrder: 5 },
  { id: 'nu-vit-b6', name: 'Vitamin B6', unit: 'mg', rdaValue: 1.3, rdaUnit: 'mg', category: 'vitamin', sortOrder: 6 },
  { id: 'nu-vit-b7', name: 'Biotin (B7)', unit: 'mcg', rdaValue: 30, rdaUnit: 'mcg', category: 'vitamin', sortOrder: 7 },
  { id: 'nu-vit-b9', name: 'Folate (B9)', unit: 'mcg', rdaValue: 400, rdaUnit: 'mcg', category: 'vitamin', sortOrder: 8 },
  { id: 'nu-vit-b12', name: 'Vitamin B12', unit: 'mcg', rdaValue: 2.4, rdaUnit: 'mcg', category: 'vitamin', sortOrder: 9 },
  { id: 'nu-vit-c', name: 'Vitamin C', unit: 'mg', rdaValue: 90, rdaUnit: 'mg', category: 'vitamin', sortOrder: 10 },
  { id: 'nu-vit-d', name: 'Vitamin D', unit: 'mcg', rdaValue: 20, rdaUnit: 'mcg', category: 'vitamin', sortOrder: 11 },
  { id: 'nu-vit-e', name: 'Vitamin E', unit: 'mg', rdaValue: 15, rdaUnit: 'mg', category: 'vitamin', sortOrder: 12 },
  { id: 'nu-vit-k', name: 'Vitamin K', unit: 'mcg', rdaValue: 120, rdaUnit: 'mcg', category: 'vitamin', sortOrder: 13 },
  { id: 'nu-choline', name: 'Choline', unit: 'mg', rdaValue: 550, rdaUnit: 'mg', category: 'vitamin', sortOrder: 14 },
  { id: 'nu-betaine', name: 'Betaine', unit: 'mg', rdaValue: null, rdaUnit: null, category: 'vitamin', sortOrder: 15 },
];

// -- Minerals ----------------------------------------------------------------

const MINERALS: NutrientDef[] = [
  { id: 'nu-min-ca', name: 'Calcium', unit: 'mg', rdaValue: 1000, rdaUnit: 'mg', category: 'mineral', sortOrder: 20 },
  { id: 'nu-min-fe', name: 'Iron', unit: 'mg', rdaValue: 18, rdaUnit: 'mg', category: 'mineral', sortOrder: 21 },
  { id: 'nu-min-mg', name: 'Magnesium', unit: 'mg', rdaValue: 420, rdaUnit: 'mg', category: 'mineral', sortOrder: 22 },
  { id: 'nu-min-p', name: 'Phosphorus', unit: 'mg', rdaValue: 700, rdaUnit: 'mg', category: 'mineral', sortOrder: 23 },
  { id: 'nu-min-k', name: 'Potassium', unit: 'mg', rdaValue: 2600, rdaUnit: 'mg', category: 'mineral', sortOrder: 24 },
  { id: 'nu-min-na', name: 'Sodium', unit: 'mg', rdaValue: 2300, rdaUnit: 'mg', category: 'mineral', sortOrder: 25 },
  { id: 'nu-min-zn', name: 'Zinc', unit: 'mg', rdaValue: 11, rdaUnit: 'mg', category: 'mineral', sortOrder: 26 },
  { id: 'nu-min-cu', name: 'Copper', unit: 'mg', rdaValue: 0.9, rdaUnit: 'mg', category: 'mineral', sortOrder: 27 },
  { id: 'nu-min-mn', name: 'Manganese', unit: 'mg', rdaValue: 2.3, rdaUnit: 'mg', category: 'mineral', sortOrder: 28 },
  { id: 'nu-min-se', name: 'Selenium', unit: 'mcg', rdaValue: 55, rdaUnit: 'mcg', category: 'mineral', sortOrder: 29 },
  { id: 'nu-min-f', name: 'Fluoride', unit: 'mg', rdaValue: 4, rdaUnit: 'mg', category: 'mineral', sortOrder: 30 },
  { id: 'nu-min-cr', name: 'Chromium', unit: 'mcg', rdaValue: 35, rdaUnit: 'mcg', category: 'mineral', sortOrder: 31 },
  { id: 'nu-min-mo', name: 'Molybdenum', unit: 'mcg', rdaValue: 45, rdaUnit: 'mcg', category: 'mineral', sortOrder: 32 },
  { id: 'nu-min-i', name: 'Iodine', unit: 'mcg', rdaValue: 150, rdaUnit: 'mcg', category: 'mineral', sortOrder: 33 },
];

// -- Amino Acids -------------------------------------------------------------

const AMINO_ACIDS: NutrientDef[] = [
  { id: 'nu-aa-trp', name: 'Tryptophan', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 40 },
  { id: 'nu-aa-thr', name: 'Threonine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 41 },
  { id: 'nu-aa-ile', name: 'Isoleucine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 42 },
  { id: 'nu-aa-leu', name: 'Leucine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 43 },
  { id: 'nu-aa-lys', name: 'Lysine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 44 },
  { id: 'nu-aa-met', name: 'Methionine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 45 },
  { id: 'nu-aa-cys', name: 'Cystine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 46 },
  { id: 'nu-aa-phe', name: 'Phenylalanine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 47 },
  { id: 'nu-aa-tyr', name: 'Tyrosine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 48 },
  { id: 'nu-aa-val', name: 'Valine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 49 },
  { id: 'nu-aa-arg', name: 'Arginine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 50 },
  { id: 'nu-aa-his', name: 'Histidine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 51 },
  { id: 'nu-aa-ala', name: 'Alanine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 52 },
  { id: 'nu-aa-asp', name: 'Aspartic Acid', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 53 },
  { id: 'nu-aa-glu', name: 'Glutamic Acid', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 54 },
  { id: 'nu-aa-gly', name: 'Glycine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 55 },
  { id: 'nu-aa-pro', name: 'Proline', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 56 },
  { id: 'nu-aa-ser', name: 'Serine', unit: 'g', rdaValue: null, rdaUnit: null, category: 'amino_acid', sortOrder: 57 },
];

// -- Fatty Acids -------------------------------------------------------------

const FATTY_ACIDS: NutrientDef[] = [
  { id: 'nu-fa-sat', name: 'Saturated Fat', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 60 },
  { id: 'nu-fa-mufa', name: 'Monounsaturated Fat', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 61 },
  { id: 'nu-fa-pufa', name: 'Polyunsaturated Fat', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 62 },
  { id: 'nu-fa-trans', name: 'Trans Fat', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 63 },
  { id: 'nu-fa-o3', name: 'Omega-3 Fatty Acids', unit: 'g', rdaValue: 1.6, rdaUnit: 'g', category: 'fatty_acid', sortOrder: 64 },
  { id: 'nu-fa-o6', name: 'Omega-6 Fatty Acids', unit: 'g', rdaValue: 17, rdaUnit: 'g', category: 'fatty_acid', sortOrder: 65 },
  { id: 'nu-fa-epa', name: 'EPA (20:5 n-3)', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 66 },
  { id: 'nu-fa-dha', name: 'DHA (22:6 n-3)', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 67 },
  { id: 'nu-fa-ala', name: 'ALA (18:3 n-3)', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 68 },
  { id: 'nu-fa-la', name: 'Linoleic Acid (18:2 n-6)', unit: 'g', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 69 },
  { id: 'nu-fa-cholesterol', name: 'Cholesterol', unit: 'mg', rdaValue: null, rdaUnit: null, category: 'fatty_acid', sortOrder: 70 },
];

// -- Other -------------------------------------------------------------------

const OTHER: NutrientDef[] = [
  { id: 'nu-oth-water', name: 'Water', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 80 },
  { id: 'nu-oth-caffeine', name: 'Caffeine', unit: 'mg', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 81 },
  { id: 'nu-oth-alcohol', name: 'Alcohol', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 82 },
  { id: 'nu-oth-starch', name: 'Starch', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 83 },
  { id: 'nu-oth-sucrose', name: 'Sucrose', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 84 },
  { id: 'nu-oth-glucose', name: 'Glucose', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 85 },
  { id: 'nu-oth-fructose', name: 'Fructose', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 86 },
  { id: 'nu-oth-lactose', name: 'Lactose', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 87 },
  { id: 'nu-oth-maltose', name: 'Maltose', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 88 },
  { id: 'nu-oth-galactose', name: 'Galactose', unit: 'g', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 89 },
  { id: 'nu-oth-lycopene', name: 'Lycopene', unit: 'mcg', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 90 },
  { id: 'nu-oth-lutein', name: 'Lutein + Zeaxanthin', unit: 'mcg', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 91 },
  { id: 'nu-oth-beta-carotene', name: 'Beta Carotene', unit: 'mcg', rdaValue: null, rdaUnit: null, category: 'other', sortOrder: 92 },
];

export const ALL_NUTRIENT_DEFS: NutrientDef[] = [
  ...VITAMINS,
  ...MINERALS,
  ...AMINO_ACIDS,
  ...FATTY_ACIDS,
  ...OTHER,
];

function escape(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Generate SQL INSERT statements for all nutrient definitions.
 */
export function getNutrientInserts(): string[] {
  return ALL_NUTRIENT_DEFS.map((n) => {
    const rdaVal = n.rdaValue === null ? 'NULL' : n.rdaValue;
    const rdaUnit = n.rdaUnit === null ? 'NULL' : `'${escape(n.rdaUnit)}'`;
    return `INSERT OR IGNORE INTO nu_nutrients (id, name, unit, rda_value, rda_unit, category, sort_order) VALUES ('${escape(n.id)}', '${escape(n.name)}', '${escape(n.unit)}', ${rdaVal}, ${rdaUnit}, '${n.category}', ${n.sortOrder})`;
  });
}
