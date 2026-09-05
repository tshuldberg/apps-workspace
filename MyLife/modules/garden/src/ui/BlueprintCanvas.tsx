import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GARDEN_ACCENT_DIM, GARDEN_SURFACES } from './tokens';

interface BlueprintCanvasProps {
  width: number;
  height: number;
  children: ReactNode;
  dotSpacing?: number;
  dotSize?: number;
  onPan?: (dx: number, dy: number) => void;
  onZoom?: (scale: number) => void;
}

/**
 * BlueprintCanvas provides a dot-grid background and a positioned container
 * for children (which should use absolute positioning).
 *
 * Pan/zoom gestures: this primitive does not wire its own gesture handlers
 * because react-native-gesture-handler is not yet a dependency. Consumers
 * that need interactive pan/pinch should wrap this component in their own
 * gesture detector and drive the onPan/onZoom callbacks.
 */
export function BlueprintCanvas({
  width,
  height,
  children,
  dotSpacing = 24,
  dotSize = 2,
}: BlueprintCanvasProps) {
  const dots = useMemo(() => {
    const result: Array<{ key: string; left: number; top: number }> = [];
    const cols = Math.floor(width / dotSpacing);
    const rows = Math.floor(height / dotSpacing);
    for (let r = 0; r <= rows; r += 1) {
      for (let c = 0; c <= cols; c += 1) {
        result.push({
          key: `${r}-${c}`,
          left: c * dotSpacing,
          top: r * dotSpacing,
        });
      }
    }
    return result;
  }, [width, height, dotSpacing]);

  return (
    <View style={[styles.canvas, { width, height }]}>
      {dots.map((dot) => (
        <View
          key={dot.key}
          style={[
            styles.dot,
            {
              left: dot.left,
              top: dot.top,
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
            },
          ]}
        />
      ))}
      <View style={styles.childLayer}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: GARDEN_SURFACES.depth,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  dot: {
    position: 'absolute',
    backgroundColor: GARDEN_ACCENT_DIM,
    opacity: 0.3,
  },
  childLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
