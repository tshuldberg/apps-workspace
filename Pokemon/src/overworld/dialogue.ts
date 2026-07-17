import { NATIVE_WIDTH, NATIVE_HEIGHT, PALETTE } from '../constants.ts';
import { isPressed } from '../input.ts';

const BOX_HEIGHT = 36;
const BOX_Y = NATIVE_HEIGHT - BOX_HEIGHT;
const BOX_PADDING = 6;
const BORDER_WIDTH = 2;
const CHARS_PER_LINE = 18;
const LINES_PER_PAGE = 2;
const TYPE_SPEED = 2; // frames per character

export class DialogueBox {
  private pages: string[][];
  private currentPage = 0;
  private charIndex = 0;
  private timer = 0;
  private done = false;
  private pageComplete = false;
  private arrowBlink = 0;

  constructor(text: string[]) {
    // Split each text entry into pages of LINES_PER_PAGE lines
    this.pages = [];
    for (const line of text) {
      const wrapped = this.wordWrap(line, CHARS_PER_LINE);
      for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) {
        this.pages.push(wrapped.slice(i, i + LINES_PER_PAGE));
      }
    }
    if (this.pages.length === 0) {
      this.pages = [['']];
    }
  }

  get isDone(): boolean {
    return this.done;
  }

  /** Update the dialogue box. Returns true when fully dismissed. */
  update(): boolean {
    if (this.done) return true;

    this.arrowBlink++;

    if (!this.pageComplete) {
      // Typewriter effect
      this.timer++;
      if (this.timer >= TYPE_SPEED) {
        this.timer = 0;
        this.charIndex++;

        // Check if page is fully revealed
        const page = this.pages[this.currentPage];
        if (page) {
          const totalChars = page.reduce((sum, line) => sum + line.length, 0);
          if (this.charIndex >= totalChars) {
            this.pageComplete = true;
          }
        }
      }

      // A press: instant-reveal rest of page
      if (isPressed('A')) {
        const page = this.pages[this.currentPage];
        if (page) {
          this.charIndex = page.reduce((sum, line) => sum + line.length, 0);
          this.pageComplete = true;
        }
      }
    } else if (isPressed('A') || isPressed('B')) {
      // Advance to next page or dismiss
      this.currentPage++;
      if (this.currentPage >= this.pages.length) {
        this.done = true;
        return true;
      }
      this.charIndex = 0;
      this.pageComplete = false;
      this.timer = 0;
    }

    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.done) return;

    // Draw box background
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(0, BOX_Y, NATIVE_WIDTH, BOX_HEIGHT);

    // Draw border
    ctx.fillStyle = PALETTE.BLACK;
    // Top
    ctx.fillRect(0, BOX_Y, NATIVE_WIDTH, BORDER_WIDTH);
    // Bottom
    ctx.fillRect(0, NATIVE_HEIGHT - BORDER_WIDTH, NATIVE_WIDTH, BORDER_WIDTH);
    // Left
    ctx.fillRect(0, BOX_Y, BORDER_WIDTH, BOX_HEIGHT);
    // Right
    ctx.fillRect(NATIVE_WIDTH - BORDER_WIDTH, BOX_Y, BORDER_WIDTH, BOX_HEIGHT);

    // Draw text with typewriter effect
    const page = this.pages[this.currentPage];
    if (!page) return;

    ctx.fillStyle = PALETTE.BLACK;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';

    let charsRemaining = this.charIndex;
    for (let i = 0; i < page.length; i++) {
      const line = page[i];
      if (!line) continue;
      const displayLength = Math.min(charsRemaining, line.length);
      const displayText = line.substring(0, displayLength);
      charsRemaining -= displayLength;

      const textX = BOX_PADDING;
      const textY = BOX_Y + BOX_PADDING + i * 12;
      ctx.fillText(displayText, textX, textY);
    }

    // Show down arrow when page is complete and there's more to show
    if (this.pageComplete && this.currentPage < this.pages.length - 1) {
      if (Math.floor(this.arrowBlink / 15) % 2 === 0) {
        const arrowX = NATIVE_WIDTH - BOX_PADDING - 6;
        const arrowY = NATIVE_HEIGHT - BOX_PADDING - 4;
        ctx.fillStyle = PALETTE.BLACK;
        ctx.fillRect(arrowX, arrowY, 5, 2);
        ctx.fillRect(arrowX + 1, arrowY + 2, 3, 1);
        ctx.fillRect(arrowX + 2, arrowY + 3, 1, 1);
      }
    }

    ctx.textBaseline = 'alphabetic';
  }

  private wordWrap(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxChars) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines.length > 0 ? lines : [''];
  }
}
