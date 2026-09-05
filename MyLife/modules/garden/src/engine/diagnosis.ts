// Bundled knowledge base of common plant diseases and pests
interface DiagnosisEntry {
  name: string;
  type: 'disease' | 'pest' | 'nutrient_deficiency' | 'environmental';
  symptoms: Array<{ code: string; weight: number }>; // weight: 1-3 (1=minor, 3=primary)
  description: string;
  treatment: string;
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
}

const DIAGNOSIS_DB: DiagnosisEntry[] = [
  // Diseases
  { name: 'Root Rot', type: 'disease', symptoms: [{ code: 'soft_stems', weight: 3 }, { code: 'yellowing_leaves', weight: 2 }, { code: 'wilting', weight: 2 }, { code: 'foul_smell', weight: 3 }, { code: 'mushy_roots', weight: 3 }], description: 'Fungal infection causing root decay, often from overwatering', treatment: '1. Remove from pot and trim all mushy/black roots\n2. Treat remaining roots with hydrogen peroxide (1 part 3% to 2 parts water)\n3. Repot in fresh, well-draining soil\n4. Reduce watering frequency', severity: 'severe' },
  { name: 'Powdery Mildew', type: 'disease', symptoms: [{ code: 'white_deposits', weight: 3 }, { code: 'discoloration', weight: 2 }, { code: 'leaf_curling', weight: 1 }], description: 'Fungal disease appearing as white powdery coating on leaves', treatment: '1. Remove heavily affected leaves\n2. Improve air circulation\n3. Apply neem oil spray weekly\n4. Avoid overhead watering', severity: 'moderate' },
  { name: 'Leaf Spot', type: 'disease', symptoms: [{ code: 'brown_spots', weight: 3 }, { code: 'yellowing_leaves', weight: 1 }, { code: 'leaf_drop', weight: 2 }], description: 'Bacterial or fungal spots on foliage', treatment: '1. Remove affected leaves\n2. Improve air circulation\n3. Avoid wetting foliage\n4. Apply copper-based fungicide if severe', severity: 'moderate' },
  { name: 'Blight', type: 'disease', symptoms: [{ code: 'brown_spots', weight: 2 }, { code: 'wilting', weight: 3 }, { code: 'lesions', weight: 3 }, { code: 'leaf_drop', weight: 2 }], description: 'Rapid-onset fungal disease causing widespread tissue death', treatment: '1. Remove and destroy all affected plant material\n2. Apply fungicide immediately\n3. Improve spacing for air flow\n4. Avoid overhead watering', severity: 'critical' },
  { name: 'Damping Off', type: 'disease', symptoms: [{ code: 'soft_stems', weight: 3 }, { code: 'stunted_growth', weight: 2 }, { code: 'mold', weight: 2 }], description: 'Soil-borne fungus that kills seedlings at soil level', treatment: '1. Improve drainage\n2. Use sterile potting mix\n3. Reduce watering\n4. Improve air circulation around seedlings', severity: 'severe' },

  // Pests
  { name: 'Spider Mites', type: 'pest', symptoms: [{ code: 'discoloration', weight: 2 }, { code: 'sticky_residue', weight: 1 }, { code: 'leaf_curling', weight: 2 }, { code: 'spider_mites', weight: 3 }], description: 'Tiny arachnids that suck sap, causing stippled, yellowed leaves', treatment: '1. Isolate the plant immediately\n2. Spray with water to knock off mites\n3. Apply neem oil or insecticidal soap every 3-4 days\n4. Increase humidity around plant', severity: 'moderate' },
  { name: 'Aphids', type: 'pest', symptoms: [{ code: 'sticky_residue', weight: 3 }, { code: 'yellowing_leaves', weight: 2 }, { code: 'leaf_curling', weight: 2 }, { code: 'aphids', weight: 3 }, { code: 'stunted_growth', weight: 1 }], description: 'Small sap-sucking insects that cluster on new growth', treatment: '1. Spray with strong stream of water\n2. Apply insecticidal soap\n3. Introduce ladybugs\n4. Apply neem oil weekly', severity: 'moderate' },
  { name: 'Mealybugs', type: 'pest', symptoms: [{ code: 'sticky_residue', weight: 3 }, { code: 'mealybugs', weight: 3 }, { code: 'yellowing_leaves', weight: 1 }, { code: 'stunted_growth', weight: 1 }], description: 'White cottony insects that feed on plant sap', treatment: '1. Isolate the plant\n2. Dab individual bugs with rubbing alcohol on cotton swab\n3. Apply neem oil or insecticidal soap\n4. Repeat treatment weekly for 3-4 weeks', severity: 'moderate' },
  { name: 'Scale Insects', type: 'pest', symptoms: [{ code: 'sticky_residue', weight: 3 }, { code: 'scale', weight: 3 }, { code: 'yellowing_leaves', weight: 2 }], description: 'Hard-shelled insects that attach to stems and leaves', treatment: '1. Scrape off visible scale with a soft brush\n2. Apply horticultural oil\n3. Use systemic insecticide for severe infestations\n4. Check weekly and retreat as needed', severity: 'moderate' },
  { name: 'Fungus Gnats', type: 'pest', symptoms: [{ code: 'fungus_gnats', weight: 3 }, { code: 'mold', weight: 1 }, { code: 'stunted_growth', weight: 1 }], description: 'Small flies whose larvae feed on roots in moist soil', treatment: '1. Allow soil to dry between waterings\n2. Use sticky traps for adults\n3. Apply Bti (Mosquito Bits) to soil surface\n4. Add sand or perlite top layer to deter egg laying', severity: 'mild' },
  { name: 'Whiteflies', type: 'pest', symptoms: [{ code: 'whiteflies', weight: 3 }, { code: 'sticky_residue', weight: 2 }, { code: 'yellowing_leaves', weight: 2 }], description: 'Tiny white flying insects that suck sap from leaf undersides', treatment: '1. Yellow sticky traps near plants\n2. Spray insecticidal soap on leaf undersides\n3. Apply neem oil weekly\n4. Introduce parasitic wasps (Encarsia)', severity: 'moderate' },
  { name: 'Thrips', type: 'pest', symptoms: [{ code: 'thrips', weight: 3 }, { code: 'discoloration', weight: 2 }, { code: 'holes', weight: 1 }], description: 'Tiny slender insects that scrape and suck plant cells', treatment: '1. Isolate affected plants\n2. Blue sticky traps to monitor\n3. Apply spinosad-based insecticide\n4. Prune heavily damaged leaves', severity: 'moderate' },

  // Nutrient deficiencies
  { name: 'Nitrogen Deficiency', type: 'nutrient_deficiency', symptoms: [{ code: 'yellowing_leaves', weight: 3 }, { code: 'stunted_growth', weight: 3 }, { code: 'leaf_drop', weight: 1 }], description: 'Older/lower leaves turn yellow first as nitrogen is mobile', treatment: '1. Apply balanced liquid fertilizer\n2. Add compost to soil\n3. For quick fix, use fish emulsion\n4. Adjust pH if needed (nitrogen absorbs best at 6.0-7.0)', severity: 'moderate' },
  { name: 'Iron Deficiency', type: 'nutrient_deficiency', symptoms: [{ code: 'yellowing_leaves', weight: 2 }, { code: 'discoloration', weight: 3 }], description: 'New leaves turn yellow while veins stay green (interveinal chlorosis)', treatment: '1. Lower soil pH (iron is unavailable in alkaline soil)\n2. Apply chelated iron supplement\n3. Avoid overwatering (reduces iron uptake)\n4. Use acidifying fertilizer', severity: 'moderate' },
  { name: 'Potassium Deficiency', type: 'nutrient_deficiency', symptoms: [{ code: 'browning_leaves', weight: 2 }, { code: 'leaf_curling', weight: 2 }, { code: 'no_flowering', weight: 2 }], description: 'Leaf edges turn brown and curl; poor flowering', treatment: '1. Apply potassium-rich fertilizer\n2. Add wood ash to soil (sparingly)\n3. Use banana peel compost\n4. Ensure adequate watering (potassium needs water for uptake)', severity: 'moderate' },

  // Environmental
  { name: 'Overwatering', type: 'environmental', symptoms: [{ code: 'yellowing_leaves', weight: 2 }, { code: 'soft_stems', weight: 2 }, { code: 'wilting', weight: 2 }, { code: 'mold', weight: 1 }], description: 'Too much water drowns roots and promotes rot', treatment: '1. Stop watering immediately\n2. Check drainage holes are clear\n3. If soil is soggy, repot in fresh dry mix\n4. Resume watering only when top inch of soil is dry', severity: 'moderate' },
  { name: 'Underwatering', type: 'environmental', symptoms: [{ code: 'wilting', weight: 3 }, { code: 'drooping', weight: 3 }, { code: 'browning_leaves', weight: 2 }, { code: 'leaf_drop', weight: 1 }], description: 'Insufficient water causing dehydration stress', treatment: '1. Water thoroughly until water drains from bottom\n2. If soil is hydrophobic, soak pot in water for 15 min\n3. Increase watering frequency\n4. Consider self-watering pot or moisture meter', severity: 'moderate' },
  { name: 'Sunburn', type: 'environmental', symptoms: [{ code: 'brown_spots', weight: 2 }, { code: 'discoloration', weight: 3 }, { code: 'browning_leaves', weight: 2 }], description: 'Direct sun scorching leaves, especially after being in low light', treatment: '1. Move to indirect light\n2. Remove severely scorched leaves\n3. Gradually acclimate if moving to brighter spot\n4. Provide afternoon shade', severity: 'mild' },
  { name: 'Cold Damage', type: 'environmental', symptoms: [{ code: 'wilting', weight: 2 }, { code: 'discoloration', weight: 2 }, { code: 'soft_stems', weight: 2 }, { code: 'leaf_drop', weight: 2 }], description: 'Exposure to temperatures below plant tolerance', treatment: '1. Move to warmer location immediately\n2. Do not prune damaged parts for several weeks\n3. Reduce watering while recovering\n4. Avoid fertilizing until new growth appears', severity: 'severe' },
  { name: 'Low Humidity', type: 'environmental', symptoms: [{ code: 'browning_leaves', weight: 2 }, { code: 'leaf_curling', weight: 2 }, { code: 'drooping', weight: 1 }], description: 'Air too dry for tropical plants', treatment: '1. Group plants together to increase ambient humidity\n2. Use a humidifier nearby\n3. Place pebble tray with water under pot\n4. Mist foliage (temporary relief only)', severity: 'mild' },
];

