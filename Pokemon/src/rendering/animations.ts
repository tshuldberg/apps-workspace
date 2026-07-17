// === Battle Animations ===

export interface Animation {
  /** Returns true when animation is complete */
  update(): boolean;
  /** Render the current animation frame */
  render(ctx: CanvasRenderingContext2D): void;
}

/** Slide a sprite horizontally (e.g., Pokemon entering battle) */
export function createSlideInAnimation(
  sprite: OffscreenCanvas,
  fromX: number,
  toX: number,
  y: number,
  duration: number,
): Animation {
  let elapsed = 0;
  return {
    update() {
      elapsed++;
      return elapsed >= duration;
    },
    render(ctx) {
      const t = Math.min(elapsed / duration, 1);
      const eased = t * t * (3 - 2 * t); // smoothstep
      const x = fromX + (toX - fromX) * eased;
      ctx.drawImage(sprite, Math.round(x), y);
    },
  };
}

/** Slide a sprite vertically (e.g., Pokemon fainting) */
export function createSlideOutAnimation(
  sprite: OffscreenCanvas,
  fromY: number,
  toY: number,
  x: number,
  duration: number,
): Animation {
  let elapsed = 0;
  return {
    update() {
      elapsed++;
      return elapsed >= duration;
    },
    render(ctx) {
      const t = Math.min(elapsed / duration, 1);
      const currentY = fromY + (toY - fromY) * t;
      // Clip to only show the part above the target Y for faint effect
      if (toY > fromY) {
        const visH = sprite.height - (currentY - fromY);
        if (visH > 0) {
          ctx.drawImage(sprite, 0, 0, sprite.width, visH, x, Math.round(currentY), sprite.width, visH);
        }
      } else {
        ctx.drawImage(sprite, x, Math.round(currentY));
      }
    },
  };
}

/** Flash a rectangular area (damage effect) */
export function createFlashAnimation(
  x: number,
  y: number,
  w: number,
  h: number,
  flashes: number,
): Animation {
  let elapsed = 0;
  const framesPerFlash = 4;
  const totalFrames = flashes * framesPerFlash * 2;
  return {
    update() {
      elapsed++;
      return elapsed >= totalFrames;
    },
    render(ctx) {
      const inFlash = Math.floor(elapsed / framesPerFlash) % 2 === 0;
      if (inFlash) {
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;
      }
    },
  };
}

/** Shake a target position (damage received) */
export function createShakeAnimation(
  target: { x: number; y: number },
  intensity: number,
  duration: number,
): Animation {
  let elapsed = 0;
  const origX = target.x;
  const origY = target.y;
  return {
    update() {
      elapsed++;
      if (elapsed >= duration) {
        target.x = origX;
        target.y = origY;
        return true;
      }
      const decay = 1 - elapsed / duration;
      target.x = origX + Math.round(Math.sin(elapsed * 1.2) * intensity * decay);
      target.y = origY + Math.round(Math.cos(elapsed * 0.9) * intensity * decay * 0.3);
      return false;
    },
    render() {},
  };
}

/** Animate HP bar draining (returns current HP value via callback) */
export function createHpDrainAnimation(
  from: number,
  to: number,
  _max: number,
  duration: number,
): Animation & { currentHp: number } {
  let elapsed = 0;
  const anim = {
    currentHp: from,
    update() {
      elapsed++;
      const t = Math.min(elapsed / duration, 1);
      anim.currentHp = Math.round(from + (to - from) * t);
      return elapsed >= duration;
    },
    render() {},
  };
  return anim;
}

/** Animate EXP bar filling */
export function createExpFillAnimation(
  from: number,
  to: number,
  duration: number,
): Animation & { currentExp: number } {
  let elapsed = 0;
  const anim = {
    currentExp: from,
    update() {
      elapsed++;
      const t = Math.min(elapsed / duration, 1);
      anim.currentExp = Math.round(from + (to - from) * t);
      return elapsed >= duration;
    },
    render() {},
  };
  return anim;
}

/** Screen fade in or out */
export function createFadeTransition(
  fadeIn: boolean,
  duration: number,
): Animation {
  let elapsed = 0;
  return {
    update() {
      elapsed++;
      return elapsed >= duration;
    },
    render(ctx) {
      const t = Math.min(elapsed / duration, 1);
      const alpha = fadeIn ? 1 - t : t;
      ctx.fillStyle = '#000000';
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, 0, 160, 144);
      ctx.globalAlpha = 1;
    },
  };
}

/** Pokeball throw arc animation */
export function createBallThrowAnimation(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): Animation & { ballX: number; ballY: number } {
  let elapsed = 0;
  const duration = 30;
  const anim = {
    ballX: startX,
    ballY: startY,
    update() {
      elapsed++;
      const t = Math.min(elapsed / duration, 1);
      anim.ballX = startX + (targetX - startX) * t;
      // Parabolic arc
      const arc = -4 * 30 * t * (t - 1);
      anim.ballY = startY + (targetY - startY) * t - arc;
      return elapsed >= duration;
    },
    render(ctx: CanvasRenderingContext2D) {
      // Draw pokeball
      const bx = Math.round(anim.ballX);
      const by = Math.round(anim.ballY);
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(bx - 3, by - 3, 6, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - 3, by, 6, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx - 3, by - 1, 6, 1);
      ctx.fillRect(bx - 1, by - 2, 2, 2);
    },
  };
  return anim;
}

/** Pokeball wobble animation */
export function createBallWobbleAnimation(
  x: number,
  y: number,
  wobbles: number,
): Animation {
  let elapsed = 0;
  const framesPerWobble = 20;
  const totalFrames = wobbles * framesPerWobble + 10; // + pause
  return {
    update() {
      elapsed++;
      return elapsed >= totalFrames;
    },
    render(ctx) {
      const wobblePhase = Math.sin((elapsed / framesPerWobble) * Math.PI * 2) * 2;
      const bx = Math.round(x + wobblePhase);
      // Draw pokeball
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(bx - 3, y - 3, 6, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx - 3, y, 6, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx - 3, y - 1, 6, 1);
      ctx.fillRect(bx - 1, y - 2, 2, 2);
    },
  };
}

/** Simple delay animation (wait for N frames) */
export function createDelayAnimation(frames: number): Animation {
  let elapsed = 0;
  return {
    update() {
      elapsed++;
      return elapsed >= frames;
    },
    render() {},
  };
}

/** Sequential animation — plays animations one after another */
export function createSequence(...animations: Animation[]): Animation {
  let current = 0;
  return {
    update() {
      if (current >= animations.length) return true;
      if (animations[current]!.update()) {
        current++;
      }
      return current >= animations.length;
    },
    render(ctx) {
      if (current < animations.length) {
        animations[current]!.render(ctx);
      }
    },
  };
}
