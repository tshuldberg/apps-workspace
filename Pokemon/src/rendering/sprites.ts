// === Sprite Generation — Player, NPCs, and 151 Pokemon ===

import type { Direction } from '../data/game-types.ts';

// Caches
const playerSprites: Map<string, OffscreenCanvas> = new Map();
const npcSprites: Map<string, OffscreenCanvas> = new Map();
const pokemonFront: Map<number, OffscreenCanvas> = new Map();
const pokemonBack: Map<number, OffscreenCanvas> = new Map();
const pokemonMini: Map<number, OffscreenCanvas> = new Map();

// === Helpers ===
function createCanvas(w: number, h: number): [OffscreenCanvas, OffscreenCanvasRenderingContext2D] {
  const c = new OffscreenCanvas(w, h);
  return [c, c.getContext('2d')!];
}

function px(ctx: OffscreenCanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function ellipse(ctx: OffscreenCanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    for (let x = -rx; x <= rx; x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
}

// === Init ===
export function initSprites(): void {
  // Sprites are lazily generated on first access
  playerSprites.clear();
  npcSprites.clear();
  pokemonFront.clear();
  pokemonBack.clear();
  pokemonMini.clear();
}

// === Player Sprites ===
const PLAYER_COLORS = { hat: '#D03030', shirt: '#3060C0', skin: '#F0C080', pants: '#405060', shoe: '#303030' };

function drawPlayerSprite(dir: Direction, frame: number): OffscreenCanvas {
  const [c, ctx] = createCanvas(16, 16);
  const col = PLAYER_COLORS;
  const walk = frame % 2;

  // Head (all directions)
  px(ctx, 5, 0, 6, 2, col.hat);    // hat brim
  px(ctx, 6, 0, 4, 1, col.hat);

  if (dir === 'down') {
    px(ctx, 5, 2, 6, 4, col.skin); // face
    px(ctx, 6, 3, 1, 1, '#000');    // left eye
    px(ctx, 9, 3, 1, 1, '#000');    // right eye
    px(ctx, 7, 5, 2, 1, col.skin); // mouth area
    px(ctx, 5, 6, 6, 4, col.shirt);// shirt
    px(ctx, 4, 7, 1, 3, col.skin); // left arm
    px(ctx, 11, 7, 1, 3, col.skin);// right arm
    px(ctx, 5, 10, 3, 3, col.pants);// left leg
    px(ctx, 8, 10, 3, 3, col.pants);// right leg
    px(ctx, 5, 13, 3, 2, col.shoe);
    px(ctx, 8, 13, 3, 2, col.shoe);
    if (walk) { px(ctx, 4, 13, 3, 2, col.shoe); px(ctx, 9, 13, 3, 2, col.shoe); }
  } else if (dir === 'up') {
    px(ctx, 5, 1, 6, 5, col.hat);  // back of hat
    px(ctx, 5, 6, 6, 4, col.shirt);
    px(ctx, 4, 7, 1, 3, col.skin);
    px(ctx, 11, 7, 1, 3, col.skin);
    px(ctx, 5, 10, 3, 3, col.pants);
    px(ctx, 8, 10, 3, 3, col.pants);
    px(ctx, 5, 13, 3, 2, col.shoe);
    px(ctx, 8, 13, 3, 2, col.shoe);
    if (walk) { px(ctx, 4, 13, 3, 2, col.shoe); px(ctx, 9, 13, 3, 2, col.shoe); }
  } else if (dir === 'left') {
    px(ctx, 5, 1, 5, 2, col.hat);
    px(ctx, 5, 2, 5, 4, col.skin);
    px(ctx, 5, 3, 1, 1, '#000');   // eye
    px(ctx, 5, 6, 5, 4, col.shirt);
    px(ctx, 10, 7, 1, 3, col.skin);
    px(ctx, 6, 10, 4, 3, col.pants);
    px(ctx, 6, 13, 2, 2, col.shoe);
    px(ctx, 8, 13, 2, 2, col.shoe);
    if (walk) { px(ctx, 5, 13, 2, 2, col.shoe); px(ctx, 9, 13, 2, 2, col.shoe); }
  } else { // right
    px(ctx, 6, 1, 5, 2, col.hat);
    px(ctx, 6, 2, 5, 4, col.skin);
    px(ctx, 10, 3, 1, 1, '#000');
    px(ctx, 6, 6, 5, 4, col.shirt);
    px(ctx, 5, 7, 1, 3, col.skin);
    px(ctx, 6, 10, 4, 3, col.pants);
    px(ctx, 6, 13, 2, 2, col.shoe);
    px(ctx, 8, 13, 2, 2, col.shoe);
    if (walk) { px(ctx, 5, 13, 2, 2, col.shoe); px(ctx, 9, 13, 2, 2, col.shoe); }
  }
  return c;
}

export function getPlayerSprite(direction: Direction, frame: number): OffscreenCanvas {
  const key = `${direction}-${frame % 2}`;
  let s = playerSprites.get(key);
  if (!s) { s = drawPlayerSprite(direction, frame); playerSprites.set(key, s); }
  return s;
}

// === NPC Sprites ===
interface NpcDef { hair: string; top: string; bottom: string; skin: string; extra?: string }

const NPC_DEFS: Record<string, NpcDef> = {
  'boy':          { hair: '#604020', top: '#30A030', bottom: '#405060', skin: '#F0C080' },
  'girl':         { hair: '#D06030', top: '#E06080', bottom: '#C04060', skin: '#F0C080' },
  'old-man':      { hair: '#C0C0C0', top: '#806040', bottom: '#504030', skin: '#E0B070' },
  'old-woman':    { hair: '#C0C0C0', top: '#8060A0', bottom: '#605080', skin: '#E0B070' },
  'scientist':    { hair: '#606060', top: '#F0F0F0', bottom: '#D0D0D0', skin: '#F0C080' },
  'rocket-grunt': { hair: '#303030', top: '#303030', bottom: '#303030', skin: '#F0C080', extra: '#D03030' },
  'nurse':        { hair: '#E08090', top: '#F0F0F0', bottom: '#F0F0F0', skin: '#F0C080', extra: '#D03030' },
  'clerk':        { hair: '#604020', top: '#3060C0', bottom: '#304080', skin: '#F0C080' },
  'gentleman':    { hair: '#404040', top: '#202020', bottom: '#303030', skin: '#F0C080' },
  'beauty':       { hair: '#D0A040', top: '#E04080', bottom: '#C03060', skin: '#F0C080' },
  'bug-catcher':  { hair: '#80A030', top: '#F0F0E0', bottom: '#607030', skin: '#F0C080' },
  'youngster':    { hair: '#604020', top: '#E06000', bottom: '#406080', skin: '#F0C080' },
  'lass':         { hair: '#E08040', top: '#F0A040', bottom: '#D08030', skin: '#F0C080' },
  'hiker':        { hair: '#604020', top: '#806040', bottom: '#604020', skin: '#D0A060' },
  'swimmer':      { hair: '#3060C0', top: '#F0C080', bottom: '#3060C0', skin: '#F0C080' },
  'biker':        { hair: '#303030', top: '#202020', bottom: '#404040', skin: '#F0C080' },
  'officer':      { hair: '#3050A0', top: '#3050A0', bottom: '#3050A0', skin: '#F0C080' },
  'sailor':       { hair: '#604020', top: '#F0F0F0', bottom: '#3050A0', skin: '#F0C080' },
  'fisher':       { hair: '#604020', top: '#D0C080', bottom: '#607040', skin: '#D0A060' },
  'gym-leader':   { hair: '#A03030', top: '#D03030', bottom: '#202020', skin: '#F0C080' },
};

function drawNpcSprite(type: string, dir: Direction, frame: number): OffscreenCanvas {
  const def = NPC_DEFS[type] ?? NPC_DEFS['boy']!;
  const [c, ctx] = createCanvas(16, 16);
  const walk = frame % 2;

  // Hair/head
  px(ctx, 5, 0, 6, 3, def.hair);
  // Face
  if (dir === 'down') {
    px(ctx, 5, 3, 6, 3, def.skin);
    px(ctx, 6, 4, 1, 1, '#000');
    px(ctx, 9, 4, 1, 1, '#000');
  } else if (dir === 'up') {
    px(ctx, 5, 2, 6, 4, def.hair);
  } else if (dir === 'left') {
    px(ctx, 5, 3, 5, 3, def.skin);
    px(ctx, 5, 4, 1, 1, '#000');
  } else {
    px(ctx, 6, 3, 5, 3, def.skin);
    px(ctx, 10, 4, 1, 1, '#000');
  }
  // Body
  px(ctx, 5, 6, 6, 4, def.top);
  if (def.extra && type === 'rocket-grunt') {
    px(ctx, 7, 7, 2, 2, def.extra); // R logo
  }
  if (def.extra && type === 'nurse') {
    px(ctx, 7, 0, 2, 1, def.extra); // nurse cap cross
  }
  // Arms
  px(ctx, 4, 7, 1, 3, def.skin);
  px(ctx, 11, 7, 1, 3, def.skin);
  // Legs
  px(ctx, 5, 10, 3, 3, def.bottom);
  px(ctx, 8, 10, 3, 3, def.bottom);
  // Feet
  px(ctx, 5, 13, 3, 2, '#303030');
  px(ctx, 8, 13, 3, 2, '#303030');
  if (walk) {
    px(ctx, 4, 14, 3, 1, '#303030');
    px(ctx, 9, 14, 3, 1, '#303030');
  }
  return c;
}

export function getNpcSprite(type: string, direction: Direction, frame: number): OffscreenCanvas {
  const key = `${type}-${direction}-${frame % 2}`;
  let s = npcSprites.get(key);
  if (!s) { s = drawNpcSprite(type, direction, frame); npcSprites.set(key, s); }
  return s;
}

// === Pokemon Sprite Data ===
// Body shape templates and per-species color/feature definitions

type BodyType = 'quadruped' | 'biped-small' | 'biped-tall' | 'bird' | 'fish' | 'serpent'
  | 'amorphous' | 'insectoid' | 'shell' | 'floating';

interface PokemonVisual {
  body: BodyType;
  color1: string;   // primary
  color2: string;   // secondary
  color3?: string;  // accent
  features?: string; // special drawing instructions
}

// All 151 Pokemon visual definitions
const POKEMON_VISUALS: Record<number, PokemonVisual> = {
  // Gen 1 Starters line
  1:   { body: 'quadruped', color1: '#60A860', color2: '#408040', color3: '#C03030', features: 'bulb' },
  2:   { body: 'quadruped', color1: '#50A050', color2: '#307030', color3: '#E04050', features: 'bulb-big' },
  3:   { body: 'quadruped', color1: '#408048', color2: '#206028', color3: '#E04050', features: 'flower' },
  4:   { body: 'biped-small', color1: '#E07030', color2: '#F0A030', color3: '#E03020', features: 'flame-tail' },
  5:   { body: 'biped-small', color1: '#D06030', color2: '#E08030', color3: '#E03020', features: 'flame-tail' },
  6:   { body: 'biped-tall', color1: '#E07030', color2: '#F0A040', color3: '#E03020', features: 'wings-flame' },
  7:   { body: 'biped-small', color1: '#5090D0', color2: '#C0A060', features: 'shell-back' },
  8:   { body: 'biped-small', color1: '#4080C0', color2: '#B09050', features: 'shell-back' },
  9:   { body: 'biped-tall', color1: '#4080C0', color2: '#B09050', features: 'cannons' },
  // Caterpie line
  10:  { body: 'insectoid', color1: '#60A030', color2: '#F0D040', features: 'caterpillar' },
  11:  { body: 'insectoid', color1: '#60A048', color2: '#408030' },
  12:  { body: 'insectoid', color1: '#A0A0C0', color2: '#5050A0', features: 'butterfly' },
  // Weedle line
  13:  { body: 'insectoid', color1: '#C09040', color2: '#E0B060', features: 'horn' },
  14:  { body: 'insectoid', color1: '#C0A050', color2: '#A08040' },
  15:  { body: 'insectoid', color1: '#D0C040', color2: '#403020', features: 'stingers' },
  // Pidgey line
  16:  { body: 'bird', color1: '#B09070', color2: '#D0B090', color3: '#E0C0A0' },
  17:  { body: 'bird', color1: '#A08060', color2: '#D0B080', color3: '#D06060' },
  18:  { body: 'bird', color1: '#C09050', color2: '#E0C080', color3: '#E06050' },
  // Rattata line
  19:  { body: 'quadruped', color1: '#9060A0', color2: '#F0E0C0' },
  20:  { body: 'quadruped', color1: '#A07040', color2: '#F0D0A0' },
  // Spearow line
  21:  { body: 'bird', color1: '#A06040', color2: '#D09070', color3: '#D04040' },
  22:  { body: 'bird', color1: '#B07050', color2: '#D0A080' },
  // Ekans line
  23:  { body: 'serpent', color1: '#8060A0', color2: '#D0C040' },
  24:  { body: 'serpent', color1: '#7050A0', color2: '#D0C040', features: 'cobra' },
  // Pikachu line
  25:  { body: 'biped-small', color1: '#F0D040', color2: '#E0A020', color3: '#D03030', features: 'pikachu' },
  26:  { body: 'biped-small', color1: '#E0A020', color2: '#C08010', color3: '#503020', features: 'raichu' },
  // Sandshrew line
  27:  { body: 'biped-small', color1: '#D0B060', color2: '#C09040' },
  28:  { body: 'biped-small', color1: '#C0A050', color2: '#B08030', features: 'spikes' },
  // Nidoran line
  29:  { body: 'quadruped', color1: '#6080C0', color2: '#4060A0', features: 'horn-small' },
  30:  { body: 'biped-small', color1: '#5070B0', color2: '#4060A0' },
  31:  { body: 'biped-tall', color1: '#5070B0', color2: '#4060A0', features: 'armor' },
  32:  { body: 'quadruped', color1: '#A060B0', color2: '#805090', features: 'horn-small' },
  33:  { body: 'biped-small', color1: '#9050A0', color2: '#804090' },
  34:  { body: 'biped-tall', color1: '#9050A0', color2: '#804090', features: 'horn-big' },
  // Clefairy line
  35:  { body: 'biped-small', color1: '#F0A0B0', color2: '#E08090', features: 'fairy' },
  36:  { body: 'biped-small', color1: '#F0A0B0', color2: '#E08090', features: 'fairy-big' },
  // Vulpix line
  37:  { body: 'quadruped', color1: '#D07030', color2: '#E0A050', features: 'tails' },
  38:  { body: 'quadruped', color1: '#E0C070', color2: '#F0D090', features: 'nine-tails' },
  // Jigglypuff line
  39:  { body: 'amorphous', color1: '#F0A0B0', color2: '#80C0E0', features: 'round' },
  40:  { body: 'amorphous', color1: '#F0A0B0', color2: '#80C0E0', features: 'round-big' },
  // Zubat line
  41:  { body: 'bird', color1: '#6060C0', color2: '#8080D0', features: 'bat' },
  42:  { body: 'bird', color1: '#7060B0', color2: '#9080C0', features: 'bat-big' },
  // Oddish line
  43:  { body: 'amorphous', color1: '#4060C0', color2: '#50A050' },
  44:  { body: 'amorphous', color1: '#4060C0', color2: '#D04040', features: 'flower-head' },
  45:  { body: 'amorphous', color1: '#4060C0', color2: '#D04040', features: 'big-flower' },
  // Paras line
  46:  { body: 'insectoid', color1: '#E0A050', color2: '#D05030', features: 'mushroom' },
  47:  { body: 'insectoid', color1: '#E0A050', color2: '#D05030', features: 'big-mushroom' },
  // Venonat line
  48:  { body: 'amorphous', color1: '#8050A0', color2: '#D04040', features: 'big-eyes' },
  49:  { body: 'insectoid', color1: '#8060A0', color2: '#D0D0F0', features: 'moth' },
  // Diglett line
  50:  { body: 'amorphous', color1: '#B08050', color2: '#F0C0A0', features: 'diglett' },
  51:  { body: 'amorphous', color1: '#B08050', color2: '#F0C0A0', features: 'dugtrio' },
  // Meowth line
  52:  { body: 'biped-small', color1: '#F0D080', color2: '#E0B060', features: 'cat' },
  53:  { body: 'quadruped', color1: '#F0D080', color2: '#E0B060', features: 'cat-big' },
  // Psyduck line
  54:  { body: 'biped-small', color1: '#F0D060', color2: '#D0B040' },
  55:  { body: 'biped-small', color1: '#5090D0', color2: '#4080C0' },
  // Mankey line
  56:  { body: 'biped-small', color1: '#E0C090', color2: '#B09060', features: 'round' },
  57:  { body: 'biped-small', color1: '#C09060', color2: '#A07040' },
  // Growlithe line
  58:  { body: 'quadruped', color1: '#E08030', color2: '#F0D080', color3: '#302020' },
  59:  { body: 'quadruped', color1: '#E08030', color2: '#F0D080', features: 'mane' },
  // Poliwag line
  60:  { body: 'amorphous', color1: '#5080D0', color2: '#F0F0F0', features: 'spiral' },
  61:  { body: 'biped-small', color1: '#5080D0', color2: '#F0F0F0', features: 'spiral' },
  62:  { body: 'biped-tall', color1: '#5080D0', color2: '#F0F0F0', features: 'spiral' },
  // Abra line
  63:  { body: 'biped-small', color1: '#E0C050', color2: '#C0A040' },
  64:  { body: 'biped-small', color1: '#D0A040', color2: '#B08030', features: 'mustache' },
  65:  { body: 'biped-tall', color1: '#D0A040', color2: '#B08030', features: 'mustache' },
  // Machop line
  66:  { body: 'biped-small', color1: '#8090A0', color2: '#607080' },
  67:  { body: 'biped-tall', color1: '#8090A0', color2: '#607080' },
  68:  { body: 'biped-tall', color1: '#8090A0', color2: '#607080', features: 'four-arms' },
  // Bellsprout line
  69:  { body: 'biped-small', color1: '#60A030', color2: '#D0A030', features: 'plant' },
  70:  { body: 'biped-small', color1: '#50A030', color2: '#C09030', features: 'plant' },
  71:  { body: 'biped-tall', color1: '#50A030', color2: '#C09030', features: 'pitcher' },
  // Tentacool line
  72:  { body: 'floating', color1: '#5090D0', color2: '#D03040', features: 'tentacles' },
  73:  { body: 'floating', color1: '#4080C0', color2: '#D03040', features: 'tentacles-big' },
  // Geodude line
  74:  { body: 'amorphous', color1: '#A09080', color2: '#807060' },
  75:  { body: 'amorphous', color1: '#A09080', color2: '#807060' },
  76:  { body: 'amorphous', color1: '#A09080', color2: '#807060', features: 'rocky' },
  // Ponyta line
  77:  { body: 'quadruped', color1: '#F0D080', color2: '#E04020', features: 'fire-mane' },
  78:  { body: 'quadruped', color1: '#F0E0A0', color2: '#E04020', features: 'fire-mane' },
  // Slowpoke line
  79:  { body: 'quadruped', color1: '#F0A0B0', color2: '#E08090' },
  80:  { body: 'biped-tall', color1: '#F0A0B0', color2: '#A0A0B0', features: 'shell-tail' },
  // Magnemite line
  81:  { body: 'floating', color1: '#A0A0B0', color2: '#606070', features: 'magnet' },
  82:  { body: 'floating', color1: '#A0A0B0', color2: '#606070', features: 'triple' },
  // Farfetch'd
  83:  { body: 'bird', color1: '#B09060', color2: '#60A030', features: 'leek' },
  // Doduo line
  84:  { body: 'bird', color1: '#B08050', color2: '#D0A070', features: 'two-heads' },
  85:  { body: 'bird', color1: '#B08050', color2: '#D0A070', features: 'three-heads' },
  // Seel line
  86:  { body: 'fish', color1: '#D0D8E0', color2: '#F0F0F0' },
  87:  { body: 'fish', color1: '#E0E0E8', color2: '#F0F0F0', features: 'horn' },
  // Grimer line
  88:  { body: 'amorphous', color1: '#8060A0', color2: '#604080' },
  89:  { body: 'amorphous', color1: '#7050A0', color2: '#503070' },
  // Shellder line
  90:  { body: 'shell', color1: '#8060A0', color2: '#F0A0B0' },
  91:  { body: 'shell', color1: '#7050A0', color2: '#E090A0', features: 'spiky-shell' },
  // Gastly line
  92:  { body: 'floating', color1: '#404060', color2: '#6060A0', features: 'gas' },
  93:  { body: 'floating', color1: '#505070', color2: '#8060A0' },
  94:  { body: 'biped-small', color1: '#505070', color2: '#8060A0', features: 'spiky' },
  // Onix
  95:  { body: 'serpent', color1: '#A09890', color2: '#807870', features: 'rocky' },
  // Drowzee line
  96:  { body: 'biped-small', color1: '#D0A050', color2: '#806040' },
  97:  { body: 'biped-tall', color1: '#D0A050', color2: '#806040', features: 'pendulum' },
  // Krabby line
  98:  { body: 'insectoid', color1: '#D06030', color2: '#E08050', features: 'crab' },
  99:  { body: 'insectoid', color1: '#D06030', color2: '#E08050', features: 'crab-big' },
  // Voltorb line
  100: { body: 'amorphous', color1: '#D04040', color2: '#F0F0F0', features: 'ball' },
  101: { body: 'amorphous', color1: '#F0F0F0', color2: '#D04040', features: 'ball-flip' },
  // Exeggcute line
  102: { body: 'amorphous', color1: '#F0D0B0', color2: '#60A030', features: 'eggs' },
  103: { body: 'biped-tall', color1: '#D0A060', color2: '#60A030', features: 'palm-tree' },
  // Cubone line
  104: { body: 'biped-small', color1: '#C09050', color2: '#F0F0E0', features: 'skull' },
  105: { body: 'biped-small', color1: '#A07040', color2: '#F0F0E0', features: 'skull-club' },
  // Hitmonlee / Hitmonchan
  106: { body: 'biped-tall', color1: '#C09060', color2: '#A07040', features: 'long-legs' },
  107: { body: 'biped-tall', color1: '#C09060', color2: '#A07040', features: 'boxing' },
  // Lickitung
  108: { body: 'biped-small', color1: '#F0A0B0', color2: '#D06080', features: 'tongue' },
  // Koffing line
  109: { body: 'floating', color1: '#8060A0', color2: '#D0C040', features: 'gas-cloud' },
  110: { body: 'floating', color1: '#8060A0', color2: '#D0C040', features: 'double-gas' },
  // Rhyhorn line
  111: { body: 'quadruped', color1: '#A09090', color2: '#807070', features: 'horn-big' },
  112: { body: 'biped-tall', color1: '#A09090', color2: '#807070', features: 'drill-horn' },
  // Chansey
  113: { body: 'biped-small', color1: '#F0A0B0', color2: '#F0F0F0', features: 'egg-pouch' },
  // Tangela
  114: { body: 'amorphous', color1: '#4060C0', color2: '#3050B0', features: 'vines' },
  // Kangaskhan
  115: { body: 'biped-tall', color1: '#B09060', color2: '#D0B080', features: 'pouch' },
  // Horsea line
  116: { body: 'fish', color1: '#5090D0', color2: '#4080C0' },
  117: { body: 'fish', color1: '#5090D0', color2: '#4080C0', features: 'fins' },
  // Goldeen line
  118: { body: 'fish', color1: '#F0A070', color2: '#F0F0F0', color3: '#D04040' },
  119: { body: 'fish', color1: '#F0A070', color2: '#F0F0F0', features: 'horn' },
  // Staryu line
  120: { body: 'floating', color1: '#C09040', color2: '#D04040', features: 'star' },
  121: { body: 'floating', color1: '#A070C0', color2: '#D04040', features: 'star-big' },
  // Mr. Mime
  122: { body: 'biped-tall', color1: '#F0A0B0', color2: '#4060C0' },
  // Scyther
  123: { body: 'insectoid', color1: '#60A030', color2: '#90C060', features: 'scythes' },
  // Jynx
  124: { body: 'biped-tall', color1: '#A050A0', color2: '#D04060', features: 'hair' },
  // Electabuzz
  125: { body: 'biped-tall', color1: '#F0D040', color2: '#302020' },
  // Magmar
  126: { body: 'biped-tall', color1: '#E06030', color2: '#F0D040', features: 'flame-body' },
  // Pinsir
  127: { body: 'insectoid', color1: '#A08060', color2: '#806040', features: 'pincers' },
  // Tauros
  128: { body: 'quadruped', color1: '#B09060', color2: '#806040', features: 'horns-bull' },
  // Magikarp line
  129: { body: 'fish', color1: '#E08040', color2: '#F0D060', features: 'fish-whiskers' },
  130: { body: 'serpent', color1: '#4070C0', color2: '#F0E0C0', features: 'gyarados' },
  // Lapras
  131: { body: 'fish', color1: '#5090D0', color2: '#E0D0B0', features: 'shell-big' },
  // Ditto
  132: { body: 'amorphous', color1: '#C0A0D0', color2: '#A080B0', features: 'blob' },
  // Eevee line
  133: { body: 'quadruped', color1: '#C09060', color2: '#F0E0C0', features: 'fluffy' },
  134: { body: 'quadruped', color1: '#5090D0', color2: '#4080C0', features: 'fins' },
  135: { body: 'quadruped', color1: '#F0D040', color2: '#F0F0F0', features: 'spiky' },
  136: { body: 'quadruped', color1: '#E06030', color2: '#F0D080', features: 'mane' },
  // Porygon
  137: { body: 'biped-small', color1: '#F0A0B0', color2: '#4080D0', features: 'angular' },
  // Omanyte line
  138: { body: 'shell', color1: '#5090D0', color2: '#B09060' },
  139: { body: 'shell', color1: '#5090D0', color2: '#B09060', features: 'tentacles' },
  // Kabuto line
  140: { body: 'shell', color1: '#A08050', color2: '#302020' },
  141: { body: 'biped-tall', color1: '#A08050', color2: '#806040', features: 'scythes' },
  // Aerodactyl
  142: { body: 'bird', color1: '#A090A0', color2: '#807080', features: 'pterodactyl' },
  // Snorlax
  143: { body: 'biped-tall', color1: '#306060', color2: '#E0D0B0', features: 'fat' },
  // Articuno
  144: { body: 'bird', color1: '#5090D0', color2: '#90C0E0', features: 'legendary-bird' },
  // Zapdos
  145: { body: 'bird', color1: '#F0D040', color2: '#E0A020', features: 'legendary-bird' },
  // Moltres
  146: { body: 'bird', color1: '#E06030', color2: '#F0D040', features: 'legendary-bird' },
  // Dratini line
  147: { body: 'serpent', color1: '#5090D0', color2: '#F0F0F0' },
  148: { body: 'serpent', color1: '#5090D0', color2: '#F0F0F0', features: 'wings-small' },
  149: { body: 'biped-tall', color1: '#E0A040', color2: '#40A060', features: 'dragon' },
  // Mewtwo / Mew
  150: { body: 'biped-tall', color1: '#C0A0D0', color2: '#A080C0', features: 'mewtwo' },
  151: { body: 'floating', color1: '#F0A0B0', color2: '#E08090', features: 'mew' },
};

// === Body Template Renderers (front sprite, 56x56) ===

function drawQuadruped(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Body
  ellipse(ctx, 28, 32, 16, 12, v.color1);
  // Head
  ellipse(ctx, 28, 18, 10, 8, v.color1);
  // Eyes
  px(ctx, 22, 16, 2, 2, '#000');
  px(ctx, 30, 16, 2, 2, '#000');
  // Eye highlights
  px(ctx, 23, 16, 1, 1, '#FFF');
  px(ctx, 31, 16, 1, 1, '#FFF');
  // Legs
  px(ctx, 14, 40, 5, 10, v.color2);
  px(ctx, 22, 40, 5, 10, v.color2);
  px(ctx, 30, 40, 5, 10, v.color2);
  px(ctx, 38, 40, 5, 10, v.color2);
  // Mouth
  px(ctx, 26, 22, 4, 1, v.color2);
}

function drawBipedSmall(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Body
  ellipse(ctx, 28, 30, 12, 14, v.color1);
  // Head
  ellipse(ctx, 28, 16, 10, 8, v.color1);
  // Eyes
  px(ctx, 22, 14, 2, 3, '#000');
  px(ctx, 32, 14, 2, 3, '#000');
  px(ctx, 23, 14, 1, 1, '#FFF');
  px(ctx, 33, 14, 1, 1, '#FFF');
  // Arms
  px(ctx, 12, 26, 5, 4, v.color1);
  px(ctx, 39, 26, 5, 4, v.color1);
  // Feet
  px(ctx, 20, 44, 6, 4, v.color2);
  px(ctx, 30, 44, 6, 4, v.color2);
}

function drawBipedTall(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Torso
  ellipse(ctx, 28, 30, 10, 16, v.color1);
  // Head
  ellipse(ctx, 28, 12, 9, 8, v.color1);
  // Eyes
  px(ctx, 22, 10, 2, 3, '#000');
  px(ctx, 32, 10, 2, 3, '#000');
  px(ctx, 23, 10, 1, 1, '#FFF');
  px(ctx, 33, 10, 1, 1, '#FFF');
  // Arms
  px(ctx, 12, 22, 6, 4, v.color1);
  px(ctx, 38, 22, 6, 4, v.color1);
  // Legs
  px(ctx, 20, 44, 6, 8, v.color2);
  px(ctx, 30, 44, 6, 8, v.color2);
}

function drawBird(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Body
  ellipse(ctx, 28, 30, 12, 10, v.color1);
  // Head
  ellipse(ctx, 28, 16, 8, 7, v.color1);
  // Beak
  px(ctx, 20, 18, 4, 2, '#E0A030');
  // Eye
  px(ctx, 30, 14, 2, 2, '#000');
  px(ctx, 31, 14, 1, 1, '#FFF');
  // Wings
  px(ctx, 8, 24, 10, 6, v.color2);
  px(ctx, 38, 24, 10, 6, v.color2);
  // Tail
  px(ctx, 38, 34, 8, 4, v.color2);
  // Feet
  px(ctx, 22, 40, 3, 6, '#E0A030');
  px(ctx, 31, 40, 3, 6, '#E0A030');
}

function drawFish(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Body
  ellipse(ctx, 28, 28, 14, 12, v.color1);
  // Eye
  px(ctx, 20, 24, 3, 3, '#000');
  px(ctx, 21, 24, 1, 1, '#FFF');
  // Tail fin
  px(ctx, 42, 22, 6, 4, v.color2);
  px(ctx, 42, 28, 6, 4, v.color2);
  // Top fin
  px(ctx, 24, 14, 8, 4, v.color2);
  // Mouth
  px(ctx, 14, 28, 2, 2, v.color2);
  // Belly
  ellipse(ctx, 28, 34, 10, 5, v.color2);
}

function drawSerpent(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Coiled body
  ellipse(ctx, 28, 36, 14, 10, v.color1);
  ellipse(ctx, 22, 28, 8, 6, v.color1);
  ellipse(ctx, 28, 20, 6, 6, v.color1);
  // Head
  ellipse(ctx, 32, 12, 7, 6, v.color1);
  // Eyes
  px(ctx, 28, 10, 2, 2, '#000');
  px(ctx, 34, 10, 2, 2, '#000');
  px(ctx, 29, 10, 1, 1, '#FFF');
  px(ctx, 35, 10, 1, 1, '#FFF');
  // Belly pattern
  ellipse(ctx, 28, 38, 8, 5, v.color2);
  // Tongue
  px(ctx, 26, 14, 3, 1, '#D03040');
  px(ctx, 24, 15, 2, 1, '#D03040');
}

function drawAmorphous(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Blob body
  ellipse(ctx, 28, 30, 16, 14, v.color1);
  // Highlight
  ellipse(ctx, 24, 24, 6, 4, v.color2);
  // Eyes
  px(ctx, 22, 24, 3, 3, '#000');
  px(ctx, 32, 24, 3, 3, '#000');
  px(ctx, 23, 24, 1, 1, '#FFF');
  px(ctx, 33, 24, 1, 1, '#FFF');
  // Mouth
  px(ctx, 26, 32, 4, 2, '#000');
}

function drawInsectoid(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Abdomen
  ellipse(ctx, 28, 36, 10, 8, v.color1);
  // Thorax
  ellipse(ctx, 28, 26, 8, 6, v.color2);
  // Head
  ellipse(ctx, 28, 16, 8, 6, v.color1);
  // Eyes (large compound)
  px(ctx, 20, 12, 4, 4, '#D04040');
  px(ctx, 32, 12, 4, 4, '#D04040');
  // Legs
  px(ctx, 14, 30, 6, 2, v.color2);
  px(ctx, 36, 30, 6, 2, v.color2);
  px(ctx, 16, 34, 6, 2, v.color2);
  px(ctx, 34, 34, 6, 2, v.color2);
  // Antennae
  px(ctx, 22, 8, 1, 4, v.color2);
  px(ctx, 33, 8, 1, 4, v.color2);
}

function drawShell(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Shell
  ellipse(ctx, 28, 30, 16, 14, v.color1);
  // Shell ridges
  for (let i = 0; i < 4; i++) {
    px(ctx, 16 + i * 6, 20, 2, 20, v.color2);
  }
  // Opening
  ellipse(ctx, 28, 28, 8, 6, '#000');
  ellipse(ctx, 28, 28, 6, 4, v.color2);
  // Eyes in opening
  px(ctx, 24, 26, 2, 2, '#000');
  px(ctx, 30, 26, 2, 2, '#000');
}

function drawFloating(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  // Body
  ellipse(ctx, 28, 26, 12, 10, v.color1);
  // Core/face area
  ellipse(ctx, 28, 24, 6, 6, v.color2);
  // Eyes
  px(ctx, 24, 22, 2, 2, '#000');
  px(ctx, 30, 22, 2, 2, '#000');
  px(ctx, 25, 22, 1, 1, '#FFF');
  px(ctx, 31, 22, 1, 1, '#FFF');
}

function drawFrontBody(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual) {
  switch (v.body) {
    case 'quadruped': drawQuadruped(ctx, v); break;
    case 'biped-small': drawBipedSmall(ctx, v); break;
    case 'biped-tall': drawBipedTall(ctx, v); break;
    case 'bird': drawBird(ctx, v); break;
    case 'fish': drawFish(ctx, v); break;
    case 'serpent': drawSerpent(ctx, v); break;
    case 'amorphous': drawAmorphous(ctx, v); break;
    case 'insectoid': drawInsectoid(ctx, v); break;
    case 'shell': drawShell(ctx, v); break;
    case 'floating': drawFloating(ctx, v); break;
  }
}

// === Feature overlays for specific Pokemon ===
function drawFeatures(ctx: OffscreenCanvasRenderingContext2D, v: PokemonVisual, _id: number) {
  const f = v.features;
  if (!f) return;

  switch (f) {
    case 'bulb':
      ellipse(ctx, 28, 26, 8, 6, v.color2!);
      break;
    case 'bulb-big':
      ellipse(ctx, 28, 22, 10, 8, v.color2!);
      px(ctx, 26, 14, 4, 4, v.color3 ?? '#E04050');
      break;
    case 'flower':
      ellipse(ctx, 28, 18, 12, 8, v.color3 ?? '#E04050');
      ellipse(ctx, 28, 18, 6, 4, '#F0D040');
      break;
    case 'flame-tail':
      px(ctx, 40, 36, 4, 3, '#E04020');
      px(ctx, 42, 33, 3, 3, '#F0A020');
      px(ctx, 43, 30, 2, 3, '#F0D040');
      break;
    case 'wings-flame':
      px(ctx, 6, 16, 10, 4, '#60A0E0');
      px(ctx, 40, 16, 10, 4, '#60A0E0');
      px(ctx, 8, 14, 6, 2, '#60A0E0');
      px(ctx, 42, 14, 6, 2, '#60A0E0');
      // Tail flame
      px(ctx, 42, 38, 4, 3, '#E04020');
      px(ctx, 44, 35, 3, 3, '#F0A020');
      break;
    case 'shell-back':
      ellipse(ctx, 28, 34, 10, 6, v.color2!);
      break;
    case 'cannons':
      px(ctx, 8, 18, 6, 4, '#808080');
      px(ctx, 42, 18, 6, 4, '#808080');
      break;
    case 'pikachu':
      // Ears
      px(ctx, 18, 4, 3, 8, '#F0D040');
      px(ctx, 35, 4, 3, 8, '#F0D040');
      px(ctx, 18, 4, 3, 3, '#303030');
      px(ctx, 35, 4, 3, 3, '#303030');
      // Red cheeks
      px(ctx, 18, 18, 3, 3, '#D03030');
      px(ctx, 35, 18, 3, 3, '#D03030');
      // Lightning tail
      px(ctx, 42, 20, 4, 2, '#F0D040');
      px(ctx, 44, 22, 4, 2, '#F0D040');
      px(ctx, 46, 18, 4, 2, '#F0D040');
      break;
    case 'raichu':
      // Ears
      px(ctx, 18, 4, 4, 10, '#C08010');
      px(ctx, 34, 4, 4, 10, '#C08010');
      // Tail
      px(ctx, 40, 28, 3, 12, '#503020');
      px(ctx, 43, 20, 6, 3, '#F0D040');
      break;
    case 'butterfly':
      px(ctx, 4, 12, 14, 10, '#D0D0F0');
      px(ctx, 38, 12, 14, 10, '#D0D0F0');
      px(ctx, 6, 14, 4, 4, '#5050A0');
      px(ctx, 46, 14, 4, 4, '#5050A0');
      break;
    case 'caterpillar':
      // Segments
      for (let i = 0; i < 4; i++) {
        ellipse(ctx, 28, 24 + i * 6, 8 - i, 4, v.color1);
      }
      break;
    case 'horn':
      px(ctx, 26, 6, 4, 6, '#D08040');
      break;
    case 'stingers':
      px(ctx, 10, 20, 4, 2, '#F0F0E0');
      px(ctx, 42, 20, 4, 2, '#F0F0E0');
      px(ctx, 10, 16, 4, 2, '#F0F0E0');
      px(ctx, 42, 16, 4, 2, '#F0F0E0');
      break;
    case 'spiral':
      // Belly spiral
      ctx.fillStyle = '#000';
      px(ctx, 26, 28, 4, 1, '#000');
      px(ctx, 30, 28, 1, 4, '#000');
      px(ctx, 26, 32, 4, 1, '#000');
      px(ctx, 26, 28, 1, 2, '#000');
      break;
    case 'diglett':
      // Ground around
      px(ctx, 0, 38, 56, 18, '#B08050');
      ellipse(ctx, 28, 36, 8, 6, '#F0C0A0');
      px(ctx, 24, 30, 2, 2, '#000');
      px(ctx, 30, 30, 2, 2, '#000');
      px(ctx, 27, 34, 2, 1, '#000');
      break;
    case 'dugtrio':
      px(ctx, 0, 34, 56, 22, '#B08050');
      for (const dx of [12, 28, 44]) {
        ellipse(ctx, dx, 30, 6, 5, '#F0C0A0');
        px(ctx, dx - 3, 26, 2, 2, '#000');
        px(ctx, dx + 1, 26, 2, 2, '#000');
      }
      break;
    case 'cat':
      // Ears
      px(ctx, 20, 6, 3, 4, v.color1);
      px(ctx, 33, 6, 3, 4, v.color1);
      // Whiskers
      px(ctx, 14, 18, 6, 1, '#404040');
      px(ctx, 36, 18, 6, 1, '#404040');
      // Coin on forehead
      px(ctx, 26, 10, 4, 3, '#F0D040');
      break;
    case 'bat':
      px(ctx, 4, 14, 14, 8, v.color2!);
      px(ctx, 38, 14, 14, 8, v.color2!);
      break;
    case 'bat-big':
      px(ctx, 2, 10, 16, 12, v.color2!);
      px(ctx, 38, 10, 16, 12, v.color2!);
      break;
    case 'mushroom':
      px(ctx, 20, 12, 8, 6, v.color2!);
      px(ctx, 34, 14, 6, 5, v.color2!);
      break;
    case 'big-mushroom':
      px(ctx, 16, 8, 12, 8, v.color2!);
      px(ctx, 32, 10, 10, 7, v.color2!);
      break;
    case 'big-eyes':
      px(ctx, 18, 18, 6, 6, '#D04040');
      px(ctx, 32, 18, 6, 6, '#D04040');
      px(ctx, 20, 20, 2, 2, '#FFF');
      px(ctx, 34, 20, 2, 2, '#FFF');
      break;
    case 'moth':
      px(ctx, 4, 14, 14, 10, '#D0D0F0');
      px(ctx, 38, 14, 14, 10, '#D0D0F0');
      break;
    case 'flower-head':
      ellipse(ctx, 28, 10, 8, 6, v.color2!);
      break;
    case 'big-flower':
      ellipse(ctx, 28, 10, 12, 8, v.color2!);
      ellipse(ctx, 28, 10, 4, 3, '#F0D040');
      break;
    case 'fairy':
      // Ears
      px(ctx, 16, 8, 4, 4, v.color2!);
      px(ctx, 36, 8, 4, 4, v.color2!);
      // Wings
      px(ctx, 10, 24, 6, 8, '#F0D0E0');
      px(ctx, 40, 24, 6, 8, '#F0D0E0');
      break;
    case 'fairy-big':
      px(ctx, 14, 6, 5, 5, v.color2!);
      px(ctx, 37, 6, 5, 5, v.color2!);
      px(ctx, 8, 22, 8, 10, '#F0D0E0');
      px(ctx, 40, 22, 8, 10, '#F0D0E0');
      break;
    case 'tails':
      for (let i = 0; i < 6; i++) {
        px(ctx, 38 + i * 2, 30 - i * 2, 3, 6, v.color2!);
      }
      break;
    case 'nine-tails':
      for (let i = 0; i < 9; i++) {
        const tx = 36 + (i % 5) * 3;
        const ty = 10 + (i % 3) * 6;
        px(ctx, tx, ty, 3, 8, v.color2!);
      }
      break;
    case 'fire-mane':
      px(ctx, 18, 4, 20, 6, v.color2!);
      px(ctx, 16, 8, 6, 4, v.color2!);
      break;
    case 'mane':
      px(ctx, 16, 8, 24, 8, v.color2!);
      break;
    case 'armor':
      px(ctx, 16, 20, 24, 4, v.color2!);
      break;
    case 'horn-small':
      px(ctx, 26, 6, 4, 6, v.color1);
      break;
    case 'horn-big':
      px(ctx, 26, 2, 4, 10, v.color2!);
      break;
    case 'spikes':
      for (let i = 0; i < 4; i++) {
        px(ctx, 14 + i * 8, 8, 3, 4, v.color2!);
      }
      break;
    case 'spiky':
      for (let i = 0; i < 6; i++) {
        px(ctx, 10 + i * 6, 6 + (i % 2) * 2, 3, 5, v.color2!);
      }
      break;
    case 'magnet':
      px(ctx, 8, 22, 6, 8, '#808080');
      px(ctx, 42, 22, 6, 8, '#808080');
      px(ctx, 8, 22, 2, 8, '#D04040');
      px(ctx, 46, 22, 2, 8, '#3060C0');
      break;
    case 'triple':
      ellipse(ctx, 16, 36, 6, 6, v.color1);
      ellipse(ctx, 40, 36, 6, 6, v.color1);
      break;
    case 'leek':
      px(ctx, 10, 14, 2, 16, '#90C050');
      px(ctx, 8, 12, 6, 3, '#60A030');
      break;
    case 'two-heads':
      ellipse(ctx, 20, 10, 6, 6, v.color1);
      ellipse(ctx, 36, 10, 6, 6, v.color1);
      px(ctx, 16, 8, 2, 2, '#000');
      px(ctx, 32, 8, 2, 2, '#000');
      break;
    case 'three-heads':
      ellipse(ctx, 14, 8, 5, 5, v.color1);
      ellipse(ctx, 28, 6, 5, 5, v.color1);
      ellipse(ctx, 42, 8, 5, 5, v.color1);
      break;
    case 'tentacles':
      for (let i = 0; i < 4; i++) {
        px(ctx, 14 + i * 8, 36, 2, 12, v.color2!);
      }
      break;
    case 'tentacles-big':
      for (let i = 0; i < 6; i++) {
        px(ctx, 10 + i * 6, 34, 3, 14, v.color2!);
      }
      break;
    case 'gas':
      // Smoky outline
      ctx.globalAlpha = 0.5;
      ellipse(ctx, 28, 28, 20, 16, '#404060');
      ctx.globalAlpha = 1.0;
      break;
    case 'gas-cloud':
      ellipse(ctx, 20, 30, 8, 6, v.color2!);
      ellipse(ctx, 36, 28, 6, 5, v.color2!);
      // Skull mark
      px(ctx, 24, 20, 2, 2, '#000');
      px(ctx, 30, 20, 2, 2, '#000');
      break;
    case 'double-gas':
      ellipse(ctx, 16, 34, 10, 8, v.color1);
      ellipse(ctx, 40, 30, 8, 6, v.color1);
      break;
    case 'rocky':
      px(ctx, 18, 18, 4, 3, '#909080');
      px(ctx, 34, 22, 4, 3, '#909080');
      break;
    case 'crab':
      px(ctx, 6, 18, 8, 4, v.color2!);
      px(ctx, 42, 18, 8, 4, v.color2!);
      // Pincers
      px(ctx, 4, 14, 4, 4, v.color1);
      px(ctx, 48, 14, 4, 4, v.color1);
      break;
    case 'crab-big':
      px(ctx, 2, 14, 12, 6, v.color2!);
      px(ctx, 42, 14, 12, 6, v.color2!);
      px(ctx, 0, 10, 6, 6, v.color1);
      px(ctx, 50, 10, 6, 6, v.color1);
      break;
    case 'ball':
      ellipse(ctx, 28, 28, 14, 14, v.color1);
      px(ctx, 14, 27, 28, 2, '#000');
      ellipse(ctx, 28, 28, 14, 14, 'transparent');
      px(ctx, 14, 28, 28, 14, v.color2!);
      px(ctx, 26, 26, 4, 4, '#FFF');
      break;
    case 'ball-flip':
      ellipse(ctx, 28, 28, 14, 14, v.color1);
      px(ctx, 14, 27, 28, 2, '#000');
      px(ctx, 14, 28, 28, 14, v.color2!);
      px(ctx, 26, 26, 4, 4, '#FFF');
      break;
    case 'eggs':
      for (const pos of [[18, 24], [28, 20], [38, 26], [22, 34], [34, 34]]) {
        ellipse(ctx, pos[0]!, pos[1]!, 5, 5, '#F0D0B0');
        px(ctx, pos[0]! - 1, pos[1]! - 2, 2, 1, '#000');
      }
      break;
    case 'palm-tree':
      px(ctx, 24, 14, 8, 30, v.color1);
      for (let i = 0; i < 3; i++) {
        ellipse(ctx, 18 + i * 10, 6, 6, 5, v.color2!);
      }
      break;
    case 'skull':
      px(ctx, 22, 8, 12, 8, '#F0F0E0');
      px(ctx, 24, 10, 2, 2, '#000');
      px(ctx, 30, 10, 2, 2, '#000');
      break;
    case 'skull-club':
      px(ctx, 22, 8, 12, 8, '#F0F0E0');
      px(ctx, 24, 10, 2, 2, '#000');
      px(ctx, 30, 10, 2, 2, '#000');
      px(ctx, 8, 22, 4, 16, '#C09050');
      break;
    case 'long-legs':
      px(ctx, 18, 36, 4, 16, v.color1);
      px(ctx, 34, 36, 4, 16, v.color1);
      break;
    case 'boxing':
      px(ctx, 8, 20, 6, 6, '#C03030');
      px(ctx, 42, 20, 6, 6, '#C03030');
      break;
    case 'tongue':
      px(ctx, 24, 24, 8, 2, '#D04060');
      px(ctx, 18, 26, 6, 2, '#D04060');
      break;
    case 'drill-horn':
      px(ctx, 26, 0, 4, 10, '#A09090');
      px(ctx, 27, 0, 2, 4, '#D0D0D0');
      break;
    case 'egg-pouch':
      ellipse(ctx, 28, 34, 6, 4, '#F0F0F0');
      ellipse(ctx, 28, 34, 3, 2, '#F0D0B0');
      break;
    case 'vines':
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const vx = 28 + Math.cos(angle) * 18;
        const vy = 28 + Math.sin(angle) * 14;
        px(ctx, vx, vy, 2, 6, v.color2!);
      }
      break;
    case 'pouch':
      ellipse(ctx, 28, 38, 8, 5, v.color2!);
      ellipse(ctx, 28, 36, 4, 3, v.color1);
      break;
    case 'fins':
      px(ctx, 8, 20, 6, 4, v.color2!);
      px(ctx, 42, 20, 6, 4, v.color2!);
      break;
    case 'star':
      // 5 points
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const sx = 28 + Math.cos(angle) * 16;
        const sy = 26 + Math.sin(angle) * 16;
        px(ctx, sx - 2, sy - 2, 4, 4, v.color1);
      }
      // Center gem
      ellipse(ctx, 28, 26, 4, 4, v.color2!);
      break;
    case 'star-big':
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const sx = 28 + Math.cos(angle) * 18;
        const sy = 26 + Math.sin(angle) * 18;
        px(ctx, sx - 3, sy - 3, 6, 6, v.color1);
      }
      ellipse(ctx, 28, 26, 5, 5, v.color2!);
      break;
    case 'scythes':
      px(ctx, 4, 16, 10, 3, '#90C060');
      px(ctx, 2, 14, 4, 2, '#90C060');
      px(ctx, 42, 16, 10, 3, '#90C060');
      px(ctx, 50, 14, 4, 2, '#90C060');
      break;
    case 'pincers':
      px(ctx, 20, 2, 4, 6, '#806040');
      px(ctx, 32, 2, 4, 6, '#806040');
      px(ctx, 18, 2, 2, 3, '#806040');
      px(ctx, 36, 2, 2, 3, '#806040');
      break;
    case 'horns-bull':
      px(ctx, 14, 6, 4, 3, '#807060');
      px(ctx, 38, 6, 4, 3, '#807060');
      px(ctx, 12, 4, 2, 4, '#807060');
      px(ctx, 42, 4, 2, 4, '#807060');
      break;
    case 'fish-whiskers':
      px(ctx, 12, 26, 6, 1, '#F0D060');
      px(ctx, 12, 30, 6, 1, '#F0D060');
      break;
    case 'gyarados':
      // Large serpent head crest
      px(ctx, 22, 2, 12, 4, '#4070C0');
      px(ctx, 20, 4, 4, 6, '#4070C0');
      px(ctx, 36, 4, 4, 6, '#4070C0');
      // Fangs
      px(ctx, 24, 18, 2, 3, '#FFF');
      px(ctx, 30, 18, 2, 3, '#FFF');
      break;
    case 'shell-big':
      ellipse(ctx, 28, 28, 16, 10, v.color2!);
      // Horn on head
      px(ctx, 26, 6, 4, 6, '#A09090');
      break;
    case 'blob':
      // Simple smiley
      px(ctx, 22, 24, 2, 1, '#404040');
      px(ctx, 32, 24, 2, 1, '#404040');
      px(ctx, 24, 30, 8, 1, '#404040');
      break;
    case 'fluffy':
      // Fluffy collar
      ellipse(ctx, 28, 22, 12, 4, v.color2!);
      break;
    case 'angular':
      // Porygon angular body
      px(ctx, 20, 20, 16, 16, v.color1);
      px(ctx, 22, 22, 12, 12, v.color2!);
      px(ctx, 36, 28, 6, 4, v.color1);
      break;
    case 'spiky-shell':
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const sx = 28 + Math.cos(angle) * 18;
        const sy = 30 + Math.sin(angle) * 14;
        px(ctx, sx - 1, sy - 3, 2, 6, v.color2!);
      }
      break;
    case 'mustache':
      px(ctx, 14, 16, 6, 2, '#806030');
      px(ctx, 36, 16, 6, 2, '#806030');
      break;
    case 'four-arms':
      px(ctx, 6, 20, 6, 4, v.color1);
      px(ctx, 44, 20, 6, 4, v.color1);
      px(ctx, 8, 28, 6, 4, v.color1);
      px(ctx, 42, 28, 6, 4, v.color1);
      break;
    case 'plant':
      px(ctx, 24, 4, 8, 4, '#60A030');
      px(ctx, 22, 6, 4, 2, '#60A030');
      break;
    case 'pitcher':
      ellipse(ctx, 28, 10, 10, 8, '#60A030');
      px(ctx, 22, 4, 12, 4, '#D0A030');
      break;
    case 'pendulum':
      px(ctx, 8, 16, 4, 2, '#F0D040');
      px(ctx, 6, 18, 2, 10, '#808080');
      px(ctx, 4, 28, 6, 4, '#F0D040');
      break;
    case 'shell-tail':
      ellipse(ctx, 42, 40, 8, 6, '#A0A0B0');
      break;
    case 'cobra':
      px(ctx, 14, 8, 28, 8, v.color1);
      px(ctx, 16, 10, 24, 4, v.color2!);
      break;
    case 'pterodactyl':
      px(ctx, 4, 16, 16, 4, '#A090A0');
      px(ctx, 36, 16, 16, 4, '#A090A0');
      px(ctx, 2, 14, 8, 2, '#A090A0');
      px(ctx, 46, 14, 8, 2, '#A090A0');
      break;
    case 'legendary-bird':
      px(ctx, 2, 12, 16, 6, v.color2!);
      px(ctx, 38, 12, 16, 6, v.color2!);
      px(ctx, 0, 10, 8, 4, v.color2!);
      px(ctx, 48, 10, 8, 4, v.color2!);
      // Crest
      px(ctx, 24, 2, 8, 4, v.color2!);
      break;
    case 'dragon':
      // Wings
      px(ctx, 4, 14, 12, 8, v.color2!);
      px(ctx, 40, 14, 12, 8, v.color2!);
      // Antennae
      px(ctx, 22, 2, 2, 6, '#E0A040');
      px(ctx, 32, 2, 2, 6, '#E0A040');
      break;
    case 'mewtwo':
      // Long tail
      px(ctx, 36, 34, 3, 4, v.color2!);
      px(ctx, 39, 30, 3, 4, v.color2!);
      px(ctx, 42, 26, 3, 4, v.color2!);
      px(ctx, 45, 22, 4, 4, v.color2!);
      // Tube on neck
      px(ctx, 18, 16, 4, 2, '#808090');
      px(ctx, 34, 16, 4, 2, '#808090');
      break;
    case 'mew':
      // Long curving tail
      px(ctx, 36, 30, 2, 8, v.color2!);
      px(ctx, 38, 36, 2, 6, v.color2!);
      px(ctx, 40, 40, 4, 2, v.color2!);
      break;
    case 'flame-body':
      px(ctx, 16, 4, 24, 4, v.color2!);
      px(ctx, 14, 6, 6, 3, v.color2!);
      px(ctx, 36, 6, 6, 3, v.color2!);
      break;
    case 'hair':
      px(ctx, 14, 2, 28, 6, v.color2!);
      px(ctx, 12, 6, 6, 10, v.color2!);
      px(ctx, 38, 6, 6, 10, v.color2!);
      break;
    case 'fat':
      ellipse(ctx, 28, 28, 18, 18, v.color1);
      ellipse(ctx, 28, 34, 14, 10, v.color2!);
      break;
    case 'wings-small':
      px(ctx, 12, 18, 4, 6, '#F0F0F0');
      px(ctx, 40, 18, 4, 6, '#F0F0F0');
      break;
    case 'round':
      // Already mostly handled by amorphous body
      break;
    case 'round-big':
      break;
    case 'cat-big':
      px(ctx, 16, 6, 3, 4, v.color1);
      px(ctx, 37, 6, 3, 4, v.color1);
      // Gem on forehead
      px(ctx, 26, 12, 4, 3, '#D04040');
      break;
  }
}

