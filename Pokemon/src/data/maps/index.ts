// === Map Registry — Central import for all Kanto maps ===

import type { GameMap } from '../game-types.ts';

// Towns
import { palletTown } from './pallet-town.ts';
import { palletPlayerHouse } from './pallet-player-house.ts';
import { palletRivalHouse } from './pallet-rival-house.ts';
import { oakLab } from './oak-lab.ts';
import { viridianCity } from './viridian-city.ts';
import { viridianPokecenter, viridianMart, viridianHouse1, viridianHouse2, gymViridian } from './viridian-interiors.ts';
import { pewterCity } from './pewter-city.ts';
import { pewterPokecenter, pewterMart, pewterHouse, gymPewter, pewterMuseum } from './pewter-interiors.ts';
import { ceruleanCity } from './cerulean-city.ts';
import { ceruleanPokecenter, ceruleanMart, ceruleanBikeShop, ceruleanHouse1, ceruleanRobbedHouse, gymCerulean } from './cerulean-interiors.ts';
import { vermilionCity } from './vermilion-city.ts';
import { vermilionPokecenter, vermilionMart, vermilionHouse, vermilionFanClub, gymVermilion, ssAnne1F } from './vermilion-interiors.ts';
import { lavenderTown } from './lavender-town.ts';
import { lavenderPokecenter, lavenderFujiHouse, lavenderVolunteerHouse } from './lavender-interiors.ts';
import { celadonCity } from './celadon-city.ts';
import { celadonPokecenter, celadonHotel, celadonRestaurant, celadonMansion, celadonDeptStore, celadonGameCorner, gymCeladon } from './celadon-interiors.ts';
import { fuchsiaCity } from './fuchsia-city.ts';
import { fuchsiaPokecenter, fuchsiaMart, fuchsiaHouse, fuchsiaWardenHouse, gymFuchsia } from './fuchsia-interiors.ts';
import { saffronCity } from './saffron-city.ts';
import { saffronPokecenter, saffronMart, saffronMrPsychic, saffronCopycat, gymSaffron, fightingDojo, silphCo1F, silphCo7F, silphCo11F } from './saffron-interiors.ts';
import { cinnabarIsland } from './cinnabar-island.ts';
import { cinnabarPokecenter, cinnabarMart, cinnabarLab, gymCinnabar, pokemonMansion1F, pokemonMansionB1F } from './cinnabar-interiors.ts';
import { indigoPlateauExterior, eliteFourLobby, eliteFourLorelei, eliteFourBruno, eliteFourAgatha, eliteFourLance, championRoom, hallOfFame, indigoPokecenter, indigoMart } from './indigo-plateau.ts';

// Routes
import { route1 } from './route-1.ts';
import { route2 } from './route-2.ts';
import { route3 } from './route-3.ts';
import { route3Pokecenter } from './route-3-pokecenter.ts';
import { route4 } from './route-4.ts';
import { route5, route6, route7, route8, route9, route10 } from './routes-5-to-10.ts';
import { route11, route12, route13, route14, route15 } from './routes-11-to-15.ts';
import { route16, route17, route18, route19, route20, route21 } from './routes-16-to-21.ts';
import { route22, route23, route24, route25 } from './routes-22-to-25.ts';

// Dungeons
import { viridianForest } from './viridian-forest.ts';
import { mtMoon1F, mtMoonB1F, mtMoonB2F } from './mt-moon.ts';
import {
  pokemonTower1F, pokemonTower3F, pokemonTower5F, pokemonTower7F,
  rockTunnel1F, rockTunnelB1F,
  rocketHideoutB1F, rocketHideoutB4F,
  diglettsCave,
  victoryRoad1F, victoryRoad2F,
  seafoamIslands1F, seafoamIslandsB1F,
  powerPlant,
  safariZone1, safariZone2,
  ceruleanCave1F, ceruleanCaveB1F,
} from './dungeons.ts';

// Special locations
import { undergroundPathNS, undergroundPathEW, billsHouse, route10Pokecenter } from './special-locations.ts';