interface MatchResult {
  name: string;
  type: 'disease' | 'pest' | 'nutrient_deficiency' | 'environmental';
  confidence: number;
  description: string;
  treatment: string;
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
}

/**
 * Match symptoms against the knowledge base.
 * Returns ranked diagnosis results sorted by confidence (highest first).
 */
export function matchSymptoms(symptoms: string[]): MatchResult[] {
  if (symptoms.length === 0) return [];
  const codes = symptoms.slice(0, 10).map(s => s.toLowerCase().trim());

  const results: MatchResult[] = [];
  for (const entry of DIAGNOSIS_DB) {
    let matchedWeight = 0;
    let totalWeight = 0;
    for (const s of entry.symptoms) {
      totalWeight += s.weight;
      if (codes.includes(s.code)) {
        matchedWeight += s.weight;
      }
    }
    if (matchedWeight > 0 && totalWeight > 0) {
      const confidence = Math.round((matchedWeight / totalWeight) * 100) / 100;
      results.push({
        name: entry.name,
        type: entry.type,
        confidence,
        description: entry.description,
        treatment: entry.treatment,
        severity: entry.severity,
      });
    }
  }

  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if a diagnosis has occurred before for a given plant.
 */
export function isRecurrence(diagnosisName: string, history: Array<{ diagnosisName: string | null }>): boolean {
  return history.some(d => d.diagnosisName === diagnosisName);
}

/**
 * Valid treatment status transitions.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_treatment'],
  in_treatment: ['resolved', 'unresolvable'],
  resolved: [],
  unresolvable: [],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}