// === Front Sprite Generator (56x56) ===
function generateFrontSprite(id: number): OffscreenCanvas {
  const v = POKEMON_VISUALS[id];
  if (!v) {
    // Fallback: question-mark silhouette
    const [c, ctx] = createCanvas(56, 56);
    ellipse(ctx, 28, 28, 16, 16, '#808080');
    px(ctx, 24, 20, 8, 4, '#FFF');
    px(ctx, 26, 24, 4, 4, '#FFF');
    px(ctx, 26, 30, 4, 4, '#FFF');
    return c;
  }
  const [c, ctx] = createCanvas(56, 56);
  drawFrontBody(ctx, v);
  drawFeatures(ctx, v, id);
  return c;
}

// === Back Sprite Generator (48x48) ===
function generateBackSprite(id: number): OffscreenCanvas {
  const v = POKEMON_VISUALS[id];
  if (!v) {
    const [c, ctx] = createCanvas(48, 48);
    ellipse(ctx, 24, 24, 14, 14, '#808080');
    return c;
  }
  const [c, ctx] = createCanvas(48, 48);

  // Simplified back view — mostly show the back of the body
  switch (v.body) {
    case 'quadruped':
      ellipse(ctx, 24, 24, 14, 10, v.color1);
      ellipse(ctx, 24, 14, 8, 6, v.color1);
      px(ctx, 12, 32, 4, 10, v.color2);
      px(ctx, 20, 32, 4, 10, v.color2);
      px(ctx, 28, 32, 4, 10, v.color2);
      px(ctx, 36, 32, 4, 10, v.color2);
      break;
    case 'biped-small':
      ellipse(ctx, 24, 24, 10, 12, v.color1);
      ellipse(ctx, 24, 12, 8, 6, v.color1);
      px(ctx, 10, 20, 4, 4, v.color1);
      px(ctx, 34, 20, 4, 4, v.color1);
      px(ctx, 18, 36, 5, 4, v.color2);
      px(ctx, 26, 36, 5, 4, v.color2);
      break;
    case 'biped-tall':
      ellipse(ctx, 24, 24, 8, 14, v.color1);
      ellipse(ctx, 24, 10, 7, 6, v.color1);
      px(ctx, 10, 18, 4, 4, v.color1);
      px(ctx, 34, 18, 4, 4, v.color1);
      px(ctx, 16, 38, 5, 6, v.color2);
      px(ctx, 26, 38, 5, 6, v.color2);
      break;
    case 'bird':
      ellipse(ctx, 24, 24, 10, 8, v.color1);
      ellipse(ctx, 24, 14, 6, 5, v.color1);
      px(ctx, 6, 18, 10, 6, v.color2);
      px(ctx, 32, 18, 10, 6, v.color2);
      px(ctx, 34, 28, 8, 4, v.color2);
      break;
    case 'fish':
      ellipse(ctx, 24, 22, 12, 10, v.color1);
      px(ctx, 36, 16, 6, 4, v.color2);
      px(ctx, 36, 22, 6, 4, v.color2);
      px(ctx, 20, 10, 8, 4, v.color2);
      break;
    case 'serpent':
      ellipse(ctx, 24, 30, 12, 8, v.color1);
      ellipse(ctx, 20, 22, 6, 5, v.color1);
      ellipse(ctx, 24, 14, 5, 5, v.color1);
      ellipse(ctx, 28, 8, 6, 5, v.color1);
      break;
    case 'amorphous':
      ellipse(ctx, 24, 24, 14, 12, v.color1);
      ellipse(ctx, 20, 18, 5, 3, v.color2);
      break;
    case 'insectoid':
      ellipse(ctx, 24, 28, 8, 6, v.color1);
      ellipse(ctx, 24, 20, 6, 5, v.color2);
      ellipse(ctx, 24, 12, 6, 5, v.color1);
      px(ctx, 12, 24, 5, 2, v.color2);
      px(ctx, 31, 24, 5, 2, v.color2);
      break;
    case 'shell':
      ellipse(ctx, 24, 24, 14, 12, v.color1);
      for (let i = 0; i < 4; i++) {
        px(ctx, 12 + i * 6, 14, 2, 18, v.color2);
      }
      break;
    case 'floating':
      ellipse(ctx, 24, 20, 10, 8, v.color1);
      break;
  }
  return c;
}

