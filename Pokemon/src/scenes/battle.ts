// === Battle Scene ===

import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';
import { drawText, drawTextCentered, wordWrap } from '../rendering/text.ts';
import { drawWindow, drawHpBar, drawExpBar } from '../rendering/menu-ui.ts';
import { getPokemonFrontSprite, getPokemonBackSprite } from '../rendering/sprites.ts';
import { playSfx, playMusic, stopMusic } from '../audio.ts';
import {
  createSlideInAnimation, createFlashAnimation, createFadeTransition,
  createHpDrainAnimation, createSlideOutAnimation,
  createBallThrowAnimation, createBallWobbleAnimation,
  createSequence, createDelayAnimation,
  type Animation,
} from '../rendering/animations.ts';
import { SceneManager } from './scene.ts';
import type { Scene } from './scene.ts';
import type { Pokemon, PokemonMove, TrainerData } from '../data/game-types.ts';

type BattlePhase =
  | 'intro' | 'action-select' | 'move-select'
  | 'executing' | 'text' | 'faint'
  | 'switch-prompt' | 'catch' | 'victory' | 'defeat' | 'run' | 'exp-gain';

interface BattleState {
  playerPokemon: Pokemon;
  enemyPokemon: Pokemon;
  isWild: boolean;
  trainer?: TrainerData;
  playerParty: Pokemon[];
  enemyParty: Pokemon[];
  currentEnemyIndex: number;
  turnMessages: string[];
  messageIndex: number;
}

export class BattleScene implements Scene {
  private phase: BattlePhase = 'intro';
  private state: BattleState;
  private frame = 0;

  // Menu state
  private actionIndex = 0;
  private moveIndex = 0;

  // Display positions
  private enemySpriteX = 120;
  private enemySpriteY = 8;
  private playerSpriteX = 16;
  private playerSpriteY = 48;

  // Animation
  private currentAnim: Animation | null = null;
  private enemyShake = { x: 0, y: 0 };
  private playerShake = { x: 0, y: 0 };
  private displayEnemyHp: number;
  private displayPlayerHp: number;

  // Text display
  private textLines: string[] = [];
  private textCallback: (() => void) | null = null;

  constructor(
    playerParty: Pokemon[],
    enemyParty: Pokemon[],
    isWild: boolean,
    trainer?: TrainerData,
  ) {
    const playerPokemon = playerParty.find(p => p.hp > 0)!;
    this.state = {
      playerPokemon,
      enemyPokemon: enemyParty[0]!,
      isWild,
      trainer,
      playerParty,
      enemyParty,
      currentEnemyIndex: 0,
      turnMessages: [],
      messageIndex: 0,
    };
    this.displayEnemyHp = this.state.enemyPokemon.hp;
    this.displayPlayerHp = this.state.playerPokemon.hp;
  }

  enter(): void {
    this.phase = 'intro';
    if (this.state.isWild) {
      playMusic('battle-wild');
    } else {
      playMusic('battle-trainer');
    }
    // Start with slide-in animation
    this.currentAnim = createSequence(
      createFadeTransition(true, 15),
      createDelayAnimation(30),
    );
    this.showText(
      this.state.isWild
        ? `Wild ${this.state.enemyPokemon.nickname} appeared!`
        : `${this.state.trainer?.className ?? 'Trainer'} wants to battle!`,
      () => {
        this.showText(`Go! ${this.state.playerPokemon.nickname}!`, () => {
          this.phase = 'action-select';
        });
      },
    );
  }

  exit(): void {
    stopMusic();
  }

  private showText(msg: string, callback?: () => void): void {
    this.textLines = wordWrap(msg, 144);
    this.textCallback = callback ?? null;
    this.phase = 'text';
  }