export const MAP_REGISTRY: Record<string, GameMap> = {
  // === Towns ===
  'pallet-town': palletTown,
  'pallet-player-house': palletPlayerHouse,
  'pallet-rival-house': palletRivalHouse,
  'oak-lab': oakLab,

  'viridian-city': viridianCity,
  'viridian-pokecenter': viridianPokecenter,
  'viridian-mart': viridianMart,
  'viridian-house-1': viridianHouse1,
  'viridian-house-2': viridianHouse2,
  'gym-viridian': gymViridian,

  'pewter-city': pewterCity,
  'pewter-pokecenter': pewterPokecenter,
  'pewter-mart': pewterMart,
  'pewter-house': pewterHouse,
  'gym-pewter': gymPewter,
  'pewter-museum': pewterMuseum,

  'cerulean-city': ceruleanCity,
  'cerulean-pokecenter': ceruleanPokecenter,
  'cerulean-mart': ceruleanMart,
  'cerulean-bike-shop': ceruleanBikeShop,
  'cerulean-house-1': ceruleanHouse1,
  'cerulean-robbed-house': ceruleanRobbedHouse,
  'gym-cerulean': gymCerulean,

  'vermilion-city': vermilionCity,
  'vermilion-pokecenter': vermilionPokecenter,
  'vermilion-mart': vermilionMart,
  'vermilion-house': vermilionHouse,
  'vermilion-fan-club': vermilionFanClub,
  'gym-vermilion': gymVermilion,
  'ss-anne-1f': ssAnne1F,

  'lavender-town': lavenderTown,
  'lavender-pokecenter': lavenderPokecenter,
  'lavender-fuji-house': lavenderFujiHouse,
  'lavender-volunteer-house': lavenderVolunteerHouse,

  'celadon-city': celadonCity,
  'celadon-pokecenter': celadonPokecenter,
  'celadon-hotel': celadonHotel,
  'celadon-restaurant': celadonRestaurant,
  'celadon-mansion': celadonMansion,
  'celadon-dept-store': celadonDeptStore,
  'celadon-game-corner': celadonGameCorner,
  'gym-celadon': gymCeladon,

  'fuchsia-city': fuchsiaCity,
  'fuchsia-pokecenter': fuchsiaPokecenter,
  'fuchsia-mart': fuchsiaMart,
  'fuchsia-house': fuchsiaHouse,
  'fuchsia-warden-house': fuchsiaWardenHouse,
  'gym-fuchsia': gymFuchsia,

  'saffron-city': saffronCity,
  'saffron-pokecenter': saffronPokecenter,
  'saffron-mart': saffronMart,
  'saffron-mr-psychic': saffronMrPsychic,
  'saffron-copycat': saffronCopycat,
  'gym-saffron': gymSaffron,
  'fighting-dojo': fightingDojo,
  'silph-co-1f': silphCo1F,
  'silph-co-7f': silphCo7F,
  'silph-co-11f': silphCo11F,

  'cinnabar-island': cinnabarIsland,
  'cinnabar-pokecenter': cinnabarPokecenter,
  'cinnabar-mart': cinnabarMart,
  'cinnabar-lab': cinnabarLab,
  'gym-cinnabar': gymCinnabar,
  'pokemon-mansion-1f': pokemonMansion1F,
  'pokemon-mansion-b1f': pokemonMansionB1F,

  'indigo-plateau': indigoPlateauExterior,
  'elite-four-lobby': eliteFourLobby,
  'elite-four-lorelei': eliteFourLorelei,
  'elite-four-bruno': eliteFourBruno,
  'elite-four-agatha': eliteFourAgatha,
  'elite-four-lance': eliteFourLance,
  'champion-room': championRoom,
  'hall-of-fame': hallOfFame,
  'indigo-pokecenter': indigoPokecenter,
  'indigo-mart': indigoMart,

  // === Routes ===
  'route-1': route1,
  'route-2': route2,
  'route-3': route3,
  'route3-pokecenter': route3Pokecenter,
  'route-4': route4,
  'route-5': route5,
  'route-6': route6,
  'route-7': route7,
  'route-8': route8,
  'route-9': route9,
  'route-10': route10,
  'route10-pokecenter': route10Pokecenter,
  'route-11': route11,
  'route-12': route12,
  'route-13': route13,
  'route-14': route14,
  'route-15': route15,
  'route-16': route16,
  'route-17': route17,
  'route-18': route18,
  'route-19': route19,
  'route-20': route20,
  'route-21': route21,
  'route-22': route22,
  'route-23': route23,
  'route-24': route24,
  'route-25': route25,

  // === Dungeons ===
  'viridian-forest': viridianForest,
  'mt-moon-1f': mtMoon1F,
  'mt-moon-b1f': mtMoonB1F,
  'mt-moon-b2f': mtMoonB2F,
  'pokemon-tower-1f': pokemonTower1F,
  'pokemon-tower-3f': pokemonTower3F,
  'pokemon-tower-5f': pokemonTower5F,
  'pokemon-tower-7f': pokemonTower7F,
  'rock-tunnel-1f': rockTunnel1F,
  'rock-tunnel-b1f': rockTunnelB1F,
  'rocket-hideout-b1f': rocketHideoutB1F,
  'rocket-hideout-b4f': rocketHideoutB4F,
  'digletts-cave': diglettsCave,
  'victory-road-1f': victoryRoad1F,
  'victory-road-2f': victoryRoad2F,
  'seafoam-islands-1f': seafoamIslands1F,
  'seafoam-islands-b1f': seafoamIslandsB1F,
  'power-plant': powerPlant,
  'safari-zone-1': safariZone1,
  'safari-zone-2': safariZone2,
  'cerulean-cave-1f': ceruleanCave1F,
  'cerulean-cave-b1f': ceruleanCaveB1F,

  // === Special ===
  'underground-path-ns': undergroundPathNS,
  'underground-path-ew': undergroundPathEW,
  'bills-house': billsHouse,
};

/** Get a map by ID, throws if not found */
export function getMap(id: string): GameMap {
  const map = MAP_REGISTRY[id];
  if (!map) throw new Error(`Map not found: ${id}`);
  return map;
}

/** Get all map IDs */
export function getAllMapIds(): string[] {
  return Object.keys(MAP_REGISTRY);
}

/** Total map count */
export const MAP_COUNT = Object.keys(MAP_REGISTRY).length;
