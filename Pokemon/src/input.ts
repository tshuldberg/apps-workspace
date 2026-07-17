import { KEYS } from './constants.ts';

export type Button = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'A' | 'B' | 'START' | 'SELECT';

const keyToButton: Record<string, Button> = {
  [KEYS.UP]: 'UP',
  [KEYS.DOWN]: 'DOWN',
  [KEYS.LEFT]: 'LEFT',
  [KEYS.RIGHT]: 'RIGHT',
  [KEYS.A]: 'A',
  [KEYS.B]: 'B',
  [KEYS.START]: 'START',
  [KEYS.SELECT]: 'SELECT',
};

const held = new Set<Button>();
const justPressed = new Set<Button>();
const justReleased = new Set<Button>();
const pendingDown = new Set<Button>();
const pendingUp = new Set<Button>();

export function initInput(): void {
  window.addEventListener('keydown', (e) => {
    const btn = keyToButton[e.key];
    if (btn) {
      e.preventDefault();
      if (!held.has(btn)) {
        pendingDown.add(btn);
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const btn = keyToButton[e.key];
    if (btn) {
      e.preventDefault();
      pendingUp.add(btn);
    }
  });
}

/** Call once per frame at the start of update() */
export function updateInput(): void {
  justPressed.clear();
  justReleased.clear();

  for (const btn of pendingDown) {
    held.add(btn);
    justPressed.add(btn);
  }
  pendingDown.clear();

  for (const btn of pendingUp) {
    held.delete(btn);
    justReleased.add(btn);
  }
  pendingUp.clear();
}

export function isDown(btn: Button): boolean {
  return held.has(btn);
}

export function isPressed(btn: Button): boolean {
  return justPressed.has(btn);
}

export function isReleased(btn: Button): boolean {
  return justReleased.has(btn);
}
