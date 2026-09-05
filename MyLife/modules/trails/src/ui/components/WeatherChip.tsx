import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import {
  TR_TEXT,
  TR_TYPOGRAPHY,
  TR_WEATHER,
  getTrailWeatherTone,
  withAlpha,
} from '../tokens';
import { MaterialSymbol, type TrailsMaterialSymbolName } from './MaterialSymbol';

export interface WeatherChipProps {
  condition: string;
  temperature: number | string;
  icon?: TrailsMaterialSymbolName;
  style?: StyleProp<ViewStyle>;
}

export function resolveWeatherChipTone(condition: string) {
  const tone = getTrailWeatherTone(condition);
  const color = TR_WEATHER[tone];

  let icon: TrailsMaterialSymbolName = 'cloud';
  if (tone === 'sunny') {
    icon = 'partly_cloudy_day';
  }

  return { tone, color, icon };
}

export function WeatherChip({
  condition,
  temperature,
  icon,
  style,
}: WeatherChipProps) {
  const resolved = resolveWeatherChipTone(condition);
  const tempValue = typeof temperature === 'number'
    ? `${Math.round(temperature)}°`
    : temperature;

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: withAlpha(resolved.color, 0.14),
        },
        style,
      ]}
    >
      <MaterialSymbol
        name={icon ?? resolved.icon}
        size={14}
        color={resolved.color}
      />
      <Text style={[styles.copy, { color: TR_TEXT }]}>
        {tempValue}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  copy: {
    ...TR_TYPOGRAPHY.labelUpper,
  },
});
