import type { Scene } from './scene.ts';
import type { SaveData, GameMap } from '../data/game-types.ts';
import { PALETTE, NATIVE_WIDTH, NATIVE_HEIGHT } from '../constants.ts';
import { isPressed } from '../input.ts';
import { MapEngine, COLLISION } from '../overworld/map-engine.ts';
import { Player } from '../overworld/player.ts';
import { NpcManager } from '../overworld/npc.ts';
import { EventSystem } from '../overworld/events.ts';
import type { InteractionResult } from '../overworld/events.ts';
import { DialogueBox } from '../overworld/dialogue.ts';
import { checkEncounter } from '../overworld/encounters.ts';
import { resolveConnectionLanding } from '../overworld/connections.ts';
import { MAP_REGISTRY } from '../data/maps/index.ts';
import { SceneManager } from './scene.ts';
import { BattleScene } from './battle.ts';
import { MenuScene } from './menu.ts';

/** Transition state between map loads */
type TransitionState =
  | { phase: 'none' }
  | { phase: 'fade-out'; timer: number; callback: () => void }
  | { phase: 'fade-in'; timer: number };

const TRANSITION_FRAMES = 16;

export class OverworldScene implements Scene {
  private mapEngine: MapEngine;
  private player: Player;
  private npcManager: NpcManager;
  private eventSystem: EventSystem;
  private dialogueBox: DialogueBox | null = null;
  private transition: TransitionState = { phase: 'none' };
  private saveData: SaveData;
  private trainerApproaching: boolean = false;
  private pendingBattle: { trainerId: string } | null = null;
  private darkCave = false;
  private lastCheckedStep = 0;

  constructor(saveData: SaveData) {
    this.saveData = saveData;
    this.mapEngine = new MapEngine();
    this.player = new Player(saveData.playerX, saveData.playerY, saveData.playerDirection);
    this.npcManager = new NpcManager();
    this.eventSystem = new EventSystem(saveData.eventFlags, saveData.badges, saveData.party);

    // Load initial map
    this.loadMapById(saveData.currentMap);
  }

  enter(): void {}
  exit(): void {}

