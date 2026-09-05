import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Button, Text } from '@mylife/ui';
import {
  dateToPlanString,
  formatPlanLabel,
  planStringToDate,
  roundToNextHalfHour,
} from '../lib/datetime';

const ACCENT = '#E4572E';

// Replaces the raw YYYY-MM-DDTHH:mm text inputs from the production eval's
// top UX finding. The stored value stays the canonical plan string; only the
// input affordance changes. Android uses the imperative two-step (date, then
// time) API; iOS shows a spinner in a bottom sheet.
export function DateTimeField({
  label,
  value,
  onChange,
  placeholder = 'Pick date and time',
  clearable = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  clearable?: boolean;
}) {
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => planStringToDate(value) ?? roundToNextHalfHour());

  // Fall back to the raw string for legacy/parsed values that are set but not
  // in canonical form, so existing data is never hidden behind a placeholder.
  const display = formatPlanLabel(value) ?? (value.trim() ? value.trim() : null);

  const openPicker = () => {
    const initial = planStringToDate(value) ?? roundToNextHalfHour();
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        onChange: (dateEvent, date) => {
          if (dateEvent.type !== 'set' || !date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            onChange: (timeEvent, dateTime) => {
              if (timeEvent.type !== 'set' || !dateTime) return;
              onChange(dateToPlanString(dateTime));
            },
          });
        },
      });
      return;
    }
    setDraft(initial);
    setIosOpen(true);
  };

  return (
    <View>
      <Text variant="label" color="#9F8E81">{label}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={display ? `${label}: ${display}` : `${label}: not set`}
          style={styles.field}
          onPress={openPicker}
        >
          <Text variant="body" color={display ? '#E4E1E9' : '#52443A'}>
            {display ?? placeholder}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            style={styles.clear}
            onPress={() => onChange('')}
            hitSlop={8}
          >
            <Text variant="caption" color="#9F8E81">✕</Text>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide">
          <View style={styles.backdrop}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="spinner"
                themeVariant="dark"
                accentColor={ACCENT}
                minuteInterval={5}
                onChange={(_event, date) => {
                  if (date) setDraft(date);
                }}
              />
              <View style={styles.sheetActions}>
                <Button
                  title="Done"
                  onPress={() => {
                    onChange(dateToPlanString(draft));
                    setIosOpen(false);
                  }}
                />
                <Button title="Cancel" variant="ghost" onPress={() => setIosOpen(false)} />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 8 },
  field: {
    flex: 1,
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  clear: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: '#1B1B20',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  sheetActions: { gap: 8, marginTop: 4 },
});