  update(): void {
    this.frame++;

    // Update animation
    if (this.currentAnim) {
      if (this.currentAnim.update()) {
        this.currentAnim = null;
      }
    }

    switch (this.phase) {
      case 'text':
        if (isPressed('A') || isPressed('B')) {
          playSfx('text-advance');
          if (this.textCallback) {
            const cb = this.textCallback;
            this.textCallback = null;
            cb();
          }
        }
        break;

      case 'action-select':
        this.updateActionSelect();
        break;

      case 'move-select':
        this.updateMoveSelect();
        break;

      case 'executing':
        // Wait for animation to complete
        if (!this.currentAnim) {
          this.processNextMessage();
        }
        break;

      case 'victory':
        if (isPressed('A')) {
          SceneManager.pop();
        }
        break;

      case 'defeat':
        if (isPressed('A')) {
          SceneManager.pop();
        }
        break;

      case 'faint':
        if (isPressed('A')) {
          this.handleFaint();
        }
        break;

      case 'exp-gain':
        if (isPressed('A')) {
          this.phase = 'action-select';
        }
        break;
    }
  }

  private updateActionSelect(): void {
    if (isPressed('UP') && this.actionIndex >= 2) {
      this.actionIndex -= 2;
      playSfx('menu-select');
    }
    if (isPressed('DOWN') && this.actionIndex < 2) {
      this.actionIndex += 2;
      playSfx('menu-select');
    }
    if (isPressed('LEFT') && this.actionIndex % 2 === 1) {
      this.actionIndex--;
      playSfx('menu-select');
    }
    if (isPressed('RIGHT') && this.actionIndex % 2 === 0) {
      this.actionIndex++;
      playSfx('menu-select');
    }

    if (isPressed('A')) {
      playSfx('menu-select');
      switch (this.actionIndex) {
        case 0: // FIGHT
          this.phase = 'move-select';
          this.moveIndex = 0;
          break;
        case 1: // BAG
          this.showText('No items in bag!', () => { this.phase = 'action-select'; });
          break;
        case 2: // POKEMON
          this.showText('No switch target!', () => { this.phase = 'action-select'; });
          break;
        case 3: // RUN
          if (this.state.isWild) {
            this.showText('Got away safely!', () => {
              SceneManager.pop();
            });
          } else {
            this.showText("Can't run from a trainer battle!", () => { this.phase = 'action-select'; });
          }
          break;
      }
    }
  }

  private updateMoveSelect(): void {
    const moves = this.state.playerPokemon.moves;

    if (isPressed('UP') && this.moveIndex >= 2) {
      this.moveIndex -= 2;
      playSfx('menu-select');
    }
    if (isPressed('DOWN') && this.moveIndex + 2 < moves.length) {
      this.moveIndex += 2;
      playSfx('menu-select');
    }
    if (isPressed('LEFT') && this.moveIndex % 2 === 1) {
      this.moveIndex--;
      playSfx('menu-select');
    }
    if (isPressed('RIGHT') && this.moveIndex % 2 === 0 && this.moveIndex + 1 < moves.length) {
      this.moveIndex++;
      playSfx('menu-select');
    }

    if (isPressed('B')) {
      playSfx('menu-back');
      this.phase = 'action-select';
    }

    if (isPressed('A')) {
      const move = moves[this.moveIndex];
      if (move && move.pp > 0) {
        this.executeMove(move);
      } else {
        this.showText('No PP left!', () => { this.phase = 'move-select'; });
      }
    }
  }

  private executeMove(move: PokemonMove): void {
    this.phase = 'executing';
    move.pp--;

    // Simple damage calculation (the real engine handles this)
    const damage = Math.max(1, Math.floor(
      ((2 * this.state.playerPokemon.level / 5 + 2) * 40 * this.state.playerPokemon.attack / this.state.enemyPokemon.defense / 50) + 2
    ));

    const enemyDamage = Math.max(1, Math.floor(
      ((2 * this.state.enemyPokemon.level / 5 + 2) * 40 * this.state.enemyPokemon.attack / this.state.playerPokemon.defense / 50) + 2
    ));

    // Player attacks
    this.state.turnMessages = [];
    this.state.turnMessages.push(`${this.state.playerPokemon.nickname} used a move!`);
    this.state.messageIndex = 0;

    // Apply damage to enemy
    const oldEnemyHp = this.state.enemyPokemon.hp;
    this.state.enemyPokemon.hp = Math.max(0, this.state.enemyPokemon.hp - damage);

    // Flash animation for damage
    this.currentAnim = createSequence(
      createFlashAnimation(this.enemySpriteX, this.enemySpriteY, 56, 56, 3),
      createHpDrainAnimation(oldEnemyHp, this.state.enemyPokemon.hp, this.state.enemyPokemon.maxHp, 30),
    );

    playSfx('damage-hit');

    // After player attack resolves
    this.textCallback = () => {
      if (this.state.enemyPokemon.hp <= 0) {
        this.handleEnemyFaint();
        return;
      }

      // Enemy attacks
      const oldPlayerHp = this.state.playerPokemon.hp;
      this.state.playerPokemon.hp = Math.max(0, this.state.playerPokemon.hp - enemyDamage);

      this.showText(`Enemy ${this.state.enemyPokemon.nickname} attacks!`, () => {
        this.currentAnim = createFlashAnimation(this.playerSpriteX, this.playerSpriteY, 48, 48, 3);
        this.displayPlayerHp = this.state.playerPokemon.hp;
        playSfx('damage-hit');

        if (this.state.playerPokemon.hp <= 0) {
          this.showText(`${this.state.playerPokemon.nickname} fainted!`, () => {
            playSfx('faint');
            this.phase = 'faint';
          });
        } else {
          this.showText('', () => { this.phase = 'action-select'; });
          this.phase = 'action-select';
        }
      });
    };

    this.phase = 'text';
    this.textLines = wordWrap(this.state.turnMessages[0]!, 144);
  }