// === Mini Sprite Generator (16x16) ===
function generateMiniSprite(id: number): OffscreenCanvas {
  const v = POKEMON_VISUALS[id];
  if (!v) {
    const [c, ctx] = createCanvas(16, 16);
    ellipse(ctx, 8, 8, 5, 5, '#808080');
    return c;
  }
  const [c, ctx] = createCanvas(16, 16);

  // Tiny silhouette using primary color
  switch (v.body) {
    case 'quadruped':
      px(ctx, 4, 4, 8, 5, v.color1);
      px(ctx, 3, 2, 4, 3, v.color1);
      px(ctx, 4, 9, 2, 4, v.color1);
      px(ctx, 7, 9, 2, 4, v.color1);
      px(ctx, 10, 9, 2, 4, v.color1);
      break;
    case 'biped-small':
      px(ctx, 5, 2, 6, 5, v.color1);
      px(ctx, 4, 6, 8, 5, v.color1);
      px(ctx, 5, 11, 3, 3, v.color1);
      px(ctx, 9, 11, 3, 3, v.color1);
      break;
    case 'biped-tall':
      px(ctx, 5, 1, 6, 4, v.color1);
      px(ctx, 4, 4, 8, 6, v.color1);
      px(ctx, 5, 10, 3, 4, v.color1);
      px(ctx, 8, 10, 3, 4, v.color1);
      break;
    case 'bird':
      px(ctx, 5, 2, 6, 4, v.color1);
      px(ctx, 3, 5, 10, 4, v.color1);
      px(ctx, 1, 6, 3, 3, v.color2);
      px(ctx, 12, 6, 3, 3, v.color2);
      px(ctx, 6, 9, 2, 4, v.color1);
      break;
    case 'fish':
      px(ctx, 3, 4, 10, 6, v.color1);
      px(ctx, 12, 5, 3, 2, v.color2);
      px(ctx, 12, 8, 3, 2, v.color2);
      break;
    case 'serpent':
      px(ctx, 4, 6, 8, 5, v.color1);
      px(ctx, 3, 4, 4, 3, v.color1);
      px(ctx, 6, 2, 4, 3, v.color1);
      break;
    case 'amorphous':
      ellipse(ctx, 8, 8, 5, 5, v.color1);
      break;
    case 'insectoid':
      px(ctx, 5, 2, 6, 4, v.color1);
      px(ctx, 4, 6, 8, 6, v.color1);
      px(ctx, 2, 7, 3, 2, v.color2);
      px(ctx, 11, 7, 3, 2, v.color2);
      break;
    case 'shell':
      ellipse(ctx, 8, 8, 6, 5, v.color1);
      break;
    case 'floating':
      ellipse(ctx, 8, 7, 5, 4, v.color1);
      break;
  }

  // Eyes (tiny dots)
  px(ctx, 5, 4, 1, 1, '#000');
  px(ctx, 9, 4, 1, 1, '#000');

  return c;
}

// === Public API ===

export function getPokemonFrontSprite(speciesId: number): OffscreenCanvas {
  let s = pokemonFront.get(speciesId);
  if (!s) { s = generateFrontSprite(speciesId); pokemonFront.set(speciesId, s); }
  return s;
}

export function getPokemonBackSprite(speciesId: number): OffscreenCanvas {
  let s = pokemonBack.get(speciesId);
  if (!s) { s = generateBackSprite(speciesId); pokemonBack.set(speciesId, s); }
  return s;
}

export function getPokemonMiniSprite(speciesId: number): OffscreenCanvas {
  let s = pokemonMini.get(speciesId);
  if (!s) { s = generateMiniSprite(speciesId); pokemonMini.set(speciesId, s); }
  return s;
}
