import { describe, expect, it } from 'vitest';
import { qrMatrixToSvgPath } from '../qr-svg';
import { encodeQrMatrix } from '../qr';

describe('qrMatrixToSvgPath', () => {
  it('emits a 1x1 square per dark module, offset by the quiet zone', () => {
    const matrix = [
      [true, false],
      [false, true],
    ];
    const { path, dimension } = qrMatrixToSvgPath(matrix, 4);
    // size 2 + 2*4 quiet zone = 10
    expect(dimension).toBe(10);
    // module (0,0) -> x=4,y=4 ; module (1,1) -> x=5,y=5 ; false cells absent
    expect(path).toContain('M4 4h1v1h-1z');
    expect(path).toContain('M5 5h1v1h-1z');
    expect(path).not.toContain('M5 4');
    expect(path).not.toContain('M4 5');
  });

  it('returns an empty path for an all-light matrix', () => {
    const matrix = [
      [false, false],
      [false, false],
    ];
    expect(qrMatrixToSvgPath(matrix).path).toBe('');
  });

  it('defaults the quiet zone to 4 modules (spec minimum)', () => {
    const matrix = [[true]];
    const { dimension } = qrMatrixToSvgPath(matrix);
    expect(dimension).toBe(1 + 8);
  });

  it('round-trips a real QR matrix into a non-empty path sized to the symbol', () => {
    const { matrix, size } = encodeQrMatrix('meerkat-theme:v1:test');
    const { path, dimension } = qrMatrixToSvgPath(matrix);
    expect(dimension).toBe(size + 8);
    expect(path.length).toBeGreaterThan(0);
    // every command is a unit square move
    expect(path.startsWith('M')).toBe(true);
  });
});
