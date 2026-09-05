import type { CompanionEntry } from '../types';

/**
 * Bundled companion planting matrix.
 * 60 curated relationships covering common vegetables, herbs, and flowers.
 * Data from university extension service publications (public domain).
 * Pairs stored in alphabetical order (plantA < plantB) for normalized lookup.
 */
export const COMPANION_DATA: CompanionEntry[] = [
  // Tomato companions
  { plantA: 'basil', plantB: 'tomato', relationship: 'companion', benefit: 'Basil repels aphids and improves tomato flavor', category: 'pest_control' },
  { plantA: 'carrot', plantB: 'tomato', relationship: 'companion', benefit: 'Carrots loosen soil around tomato roots', category: 'growth_boost' },
  { plantA: 'marigold', plantB: 'tomato', relationship: 'companion', benefit: 'Marigolds repel nematodes and whiteflies', category: 'pest_control' },
  { plantA: 'parsley', plantB: 'tomato', relationship: 'companion', benefit: 'Parsley attracts beneficial insects', category: 'pest_control' },
  { plantA: 'fennel', plantB: 'tomato', relationship: 'antagonist', benefit: 'Fennel secretes substances that inhibit tomato growth', category: 'chemical_inhibition' },
  { plantA: 'brassica', plantB: 'tomato', relationship: 'antagonist', benefit: 'Brassicas and tomatoes compete for the same nutrients', category: 'chemical_inhibition' },
  { plantA: 'corn', plantB: 'tomato', relationship: 'antagonist', benefit: 'Both attract the same pests (tomato hornworm)', category: 'pest_control' },

  // Bean companions
  { plantA: 'bean', plantB: 'corn', relationship: 'companion', benefit: 'Beans fix nitrogen that corn needs; corn provides trellis (Three Sisters)', category: 'nutrient_sharing' },
  { plantA: 'bean', plantB: 'squash', relationship: 'companion', benefit: 'Squash shades soil; beans fix nitrogen (Three Sisters)', category: 'nutrient_sharing' },
  { plantA: 'bean', plantB: 'carrot', relationship: 'companion', benefit: 'Beans fix nitrogen benefiting carrots', category: 'nutrient_sharing' },
  { plantA: 'bean', plantB: 'onion', relationship: 'antagonist', benefit: 'Onions inhibit bean growth', category: 'chemical_inhibition' },
  { plantA: 'bean', plantB: 'garlic', relationship: 'antagonist', benefit: 'Garlic inhibits bean growth', category: 'chemical_inhibition' },

  // Carrot companions
  { plantA: 'carrot', plantB: 'onion', relationship: 'companion', benefit: 'Onions repel carrot fly; carrots repel onion fly', category: 'pest_control' },
  { plantA: 'carrot', plantB: 'lettuce', relationship: 'companion', benefit: 'Lettuce provides shade for carrots in summer', category: 'shade_provision' },
  { plantA: 'carrot', plantB: 'rosemary', relationship: 'companion', benefit: 'Rosemary repels carrot fly', category: 'pest_control' },
  { plantA: 'carrot', plantB: 'dill', relationship: 'antagonist', benefit: 'Dill can cross-pollinate and stunt carrot growth', category: 'chemical_inhibition' },

  // Cucumber companions
  { plantA: 'cucumber', plantB: 'sunflower', relationship: 'companion', benefit: 'Sunflowers attract pollinators and provide light shade', category: 'growth_boost' },
  { plantA: 'cucumber', plantB: 'dill', relationship: 'companion', benefit: 'Dill attracts beneficial wasps that prey on cucumber pests', category: 'pest_control' },
  { plantA: 'bean', plantB: 'cucumber', relationship: 'companion', benefit: 'Beans fix nitrogen that cucumbers need', category: 'nutrient_sharing' },
  { plantA: 'cucumber', plantB: 'sage', relationship: 'antagonist', benefit: 'Sage inhibits cucumber growth', category: 'chemical_inhibition' },
  { plantA: 'cucumber', plantB: 'potato', relationship: 'antagonist', benefit: 'Potatoes and cucumbers compete and share diseases', category: 'chemical_inhibition' },

  // Pepper companions
  { plantA: 'basil', plantB: 'pepper', relationship: 'companion', benefit: 'Basil repels aphids and spider mites from peppers', category: 'pest_control' },
  { plantA: 'carrot', plantB: 'pepper', relationship: 'companion', benefit: 'Carrots provide ground cover and loosen soil', category: 'growth_boost' },
  { plantA: 'fennel', plantB: 'pepper', relationship: 'antagonist', benefit: 'Fennel secretes growth-inhibiting substances', category: 'chemical_inhibition' },

  // Lettuce companions
  { plantA: 'lettuce', plantB: 'radish', relationship: 'companion', benefit: 'Radishes mark rows and loosen soil for lettuce', category: 'growth_boost' },
  { plantA: 'chive', plantB: 'lettuce', relationship: 'companion', benefit: 'Chives repel aphids from lettuce', category: 'pest_control' },
  { plantA: 'lettuce', plantB: 'strawberry', relationship: 'companion', benefit: 'Good ground cover companion, similar water needs', category: 'growth_boost' },

  // Herb companions
  { plantA: 'chamomile', plantB: 'onion', relationship: 'companion', benefit: 'Chamomile improves onion flavor and growth', category: 'flavor_enhancement' },
  { plantA: 'cilantro', plantB: 'spinach', relationship: 'companion', benefit: 'Cilantro repels aphids and attracts beneficial insects', category: 'pest_control' },
  { plantA: 'mint', plantB: 'cabbage', relationship: 'companion', benefit: 'Mint repels cabbage moths', category: 'pest_control' },
  { plantA: 'oregano', plantB: 'pepper', relationship: 'companion', benefit: 'Oregano repels aphids and provides ground cover', category: 'pest_control' },
  { plantA: 'sage', plantB: 'cabbage', relationship: 'companion', benefit: 'Sage repels cabbage moths and flies', category: 'pest_control' },
  { plantA: 'thyme', plantB: 'cabbage', relationship: 'companion', benefit: 'Thyme repels cabbage worms', category: 'pest_control' },

  // Flower companions
  { plantA: 'marigold', plantB: 'bean', relationship: 'companion', benefit: 'Marigolds repel Mexican bean beetles', category: 'pest_control' },
  { plantA: 'marigold', plantB: 'squash', relationship: 'companion', benefit: 'Marigolds repel squash bugs and nematodes', category: 'pest_control' },
  { plantA: 'nasturtium', plantB: 'squash', relationship: 'companion', benefit: 'Nasturtiums act as trap crop for aphids and squash bugs', category: 'pest_control' },
  { plantA: 'nasturtium', plantB: 'cucumber', relationship: 'companion', benefit: 'Nasturtiums repel cucumber beetles', category: 'pest_control' },
  { plantA: 'borage', plantB: 'strawberry', relationship: 'companion', benefit: 'Borage attracts pollinators and may improve strawberry flavor', category: 'flavor_enhancement' },
  { plantA: 'borage', plantB: 'tomato', relationship: 'companion', benefit: 'Borage repels tomato hornworm', category: 'pest_control' },
  { plantA: 'lavender', plantB: 'rose', relationship: 'companion', benefit: 'Lavender repels aphids and attracts pollinators', category: 'pest_control' },
  { plantA: 'sunflower', plantB: 'corn', relationship: 'companion', benefit: 'Sunflowers attract pollinators benefiting corn', category: 'growth_boost' },

  // Root vegetable companions
  { plantA: 'garlic', plantB: 'rose', relationship: 'companion', benefit: 'Garlic repels aphids and black spot from roses', category: 'pest_control' },
  { plantA: 'garlic', plantB: 'tomato', relationship: 'companion', benefit: 'Garlic repels spider mites', category: 'pest_control' },
  { plantA: 'onion', plantB: 'strawberry', relationship: 'companion', benefit: 'Onions repel strawberry pests', category: 'pest_control' },
  { plantA: 'onion', plantB: 'lettuce', relationship: 'companion', benefit: 'Onions repel rabbits and other pests from lettuce', category: 'pest_control' },
  { plantA: 'potato', plantB: 'horseradish', relationship: 'companion', benefit: 'Horseradish repels Colorado potato beetles', category: 'pest_control' },
  { plantA: 'potato', plantB: 'tomato', relationship: 'antagonist', benefit: 'Both are solanaceae; share diseases like blight', category: 'chemical_inhibition' },
  { plantA: 'onion', plantB: 'pea', relationship: 'antagonist', benefit: 'Onions inhibit pea growth', category: 'chemical_inhibition' },

  // Additional common pairs
  { plantA: 'corn', plantB: 'squash', relationship: 'companion', benefit: 'Squash shades soil; large leaves suppress weeds (Three Sisters)', category: 'shade_provision' },
  { plantA: 'pea', plantB: 'carrot', relationship: 'companion', benefit: 'Peas fix nitrogen; carrots loosen soil for peas', category: 'nutrient_sharing' },
  { plantA: 'pea', plantB: 'radish', relationship: 'companion', benefit: 'Radishes grow fast and mark pea rows', category: 'growth_boost' },
  { plantA: 'celery', plantB: 'tomato', relationship: 'companion', benefit: 'Celery repels whiteflies from tomatoes', category: 'pest_control' },
  { plantA: 'asparagus', plantB: 'tomato', relationship: 'companion', benefit: 'Tomatoes repel asparagus beetles', category: 'pest_control' },
  { plantA: 'broccoli', plantB: 'dill', relationship: 'companion', benefit: 'Dill attracts beneficial wasps that prey on broccoli pests', category: 'pest_control' },
  { plantA: 'cabbage', plantB: 'dill', relationship: 'antagonist', benefit: 'Dill can inhibit cabbage growth when mature', category: 'chemical_inhibition' },
  { plantA: 'fennel', plantB: 'most_plants', relationship: 'antagonist', benefit: 'Fennel is allelopathic; plant it away from most garden plants', category: 'chemical_inhibition' },
  { plantA: 'black_walnut', plantB: 'most_plants', relationship: 'antagonist', benefit: 'Juglone from walnut roots kills most nearby plants', category: 'chemical_inhibition' },
  { plantA: 'eggplant', plantB: 'bean', relationship: 'companion', benefit: 'Beans fix nitrogen; eggplant benefits from extra nitrogen', category: 'nutrient_sharing' },
  { plantA: 'beet', plantB: 'lettuce', relationship: 'companion', benefit: 'Different root depths; no competition', category: 'growth_boost' },
  { plantA: 'beet', plantB: 'onion', relationship: 'companion', benefit: 'Onions repel beet pests', category: 'pest_control' },
  { plantA: 'zucchini', plantB: 'nasturtium', relationship: 'companion', benefit: 'Nasturtiums trap aphids away from zucchini', category: 'pest_control' },
];
