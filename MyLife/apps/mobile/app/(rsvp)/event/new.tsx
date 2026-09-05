import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Text, Card, colors, spacing } from '@mylife/ui';
import { useRsvpContext } from '../../../components/rsvp/RsvpContext';
import { getTemplates, applyTemplate, getSetting, type EventTemplate } from '@mylife/rsvp';
import { useDatabase } from '../../../components/DatabaseProvider';

const ACCENT = colors.modules.rsvp;

function TemplateChip({
  template,
  selected,
  onPress,
}: {
  template: EventTemplate;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.templateChip, selected && styles.templateChipSelected]}
      onPress={onPress}
    >
      <Text style={styles.templateIcon}>{template.icon}</Text>
      <Text
        variant="caption"
        color={selected ? colors.background : colors.textSecondary}
      >
        {template.name}
      </Text>
    </Pressable>
  );
}

export default function CreateEventScreen() {
  const router = useRouter();
  const db = useDatabase();
  const { createEvent } = useRsvpContext();
  const templates = getTemplates();

  const savedVisibility = getSetting(db, 'default_visibility') ?? 'private';
  const savedApproval = (getSetting(db, 'default_requires_approval') ?? 'false') === 'true';
  const savedHostName = getSetting(db, 'host_name') ?? 'Host';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [requiresApproval, setRequiresApproval] = useState(savedApproval);
  const [allowPlusOnes, setAllowPlusOnes] = useState(true);
  const [allowPolls, setAllowPolls] = useState(true);
  const [allowPhotoAlbum, setAllowPhotoAlbum] = useState(true);
  const [allowComments, setAllowComments] = useState(true);

  const selectTemplate = (t: EventTemplate) => {
    if (selectedTemplate === t.id) {
      setSelectedTemplate(null);
      return;
    }
    setSelectedTemplate(t.id);
    const applied = applyTemplate(t.id);
    if (applied) {
      if (!title) setTitle(applied.templateName);
      if (applied.suggestedDescription) setDescription(applied.suggestedDescription);
      const settings = applied.suggestedSettings as Record<string, boolean>;
      if (settings.requiresApproval !== undefined) setRequiresApproval(settings.requiresApproval);
      if (settings.allowPhotoAlbum !== undefined) setAllowPhotoAlbum(settings.allowPhotoAlbum);
      if (settings.allowPolls !== undefined) setAllowPolls(settings.allowPolls);
    }
  };

  const handleCreate = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Missing title', 'Give your event a name.');
      return;
    }

    let startAt: string;
    if (date && time) {
      const parsed = new Date(`${date}T${time}`);
      if (isNaN(parsed.getTime())) {
        Alert.alert('Invalid date', 'Please use YYYY-MM-DD for date and HH:MM for time.');
        return;
      }
      startAt = parsed.toISOString();
    } else if (date) {
      const parsed = new Date(`${date}T18:00`);
      if (isNaN(parsed.getTime())) {
        Alert.alert('Invalid date', 'Please use YYYY-MM-DD format.');
        return;
      }
      startAt = parsed.toISOString();
    } else {
      startAt = new Date(Date.now() + 7 * 86400000).toISOString();
    }

    createEvent({
      title: trimmedTitle,
      description: description.trim() || undefined,
      startAt,
      locationName: location.trim() || undefined,
      visibility: savedVisibility as 'public' | 'unlisted' | 'private',
      requiresApproval,
      allowPlusOnes,
      allowPolls,
      allowPhotoAlbum,
      allowComments,
      createdBy: savedHostName,
    });

    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ title: 'New Event', headerBackTitle: 'Events' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Templates */}
        <View style={styles.section}>
          <Text variant="label" color={colors.textTertiary}>START FROM TEMPLATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateRow}>
            {templates.map((t) => (
              <TemplateChip
                key={t.id}
                template={t}
                selected={selectedTemplate === t.id}
                onPress={() => selectTemplate(t)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Details */}
        <Card style={styles.cardGap}>
          <Text variant="subheading">Event Details</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Event name"
            placeholderTextColor={colors.textTertiary}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Location (optional)"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.dateRow}>
            <TextInput
              style={[styles.input, styles.dateInput]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={[styles.input, styles.timeInput]}
              value={time}
              onChangeText={setTime}
              placeholder="HH:MM"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
        </Card>

        {/* Settings */}
        <Card style={styles.cardGap}>
          <Text variant="subheading">Settings</Text>
          <ToggleRow label="Require approval" value={requiresApproval} onToggle={setRequiresApproval} />
          <ToggleRow label="Allow plus-ones" value={allowPlusOnes} onToggle={setAllowPlusOnes} />
          <ToggleRow label="Allow polls" value={allowPolls} onToggle={setAllowPolls} />
          <ToggleRow label="Photo album" value={allowPhotoAlbum} onToggle={setAllowPhotoAlbum} />
          <ToggleRow label="Comments" value={allowComments} onToggle={setAllowComments} />
        </Card>

        {/* Create */}
        <Pressable style={styles.createButton} onPress={handleCreate}>
          <Text variant="label" color={colors.background}>Create Event</Text>
        </Pressable>
      </ScrollView>
    </>
  );
}

function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text variant="body">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: ACCENT }}
        thumbColor={colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  section: { gap: spacing.sm },
  templateRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  templateChipSelected: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  templateIcon: { fontSize: 16 },
  cardGap: { gap: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    fontSize: 15,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateInput: { flex: 3 },
  timeInput: { flex: 2 },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  createButton: {
    borderRadius: 10,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
});
