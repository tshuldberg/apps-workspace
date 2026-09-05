import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_ROOT = path.resolve(process.cwd(), 'src', 'ui');

describe('media-first shared cards', () => {
  it('keeps recipe media cards clickable and accessible only when a handler is supplied', () => {
    const source = readFileSync(path.join(UI_ROOT, 'RecipeCard.tsx'), 'utf8');

    expect(source).toContain('if (onPress == null) return Content;');
    expect(source).toContain('accessibilityRole="button"');
    expect(source).toContain('accessibilityLabel={`Open recipe ${title}`}');
    expect(source).toContain('aspectRatio: 4 / 5');
    expect(source).toContain('mediaLabel ?? \'Recipe media\'');
    expect(source).toContain('Video ready');
  });

  it('keeps pantry media cards stable without rendering dead press targets', () => {
    const source = readFileSync(path.join(UI_ROOT, 'PantryItemCard.tsx'), 'utf8');

    expect(source).toContain('const mediaUri = imageUri ?? receiptThumbnailUri ?? foodPhotoUri ?? null;');
    expect(source).toContain('if (onPress == null)');
    expect(source).toContain('return <View style={styles.card}>{content}</View>;');
    expect(source).toContain('accessibilityLabel={`Open pantry item ${name}`}');
    expect(source).toContain('accessibilityLabel={`Shop for ${name}`}');
    expect(source).toContain('aspectRatio: 1');
    expect(source).toContain("mediaLabel ?? emoji ?? 'Batch'");
  });
});
