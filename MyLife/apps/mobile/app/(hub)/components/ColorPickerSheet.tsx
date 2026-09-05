import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { Text, useTheme } from '@mylife/ui';

export interface ColorPickerSheetProps {
  visible: boolean;
  initialColor: string;
  onColorChange: (color: string) => void;
  onDismiss: () => void;
}

const QUICK_PRESETS: string[] = [
  '#FFB877', // primary (warm)
  '#C9894D', // primary container
  '#8BCFF0', // tertiary blue
  '#30D158', // success green
  '#FFB4AB', // danger
  '#FFFFFF', // white
  '#131318', // background dark
  '#9F8E81', // outline neutral
  '#84CC16', // lime
  '#8B5CF6', // purple
];

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.min(620, SCREEN_HEIGHT * 0.85);

// --------------------------------------------------------------------------
// Color math helpers (HSL <-> hex <-> rgb)
// --------------------------------------------------------------------------

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function padHex(n: number): string {
  const v = clamp(Math.round(n), 0, 255).toString(16);
  return v.length === 1 ? `0${v}` : v;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${padHex(r)}${padHex(g)}${padHex(b)}`.toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 1);
  const ll = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) { r = c; g = x; b = 0; }
  else if (hh < 120) { r = x; g = c; b = 0; }
  else if (hh < 180) { r = 0; g = c; b = x; }
  else if (hh < 240) { r = 0; g = x; b = c; }
  else if (hh < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr: h = ((gg - bb) / d + (gg < bb ? 6 : 0)); break;
      case gg: h = ((bb - rr) / d + 2); break;
      default: h = ((rr - gg) / d + 4);
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb.r, rgb.g, rgb.b);
}

// --------------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------------

interface HueBarProps {
  hue: number;
  onHueChange: (hue: number) => void;
  width: number;
}

function HueBar({ hue, onHueChange, width }: HueBarProps) {
  const handle = useCallback(
    (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
      const x = clamp(gesture.moveX - 20, 0, width);
      onHueChange((x / width) * 360);
    },
    [onHueChange, width],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = clamp(evt.nativeEvent.locationX, 0, width);
          onHueChange((x / width) * 360);
        },
        onPanResponderMove: handle,
      }),
    [handle, onHueChange, width],
  );

  // Build hue strip from 8 segments for visual approximation.
  const segments = Array.from({ length: 12 }, (_, i) => i * 30);
  const indicatorX = (hue / 360) * width;

  return (
    <View
      {...responder.panHandlers}
      style={{ width, height: 32, flexDirection: 'row', borderRadius: 16, overflow: 'hidden' }}
    >
      {segments.map((h, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: hslToHex(h, 1, 0.5),
          }}
        />
      ))}
      <View
        pointerEvents="none"
        style={[
          styles.hueIndicator,
          { left: clamp(indicatorX - 8, 0, width - 16) },
        ]}
      />
    </View>
  );
}

interface SLSquareProps {
  hue: number;
  s: number;
  l: number;
  onChange: (s: number, l: number) => void;
  size: number;
}

function SLSquare({ hue, s, l, onChange, size }: SLSquareProps) {
  const handle = useCallback(
    (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
      // gesture.moveX/Y are page coords. Need locationX — use gesture dx from start.
      // Simpler: listen on native events via onPanResponderMove with evt.nativeEvent.
      const x = clamp(gesture.moveX - 20, 0, size);
      const y = clamp(gesture.moveY - 220, 0, size);
      onChange(x / size, 1 - y / size);
    },
    [onChange, size],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = clamp(evt.nativeEvent.locationX, 0, size);
          const y = clamp(evt.nativeEvent.locationY, 0, size);
          onChange(x / size, 1 - y / size);
        },
        onPanResponderMove: handle,
      }),
    [handle, onChange, size],
  );

  const indicatorX = s * size;
  const indicatorY = (1 - l) * size;
  const hueColor = hslToHex(hue, 1, 0.5);

  return (
    <View
      {...responder.panHandlers}
      style={{
        width: size,
        height: size,
        backgroundColor: hueColor,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Saturation gradient (white -> hue) — approximated with overlay rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={`s-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${(1 - i / 10) * 100}%`,
            backgroundColor: 'white',
            opacity: 0.1,
          }}
        />
      ))}
      {/* Lightness gradient (transparent -> black top to bottom) */}
      {Array.from({ length: 10 }).map((_, i) => (
        <View
          key={`l-${i}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(i / 10) * 100}%`,
            height: `${100 / 10}%`,
            backgroundColor: 'black',
            opacity: i / 15,
          }}
        />
      ))}
      <View
        pointerEvents="none"
        style={[
          styles.slIndicator,
          { left: clamp(indicatorX - 10, 0, size - 20), top: clamp(indicatorY - 10, 0, size - 20) },
        ]}
      />
    </View>
  );
}

interface RGBSliderProps {
  label: string;
  value: number;
  trackColor: string;
  onChange: (v: number) => void;
  width: number;
}

function RGBSlider({ label, value, trackColor, onChange, width }: RGBSliderProps) {
  const theme = useTheme();
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = clamp(evt.nativeEvent.locationX, 0, width);
          onChange(Math.round((x / width) * 255));
        },
        onPanResponderMove: (_evt, gesture) => {
          const x = clamp(gesture.moveX - 20, 0, width);
          onChange(Math.round((x / width) * 255));
        },
      }),
    [onChange, width],
  );
  const indicatorX = (value / 255) * width;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: theme.colors.text, width: 16, fontWeight: '600' }}>{label}</Text>
      <View
        {...responder.panHandlers}
        style={{
          flex: 1,
          height: 24,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: trackColor,
          }}
        />
        <View
          pointerEvents="none"
          style={[
            styles.sliderKnob,
            {
              left: clamp(indicatorX - 8, 0, width - 16),
              backgroundColor: theme.colors.text,
            },
          ]}
        />
      </View>
      <Text style={{ color: theme.colors.textSecondary, width: 32, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

// --------------------------------------------------------------------------
// Main sheet
// --------------------------------------------------------------------------

export function ColorPickerSheet({
  visible,
  initialColor,
  onColorChange,
  onDismiss,
}: ColorPickerSheetProps) {
  const theme = useTheme();
  const { colors, surfaces, typeScale } = theme;
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const [hue, setHue] = useState(0);
  const [sat, setSat] = useState(1);
  const [light, setLight] = useState(0.5);
  const [hexInput, setHexInput] = useState(initialColor.toUpperCase());
  const [originalColor] = useState(initialColor);

  const currentColor = useMemo(() => hslToHex(hue, sat, light), [hue, sat, light]);
  const rgb = useMemo(() => hexToRgb(currentColor) ?? { r: 0, g: 0, b: 0 }, [currentColor]);

  // Initialize picker state from initialColor whenever the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const hsl = hexToHsl(initialColor);
    if (hsl) {
      setHue(hsl.h);
      setSat(hsl.s);
      setLight(hsl.l);
    }
    setHexInput(initialColor.toUpperCase());
  }, [visible, initialColor]);

  // Slide animation.
  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  // Push live updates out as the user drags.
  useEffect(() => {
    if (!visible) return;
    onColorChange(currentColor);
    setHexInput(currentColor);
  }, [currentColor, visible, onColorChange]);

  const handleHexSubmit = useCallback(() => {
    const parsed = hexToHsl(hexInput);
    if (parsed) {
      setHue(parsed.h);
      setSat(parsed.s);
      setLight(parsed.l);
    } else {
      setHexInput(currentColor);
    }
  }, [hexInput, currentColor]);

  const handleRgbChange = useCallback(
    (channel: 'r' | 'g' | 'b', v: number) => {
      const next = { ...rgb, [channel]: v };
      const hsl = rgbToHsl(next.r, next.g, next.b);
      setHue(hsl.h);
      setSat(hsl.s);
      setLight(hsl.l);
    },
    [rgb],
  );

  const handlePreset = useCallback((preset: string) => {
    const parsed = hexToHsl(preset);
    if (parsed) {
      setHue(parsed.h);
      setSat(parsed.s);
      setLight(parsed.l);
    }
  }, []);

  const sheetWidth = Dimensions.get('window').width - 40;
  const slSize = Math.min(240, sheetWidth - 40);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderTopLeftRadius: surfaces.cornerRadius.card,
              borderTopRightRadius: surfaces.cornerRadius.card,
              borderColor: colors.border,
              transform: [{ translateY }],
              height: SHEET_HEIGHT,
            },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text
              style={{
                fontSize: typeScale.heading.size,
                fontWeight: typeScale.heading.weight,
                color: colors.text,
              }}
            >
              Pick a Color
            </Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
            </Pressable>
          </View>

          {/* Preview swatches */}
          <View style={styles.previewRow}>
            <View style={styles.previewBlock}>
              <View
                style={[
                  styles.previewSwatch,
                  { backgroundColor: originalColor, borderColor: colors.border },
                ]}
              />
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>
                Original
              </Text>
            </View>
            <View style={styles.previewBlock}>
              <View
                style={[
                  styles.previewSwatch,
                  { backgroundColor: currentColor, borderColor: colors.border },
                ]}
              />
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 4 }}>
                New
              </Text>
            </View>
          </View>

          {/* SL square */}
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <SLSquare
              hue={hue}
              s={sat}
              l={light}
              onChange={(s, l) => {
                setSat(s);
                setLight(l);
              }}
              size={slSize}
            />
          </View>

          {/* Hue bar */}
          <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
            <HueBar hue={hue} onHueChange={setHue} width={sheetWidth - 40} />
          </View>

          {/* Hex input */}
          <View style={{ paddingHorizontal: 20, marginTop: 12, flexDirection: 'row', gap: 10 }}>
            <Text style={{ color: colors.textSecondary, alignSelf: 'center', width: 32 }}>
              Hex
            </Text>
            <TextInput
              value={hexInput}
              onChangeText={setHexInput}
              onBlur={handleHexSubmit}
              onSubmitEditing={handleHexSubmit}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[
                styles.hexInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: surfaces.cornerRadius.button,
                },
              ]}
              placeholder="#000000"
              placeholderTextColor={colors.textTertiary}
              maxLength={7}
            />
          </View>

          {/* RGB sliders */}
          <View style={{ paddingHorizontal: 20, marginTop: 10, gap: 6 }}>
            <RGBSlider
              label="R"
              value={Math.round(rgb.r)}
              trackColor="#FF4040"
              width={sheetWidth - 40 - 26 - 42}
              onChange={(v) => handleRgbChange('r', v)}
            />
            <RGBSlider
              label="G"
              value={Math.round(rgb.g)}
              trackColor="#40C040"
              width={sheetWidth - 40 - 26 - 42}
              onChange={(v) => handleRgbChange('g', v)}
            />
            <RGBSlider
              label="B"
              value={Math.round(rgb.b)}
              trackColor="#4080FF"
              width={sheetWidth - 40 - 26 - 42}
              onChange={(v) => handleRgbChange('b', v)}
            />
          </View>

          {/* Quick presets */}
          <View style={styles.presetsRow}>
            {QUICK_PRESETS.map((p) => (
              <Pressable
                key={p}
                onPress={() => handlePreset(p)}
                style={[
                  styles.presetDot,
                  { backgroundColor: p, borderColor: colors.border },
                ]}
              />
            ))}
          </View>

          {/* Done button */}
          <View style={{ paddingHorizontal: 20, marginTop: 'auto', paddingBottom: 24 }}>
            <Pressable
              onPress={onDismiss}
              style={[
                styles.doneButton,
                {
                  backgroundColor: colors.primary,
                  borderRadius: surfaces.cornerRadius.button,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.background,
                  fontWeight: '700',
                  fontSize: 16,
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default ColorPickerSheet;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  previewBlock: { alignItems: 'center' },
  previewSwatch: {
    width: 64,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  hueIndicator: {
    position: 'absolute',
    top: 2,
    width: 16,
    height: 28,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
  },
  slIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
  },
  sliderKnob: {
    position: 'absolute',
    top: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  hexInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontFamily: 'monospace',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginTop: 14,
    justifyContent: 'center',
  },
  presetDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  doneButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
});
