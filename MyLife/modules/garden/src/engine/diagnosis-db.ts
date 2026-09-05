/**
 * Bundled disease/pest knowledge base for symptom-based diagnosis.
 * Each entry has weighted symptoms: primary symptoms score 3, secondary score 1.
 */
export interface DiagnosisEntry {
  name: string;
  type: 'disease' | 'pest' | 'nutrient_deficiency' | 'environmental';
  symptoms: Record<string, number>; // symptom code -> weight
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  treatment: string[];
}

export const DIAGNOSIS_DATABASE: DiagnosisEntry[] = [
  // Diseases
  {
    name: 'Root Rot',
    type: 'disease',
    symptoms: { soft_stems: 3, yellowing_leaves: 3, wilting: 2, foul_smell: 3, mushy_roots: 3, leaf_drop: 1 },
    severity: 'severe',
    description: 'Fungal infection from overwatering, causing roots to decay.',
    treatment: ['Remove plant from pot and inspect roots', 'Cut away all brown/mushy roots with sterile scissors', 'Repot in fresh, well-draining soil', 'Reduce watering frequency', 'Ensure pot has drainage holes'],
  },
  {
    name: 'Powdery Mildew',
    type: 'disease',
    symptoms: { white_deposits: 3, discoloration: 2, stunted_growth: 1, leaf_curling: 1 },
    severity: 'moderate',
    description: 'White powdery fungal coating on leaves, common in humid conditions.',
    treatment: ['Improve air circulation', 'Remove affected leaves', 'Apply neem oil spray', 'Avoid overhead watering', 'Space plants further apart'],
  },
  {
    name: 'Bacterial Leaf Spot',
    type: 'disease',
    symptoms: { brown_spots: 3, yellowing_leaves: 2, leaf_drop: 2, discoloration: 1 },
    severity: 'moderate',
    description: 'Dark, water-soaked spots on leaves caused by bacterial infection.',
    treatment: ['Remove affected leaves immediately', 'Avoid wetting foliage when watering', 'Improve air circulation', 'Apply copper-based fungicide if severe'],
  },
  {
    name: 'Downy Mildew',
    type: 'disease',
    symptoms: { yellowing_leaves: 3, discoloration: 2, mold: 2, leaf_drop: 1 },
    severity: 'moderate',
    description: 'Yellow patches on leaf tops with fuzzy mold underneath.',
    treatment: ['Remove infected leaves', 'Improve ventilation', 'Water at soil level only', 'Apply fungicide if needed'],
  },
  {
    name: 'Botrytis (Gray Mold)',
    type: 'disease',
    symptoms: { mold: 3, brown_spots: 2, soft_stems: 2, wilting: 1 },
    severity: 'severe',
    description: 'Gray fuzzy mold on leaves, stems, and flowers.',
    treatment: ['Remove all affected parts', 'Reduce humidity', 'Improve air flow', 'Avoid overcrowding plants'],
  },

  // Pests
  {
    name: 'Spider Mites',
    type: 'pest',
    symptoms: { discoloration: 3, yellowing_leaves: 2, leaf_curling: 1, sticky_residue: 1, fine_webbing: 3 },
    severity: 'moderate',
    description: 'Tiny arachnids that create fine webbing and cause stippled, yellowing leaves.',
    treatment: ['Spray plant thoroughly with water to dislodge mites', 'Apply neem oil or insecticidal soap weekly', 'Increase humidity around plant', 'Isolate affected plant', 'Repeat treatment for 3-4 weeks'],
  },
  {
    name: 'Aphids',
    type: 'pest',
    symptoms: { sticky_residue: 3, leaf_curling: 2, stunted_growth: 2, yellowing_leaves: 1, aphids_visible: 3 },
    severity: 'mild',
    description: 'Small soft-bodied insects clustering on new growth and leaf undersides.',
    treatment: ['Spray with strong stream of water', 'Apply insecticidal soap', 'Release ladybugs if outdoors', 'Apply neem oil', 'Remove heavily infested leaves'],
  },
  {
    name: 'Mealybugs',
    type: 'pest',
    symptoms: { sticky_residue: 3, white_deposits: 2, stunted_growth: 1, yellowing_leaves: 1, mealybugs_visible: 3 },
    severity: 'moderate',
    description: 'White cottony masses on stems and leaf joints.',
    treatment: ['Dab individual bugs with rubbing alcohol on cotton swab', 'Spray with neem oil', 'Apply insecticidal soap', 'Isolate plant immediately', 'Check nearby plants for spread'],
  },
  {
    name: 'Scale Insects',
    type: 'pest',
    symptoms: { sticky_residue: 3, brown_spots: 2, yellowing_leaves: 1, scale_visible: 3 },
    severity: 'moderate',
    description: 'Hard or soft bumps on stems and leaves; produce honeydew.',
    treatment: ['Scrape off with fingernail or old toothbrush', 'Apply horticultural oil', 'Use systemic insecticide for severe cases', 'Prune heavily infested branches'],
  },
  {
    name: 'Fungus Gnats',
    type: 'pest',
    symptoms: { fungus_gnats_visible: 3, mold: 1, stunted_growth: 1, foul_smell: 1 },
    severity: 'mild',
    description: 'Small flying insects around soil surface; larvae feed on roots.',
    treatment: ['Let soil dry between waterings', 'Place yellow sticky traps near plants', 'Apply mosquito bits (BTI) to soil', 'Bottom-water instead of top-watering', 'Repot with fresh, sterile soil'],
  },
  {
    name: 'Thrips',
    type: 'pest',
    symptoms: { discoloration: 3, silvery_streaks: 3, leaf_curling: 1, stunted_growth: 1, thrips_visible: 3 },
    severity: 'moderate',
    description: 'Tiny slender insects that scrape leaf tissue, leaving silvery streaks.',
    treatment: ['Spray with insecticidal soap', 'Apply neem oil', 'Use blue sticky traps', 'Remove heavily damaged leaves', 'Treat every 5-7 days for 3 weeks'],
  },
  {
    name: 'Whiteflies',
    type: 'pest',
    symptoms: { sticky_residue: 3, yellowing_leaves: 2, whiteflies_visible: 3, leaf_drop: 1 },
    severity: 'moderate',
    description: 'Small white flying insects on leaf undersides; produce honeydew.',
    treatment: ['Use yellow sticky traps', 'Spray with insecticidal soap', 'Apply neem oil to undersides of leaves', 'Introduce parasitic wasps if outdoors'],
  },

  // Nutrient deficiencies
  {
    name: 'Nitrogen Deficiency',
    type: 'nutrient_deficiency',
    symptoms: { yellowing_leaves: 3, stunted_growth: 3, leaf_drop: 2 },
    severity: 'moderate',
    description: 'Lower leaves yellow first and drop. Overall pale, stunted growth.',
    treatment: ['Apply balanced fertilizer (10-10-10)', 'Add compost to soil', 'Check soil pH (6.0-7.0 optimal)'],
  },
  {
    name: 'Iron Deficiency (Chlorosis)',
    type: 'nutrient_deficiency',
    symptoms: { yellowing_leaves: 3, discoloration: 2, stunted_growth: 1 },
    severity: 'mild',
    description: 'New leaves yellow between veins while veins remain green.',
    treatment: ['Lower soil pH with sulfur', 'Apply iron chelate fertilizer', 'Check for overwatering (impairs iron uptake)'],
  },
  {
    name: 'Potassium Deficiency',
    type: 'nutrient_deficiency',
    symptoms: { brown_spots: 3, leaf_curling: 2, yellowing_leaves: 1 },
    severity: 'moderate',
    description: 'Brown scorching on leaf edges, older leaves affected first.',
    treatment: ['Apply potassium-rich fertilizer', 'Add wood ash to soil', 'Ensure proper soil drainage'],
  },

  // Environmental
  {
    name: 'Overwatering',
    type: 'environmental',
    symptoms: { yellowing_leaves: 3, wilting: 2, soft_stems: 2, mold: 1, foul_smell: 1, leaf_drop: 1 },
    severity: 'moderate',
    description: 'Too much water causes oxygen deprivation in roots.',
    treatment: ['Stop watering immediately', 'Check if pot has drainage', 'Let soil dry completely before next watering', 'Consider repotting in drier mix', 'Reduce watering frequency going forward'],
  },
  {
    name: 'Underwatering',
    type: 'environmental',
    symptoms: { wilting: 3, drooping: 3, leaf_curling: 2, brown_spots: 1, leaf_drop: 1 },
    severity: 'mild',
    description: 'Insufficient water causes wilting and dry, crispy leaf edges.',
    treatment: ['Water thoroughly until water drains from bottom', 'Soak severely dry soil in a basin of water', 'Establish a regular watering schedule', 'Consider a self-watering pot'],
  },
  {
    name: 'Sunburn',
    type: 'environmental',
    symptoms: { brown_spots: 3, discoloration: 3, leaf_curling: 1 },
    severity: 'mild',
    description: 'White or brown patches on leaves from too much direct sun.',
    treatment: ['Move to less direct light', 'Acclimate gradually to brighter conditions', 'Provide afternoon shade', 'Remove severely damaged leaves'],
  },
  {
    name: 'Low Light Stress',
    type: 'environmental',
    symptoms: { stunted_growth: 3, yellowing_leaves: 2, leggy_growth: 3, leaf_drop: 1 },
    severity: 'mild',
    description: 'Insufficient light causes elongated, weak growth and leaf drop.',
    treatment: ['Move to brighter location', 'Consider grow lights', 'Rotate plant for even light exposure', 'Clean dusty leaves to improve light absorption'],
  },
];

/**
 * Match symptoms against the knowledge base and return ranked diagnoses.
 */
export function matchSymptoms(symptoms: string[]): Array<{ entry: DiagnosisEntry; confidence: number }> {
  if (symptoms.length === 0) return [];

  const results: Array<{ entry: DiagnosisEntry; confidence: number }> = [];

  for (const entry of DIAGNOSIS_DATABASE) {
    const maxWeight = Object.values(entry.symptoms).reduce((a, b) => a + b, 0);
    if (maxWeight === 0) continue;

    let matchedWeight = 0;
    for (const symptom of symptoms) {
      if (entry.symptoms[symptom]) {
        matchedWeight += entry.symptoms[symptom];
      }
    }

    if (matchedWeight > 0) {
      const confidence = Math.min(1, matchedWeight / maxWeight);
      results.push({ entry, confidence });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get all known symptom codes.
 */
export function getAllSymptoms(): string[] {
  const symptoms = new Set<string>();
  for (const entry of DIAGNOSIS_DATABASE) {
    for (const s of Object.keys(entry.symptoms)) {
      symptoms.add(s);
    }
  }
  return [...symptoms].sort();
}