  private handleEnemyFaint(): void {
    playSfx('faint');
    this.currentAnim = createSlideOutAnimation(
      getPokemonFrontSprite(this.state.enemyPokemon.speciesId),
      this.enemySpriteY, this.enemySpriteY + 56,
      this.enemySpriteX, 20,
    );

    this.showText(`Enemy ${this.state.enemyPokemon.nickname} fainted!`, () => {
      // Check for more enemy Pokemon
      const nextEnemy = this.state.enemyParty.find((p, i) =>
        i > this.state.currentEnemyIndex && p.hp > 0
      );
      if (nextEnemy) {
        this.state.currentEnemyIndex = this.state.enemyParty.indexOf(nextEnemy);
        this.state.enemyPokemon = nextEnemy;
        this.displayEnemyHp = nextEnemy.hp;
        this.showText(`${this.state.trainer?.className ?? 'Trainer'} sent out ${nextEnemy.nickname}!`, () => {
          this.phase = 'action-select';
        });
      } else {
        this.phase = 'victory';
        stopMusic();
        playSfx('level-up');
      }
    });
  }

  private handleFaint(): void {
    const nextAlive = this.state.playerParty.find(p => p.hp > 0);
    if (nextAlive) {
      this.state.playerPokemon = nextAlive;
      this.displayPlayerHp = nextAlive.hp;
      this.showText(`Go! ${nextAlive.nickname}!`, () => {
        this.phase = 'action-select';
      });
    } else {
      this.phase = 'defeat';
      stopMusic();
      this.showText('You blacked out!', () => { this.phase = 'defeat'; });
    }
  }

  private processNextMessage(): void {
    this.state.messageIndex++;
    if (this.state.messageIndex < this.state.turnMessages.length) {
      this.textLines = wordWrap(this.state.turnMessages[this.state.messageIndex]!, 144);
    } else if (this.textCallback) {
      const cb = this.textCallback;
      this.textCallback = null;
      cb();
    } else {
      this.phase = 'action-select';
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, 0, NATIVE_WIDTH, NATIVE_HEIGHT);

    // Battle field line
    ctx.fillStyle = PALETTE.LIGHT;
    ctx.fillRect(0, 64, NATIVE_WIDTH, 2);

    // Enemy Pokemon
    this.renderEnemyPokemon(ctx);
    // Player Pokemon
    this.renderPlayerPokemon(ctx);
    // Enemy info panel
    this.renderEnemyInfo(ctx);
    // Player info panel
    this.renderPlayerInfo(ctx);

    // Animation overlay
    if (this.currentAnim) {
      this.currentAnim.render(ctx);
    }

    // Bottom panel
    this.renderBottomPanel(ctx);
  }

  private renderEnemyPokemon(ctx: CanvasRenderingContext2D): void {
    const sprite = getPokemonFrontSprite(this.state.enemyPokemon.speciesId);
    if (this.state.enemyPokemon.hp > 0) {
      ctx.drawImage(sprite,
        this.enemySpriteX + this.enemyShake.x,
        this.enemySpriteY + this.enemyShake.y,
      );
    }
  }

