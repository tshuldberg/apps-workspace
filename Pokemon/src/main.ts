import { NATIVE_WIDTH, NATIVE_HEIGHT, SCALE, FRAME_TIME } from './constants.ts';
import { initInput, updateInput } from './input.ts';
import { SceneManager } from './scenes/scene.ts';
import { TitleScene } from './scenes/title.ts';
import { OverworldScene } from './scenes/overworld.ts';
import type { SaveData } from './data/game-types.ts';
import { createNewSave, loadGame } from './save.ts';

// === Canvas Setup ===
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

// Offscreen buffer at native Game Boy resolution
const buffer = document.createElement('canvas');
buffer.width = NATIVE_WIDTH;
buffer.height = NATIVE_HEIGHT;
const bufCtx = buffer.getContext('2d')!;
bufCtx.imageSmoothingEnabled = false;

// === Init ===
initInput();
SceneManager.push(new TitleScene());

// Listen for game start from title screen
window.addEventListener('pokemon-start', ((e: CustomEvent<SaveData>) => {
  SceneManager.push(new OverworldScene(e.detail));
}) as EventListener);

type DebugStartOptions = {
  map?: string;
  x?: number;
  y?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  playerName?: string;
  rivalName?: string;
};

function toInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function createDebugSave(options: DebugStartOptions = {}): SaveData {
  const save = createNewSave(
    options.playerName ?? 'RED',
    options.rivalName ?? 'BLUE',
  );

  if (typeof options.map === 'string' && options.map.length > 0) {
    save.currentMap = options.map;
  }
  if (typeof options.x === 'number') save.playerX = options.x;
  if (typeof options.y === 'number') save.playerY = options.y;
  if (options.direction) save.playerDirection = options.direction;
  return save;
}

function maybeStartFromDebugQuery(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('debugStart') !== '1') return;

  const save = createDebugSave({
    map: params.get('map') ?? undefined,
    x: toInt(params.get('x')),
    y: toInt(params.get('y')),
    direction: (params.get('direction') as DebugStartOptions['direction']) ?? undefined,
    playerName: params.get('playerName') ?? undefined,
    rivalName: params.get('rivalName') ?? undefined,
  });

  SceneManager.replace(new OverworldScene(save));
}

function renderGameToText(): string {
  const currentScene = SceneManager.current as any;
  const basePayload = {
    scene: currentScene?.constructor?.name ?? null,
    stackSize: SceneManager.size,
    coordinateSystem: 'tile coordinates: origin at top-left, +x right, +y down',
  };

  if (!currentScene) {
    return JSON.stringify({ ...basePayload, mode: 'none' });
  }

  if (currentScene.constructor?.name === 'OverworldScene') {
    const map = currentScene.mapEngine?.map ?? null;
    const player = currentScene.player;
    return JSON.stringify({
      ...basePayload,
      mode: 'overworld',
      mapId: map?.id ?? null,
      mapName: map?.name ?? null,
      mapSize: map ? { width: map.width, height: map.height } : null,
      player: player
        ? {
            tileX: player.x,
            tileY: player.y,
            pixelX: Math.round(player.pixelX),
            pixelY: Math.round(player.pixelY),
            facing: player.facing,
            isMoving: player.isMoving,
            isSurfing: player.isSurfing,
            stepCount: player.stepCount,
            tileCollision: map ? currentScene.mapEngine.getCollision(player.x, player.y) : null,
          }
        : null,
      transition: currentScene.transition?.phase ?? 'none',
      dialogueOpen: !!currentScene.dialogueBox,
      trainerApproaching: !!currentScene.trainerApproaching,
    });
  }

  if (currentScene.constructor?.name === 'TitleScene') {
    return JSON.stringify({
      ...basePayload,
      mode: 'title',
      phase: currentScene.phase ?? null,
      menuIndex: currentScene.menuIndex ?? null,
    });
  }

  return JSON.stringify({ ...basePayload, mode: 'other' });
}

maybeStartFromDebugQuery();

// === Game Loop ===
let lastTime = 0;
let accumulator = 0;

function runFixedUpdates(deltaMs: number): void {
  accumulator += deltaMs;
  while (accumulator >= FRAME_TIME) {
    updateInput();
    SceneManager.update();
    accumulator -= FRAME_TIME;
  }
}

function renderFrame(): void {
  // Render to buffer at native resolution, then scale up
  bufCtx.fillStyle = '#081820';
  bufCtx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
  SceneManager.render(bufCtx);

  // Scale buffer to display canvas
  ctx.drawImage(buffer, 0, 0, NATIVE_WIDTH, NATIVE_HEIGHT,
    0, 0, NATIVE_WIDTH * SCALE, NATIVE_HEIGHT * SCALE);
}

function gameLoop(timestamp: number): void {
  const delta = lastTime === 0 ? FRAME_TIME : timestamp - lastTime;
  lastTime = timestamp;
  runFixedUpdates(delta);
  renderFrame();

  requestAnimationFrame(gameLoop);
}

const debugGlobal = window as any;
debugGlobal.render_game_to_text = renderGameToText;
debugGlobal.advanceTime = (ms: number) => {
  runFixedUpdates(ms);
  renderFrame();
};
debugGlobal.__pokemon_debug_start = (options: DebugStartOptions = {}) => {
  const save = createDebugSave(options);
  SceneManager.replace(new OverworldScene(save));
  renderFrame();
  return renderGameToText();
};
debugGlobal.__pokemon_debug_continue = () => {
  const save = loadGame();
  if (!save) return null;
  SceneManager.replace(new OverworldScene(save));
  renderFrame();
  return renderGameToText();
};

requestAnimationFrame(gameLoop);
