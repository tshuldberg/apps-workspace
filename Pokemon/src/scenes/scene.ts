/** Base interface for all game scenes */
export interface Scene {
  /** Called when scene becomes active (pushed onto stack) */
  enter(): void;
  /** Called when scene is removed from stack */
  exit(): void;
  /** Called every frame for game logic */
  update(): void;
  /** Called every frame for rendering */
  render(ctx: CanvasRenderingContext2D): void;
}

/** Scene manager using a stack. Top scene gets update/render calls. */
class SceneManagerImpl {
  private stack: Scene[] = [];

  get current(): Scene | null {
    return this.stack[this.stack.length - 1] ?? null;
  }

  get size(): number {
    return this.stack.length;
  }

  push(scene: Scene): void {
    scene.enter();
    this.stack.push(scene);
  }

  pop(): Scene | null {
    const scene = this.stack.pop() ?? null;
    scene?.exit();
    return scene;
  }

  replace(scene: Scene): void {
    this.pop();
    this.push(scene);
  }

  update(): void {
    this.current?.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Render all scenes bottom-up (for overlay support)
    for (const scene of this.stack) {
      scene.render(ctx);
    }
  }
}

export const SceneManager = new SceneManagerImpl();