  private renderPlayerPokemon(ctx: CanvasRenderingContext2D): void {
    const sprite = getPokemonBackSprite(this.state.playerPokemon.speciesId);
    if (this.state.playerPokemon.hp > 0) {
      ctx.drawImage(sprite,
        this.playerSpriteX + this.playerShake.x,
        this.playerSpriteY + this.playerShake.y,
      );
    }
  }

  private renderEnemyInfo(ctx: CanvasRenderingContext2D): void {
    // Enemy info (top left)
    drawWindow(ctx, 0, 0, 84, 28);
    drawText(ctx, this.state.enemyPokemon.nickname, 4, 4, PALETTE.BLACK);
    drawText(ctx, 'Lv' + this.state.enemyPokemon.level, 56, 4, PALETTE.BLACK);
    drawHpBar(ctx, this.state.enemyPokemon.hp, this.state.enemyPokemon.maxHp, 24, 18, 52);
  }

  private renderPlayerInfo(ctx: CanvasRenderingContext2D): void {
    // Player info (bottom right)
    drawWindow(ctx, 76, 68, 84, 36);
    drawText(ctx, this.state.playerPokemon.nickname, 80, 72, PALETTE.BLACK);
    drawText(ctx, 'Lv' + this.state.playerPokemon.level, 132, 72, PALETTE.BLACK);
    drawHpBar(ctx, this.state.playerPokemon.hp, this.state.playerPokemon.maxHp, 100, 84, 52);

    // HP numbers
    const hpStr = `${this.state.playerPokemon.hp}/${this.state.playerPokemon.maxHp}`;
    drawText(ctx, hpStr, 104, 90, PALETTE.BLACK);

    // EXP bar
    drawExpBar(ctx, 0, 100, 80, 100, 76);
  }

  private renderBottomPanel(ctx: CanvasRenderingContext2D): void {
    const boxY = 104;
    drawWindow(ctx, 0, boxY, NATIVE_WIDTH, 40);

    switch (this.phase) {
      case 'action-select': {
        drawText(ctx, 'What will', 8, boxY + 6);
        drawText(ctx, this.state.playerPokemon.nickname + ' do?', 8, boxY + 18);
        // Action buttons (right side)
        drawWindow(ctx, 80, boxY, 80, 40);
        const actions = ['FIGHT', 'BAG', 'PKMN', 'RUN'];
        for (let i = 0; i < 4; i++) {
          const ax = 92 + (i % 2) * 36;
          const ay = boxY + 6 + Math.floor(i / 2) * 16;
          if (i === this.actionIndex) {
            drawText(ctx, '\u25B6', ax - 8, ay, PALETTE.BLACK);
          }
          drawText(ctx, actions[i]!, ax, ay, PALETTE.BLACK);
        }
        break;
      }

      case 'move-select': {
        const moves = this.state.playerPokemon.moves;
        for (let i = 0; i < moves.length; i++) {
          const mx = 8 + (i % 2) * 72;
          const my = boxY + 6 + Math.floor(i / 2) * 16;
          if (i === this.moveIndex) {
            drawText(ctx, '\u25B6', mx - 8, my, PALETTE.BLACK);
          }
          const move = moves[i]!;
          drawText(ctx, `M${move.moveId}`, mx, my, PALETTE.BLACK);
          drawText(ctx, `${move.pp}/${move.maxPp}`, mx + 40, my, PALETTE.DARK);
        }
        break;
      }

      case 'text':
      case 'intro':
      case 'faint':
      case 'exp-gain':
        for (let i = 0; i < this.textLines.length && i < 2; i++) {
          drawText(ctx, this.textLines[i]!, 8, boxY + 8 + i * 14);
        }
        // Continue arrow
        if (this.frame % 40 < 20) {
          drawText(ctx, '\u25B6', NATIVE_WIDTH - 14, boxY + 30, PALETTE.DARK);
        }
        break;

      case 'victory':
        drawTextCentered(ctx, 'You won!', boxY + 12, PALETTE.BLACK);
        break;

      case 'defeat':
        drawTextCentered(ctx, 'You blacked out!', boxY + 12, PALETTE.BLACK);
        break;
    }
  }
}