  update(): void {
    // Handle transitions
    if (this.transition.phase === 'fade-out') {
      this.transition.timer++;
      if (this.transition.timer >= TRANSITION_FRAMES) {
        this.transition.callback();
        this.transition = { phase: 'fade-in', timer: 0 };
      }
      return;
    }

    if (this.transition.phase === 'fade-in') {
      this.transition.timer++;
      if (this.transition.timer >= TRANSITION_FRAMES) {
        this.transition = { phase: 'none' };
      }
      return;
    }

    // Handle dialogue
    if (this.dialogueBox) {
      const dismissed = this.dialogueBox.update();
      if (dismissed) {
        this.dialogueBox = null;

        // Check if there's a pending trainer battle after dialogue
        if (this.pendingBattle) {
          const { TRAINERS } = require('../data/trainers.ts') as { TRAINERS: Record<string, import('../data/game-types.ts').TrainerData> };
          const trainer = TRAINERS[this.pendingBattle.trainerId];
          if (trainer) {
            const { createPokemon } = require('../battle/stats.ts') as { createPokemon: (id: number, lv: number) => import('../data/game-types.ts').Pokemon };
            const enemyParty = trainer.pokemon.map(p => createPokemon(p.speciesId, p.level));
            SceneManager.push(new BattleScene(
              this.saveData.party,
              enemyParty,
              false,
              trainer,
            ));
          }
          this.pendingBattle = null;
        }
      }
      return;
    }

    // Handle trainer approach
    if (this.trainerApproaching) {
      this.npcManager.update();
      // Check if all trainers finished approaching (no more moving trainers)
      // For simplicity, check if the approach target is cleared
      this.trainerApproaching = false;
      return;
    }

    // Start menu
    if (isPressed('START')) {
      SceneManager.push(new MenuScene(this.saveData));
      return;
    }

    // Normal update: player movement
    this.player.update(this.mapEngine, this.npcManager);
    this.npcManager.update();
    this.mapEngine.update(this.player.x, this.player.y);

    // Check interactions on A press (only when player is not moving)
    if (!this.player.isMoving && isPressed('A')) {
      const result = this.eventSystem.interact(
        this.player.x,
        this.player.y,
        this.player.facing,
        this.mapEngine,
        this.npcManager,
      );
      if (result) {
        this.handleInteraction(result);
      }
    }

    // After completing a step, check for encounters and warps (once per step only)
    if (!this.player.isMoving && this.player.stepCount > this.lastCheckedStep) {
      this.lastCheckedStep = this.player.stepCount;
      this.checkPostStepEvents();
    }

    // Check trainer sight (only when player is not in dialogue/transition)
    if (!this.player.isMoving) {
      const spottedBy = this.npcManager.checkTrainerSight(this.player.x, this.player.y);
      if (spottedBy) {
        this.startTrainerEncounter(spottedBy);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render map
    this.mapEngine.render(ctx);

    // Render NPCs
    this.npcManager.render(ctx, this.mapEngine.camX, this.mapEngine.camY);

    // Render player
    this.player.render(ctx, this.mapEngine.camX, this.mapEngine.camY);

    // Render item balls on ground
    this.renderItemBalls(ctx);

    // Dark cave overlay
    if (this.darkCave && !this.eventSystem.getFlag('flash_active')) {
      this.renderDarkOverlay(ctx);
    }

    // Render dialogue box
    if (this.dialogueBox) {
      this.dialogueBox.render(ctx);
    }

    // Render transition overlay
    this.renderTransition(ctx);
  }

  private loadMapById(mapId: string): void {
    const map = MAP_REGISTRY[mapId];
    if (!map) {
      console.warn(`Map not found: ${mapId}`);
      return;
    }
    this.mapEngine.setMap(map);

    const currentMap = this.mapEngine.map;
    if (currentMap) {
      this.npcManager.loadNpcs(currentMap.npcs, this.mapEngine);
      this.npcManager.loadTrainers(
        currentMap.trainerPlacements,
        this.mapEngine,
        this.eventSystem.getFlags(),
      );
      this.saveData.currentMap = currentMap.id;

      // Check if this is a dark cave
      this.darkCave = currentMap.id.includes('cave') || currentMap.id.includes('tunnel');
    }

    this.mapEngine.update(this.player.x, this.player.y);
  }

  private handleInteraction(result: InteractionResult): void {
    switch (result.type) {
      case 'dialogue':
        this.dialogueBox = new DialogueBox(result.text);
        break;

      case 'sign':
        this.dialogueBox = new DialogueBox([result.text]);
        break;

      case 'item':
        this.eventSystem.setFlag(result.flag);
        this.saveData.bag.push({ itemId: result.itemId, quantity: result.quantity });
        this.dialogueBox = new DialogueBox([`Found ${result.quantity}x Item #${result.itemId}!`]);
        break;

      case 'heal':
        this.eventSystem.healParty();
        this.dialogueBox = new DialogueBox([
          'Your Pokemon have been',
          'fully restored!',
        ]);
        break;

      case 'pc':
        // TODO: Push PC scene
        this.dialogueBox = new DialogueBox(['Turned on the PC.']);
        break;

      case 'shop':
        // TODO: Push shop scene
        this.dialogueBox = new DialogueBox(['Welcome to our shop!']);
        break;

      case 'battle':
        this.pendingBattle = { trainerId: result.trainerId };
        this.dialogueBox = new DialogueBox(['Trainer wants to battle!']);
        break;
    }
  }

  private checkPostStepEvents(): void {
    const map = this.mapEngine.map;
    if (!map) return;

    // Check map connection (player walked off the edge)
    const px = this.player.x;
    const py = this.player.y;
    if (px < 0 || py < 0 || px >= map.width || py >= map.height) {
      const connection = this.mapEngine.getConnection(px, py);
      if (connection) {
        const targetMap = MAP_REGISTRY[connection.mapId];
        if (targetMap) {
          const landing = resolveConnectionLanding(connection, px, py, targetMap);
          if (landing) {
            this.doWarp(connection.mapId, landing.x, landing.y);
            return;
          }
        }
      }
      // No valid connection — snap player back inside the map
      this.player.x = Math.max(0, Math.min(px, map.width - 1));
      this.player.y = Math.max(0, Math.min(py, map.height - 1));
      this.player.pixelX = this.player.x * 16;
      this.player.pixelY = this.player.y * 16;
      return;
    }

    // Check warp (doors)
    const warp = this.mapEngine.getWarp(px, py);
    if (warp) {
      this.doWarp(warp.targetMap, warp.targetX, warp.targetY);
      return;
    }

    // Check wild encounter
    const collision = this.mapEngine.getCollision(px, py);
    const leadLevel = this.saveData.party[0]?.level ?? 0;
    const wildPokemon = checkEncounter(
      map,
      collision,
      this.player.stepCount,
      this.player.repelSteps,
      leadLevel,
    );

    if (wildPokemon) {
      SceneManager.push(new BattleScene(
        this.saveData.party,
        [wildPokemon],
        true,
      ));
    }
  }

  private doWarp(targetMap: string, targetX: number, targetY: number): void {
    this.transition = {
      phase: 'fade-out',
      timer: 0,
      callback: () => {
        this.player.x = targetX;
        this.player.y = targetY;
        this.player.pixelX = targetX * 16;
        this.player.pixelY = targetY * 16;
        this.loadMapById(targetMap);
      },
    };
  }

  private startTrainerEncounter(trainer: import('../overworld/npc.ts').TrainerInstance): void {
    // Show exclamation, then trainer walks towards player
    this.npcManager.startTrainerApproach(trainer, this.player.x, this.player.y);
    this.trainerApproaching = true;

    // After approach completes, trigger battle dialogue
    // For simplicity, show dialogue immediately (approach animation is bonus)
    this.pendingBattle = { trainerId: trainer.data.trainerId };
    this.dialogueBox = new DialogueBox(['Trainer spotted you!']);
    this.trainerApproaching = false;
  }

  private renderItemBalls(ctx: CanvasRenderingContext2D): void {
    const map = this.mapEngine.map;
    if (!map) return;

    for (const item of map.itemBalls) {
      if (this.eventSystem.getFlag(item.flag)) continue;

      const screenX = item.x * 16 - this.mapEngine.camX;
      const screenY = item.y * 16 - this.mapEngine.camY;

      if (screenX < -16 || screenX > 160 || screenY < -16 || screenY > 144) continue;

      // Draw Pokeball item ball
      ctx.fillStyle = '#D04040';
      ctx.fillRect(screenX + 4, screenY + 2, 8, 5);
      ctx.fillStyle = PALETTE.WHITE;
      ctx.fillRect(screenX + 4, screenY + 7, 8, 5);
      ctx.fillStyle = PALETTE.BLACK;
      ctx.fillRect(screenX + 4, screenY + 6, 8, 1);
      ctx.fillRect(screenX + 7, screenY + 5, 2, 3);
    }
  }

  private renderDarkOverlay(ctx: CanvasRenderingContext2D): void {
    // Dark cave effect: black overlay with a circle of visibility around player
    const playerScreenX = this.player.pixelX - this.mapEngine.camX + 8;
    const playerScreenY = this.player.pixelY - this.mapEngine.camY + 8;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';

    // Draw dark overlay in 4 rectangles around a visible circle
    // For simplicity, use full overlay with a small clear area
    const radius = 24;

    // Save and use clip to create the dark effect
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
    ctx.arc(playerScreenX, playerScreenY, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private renderTransition(ctx: CanvasRenderingContext2D): void {
    if (this.transition.phase === 'none') return;

    let alpha: number;
    if (this.transition.phase === 'fade-out') {
      alpha = this.transition.timer / TRANSITION_FRAMES;
    } else {
      alpha = 1 - this.transition.timer / TRANSITION_FRAMES;
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, Math.max(0, alpha))})`;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);
  }

  /** Sync player state back to save data */
  syncToSave(): void {
    this.saveData.playerX = this.player.x;
    this.saveData.playerY = this.player.y;
    this.saveData.playerDirection = this.player.facing;
    this.saveData.eventFlags = this.eventSystem.getFlags();
  }
}
