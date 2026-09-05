// Share-intent confirm screen (Phase 3).
//
// Reached two ways: (1) the OS share sheet routes a shared link/text here via
// ShareIntentWatcher, (2) the Discover "Import link" action. The user always
// confirms a parsed candidate before it is saved. On-device parsing is free
// and offline; AI extraction is opt-in (Settings) and never required.
import { useMemo, useState } from 'react';
import { View, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text, Card, Button } from '@mylife/ui';
import {
  parseShareIntent,
  extractEventFromShare,
  classify,
  addFacet,
  createEvent,
  getSetting,
  FacetAxis,
  type NormalizedEvent,
} from '@mylife/manhattan';
import { useManhattanDatabase } from '../providers/DatabaseProvider';
import { DateTimeField } from '../components/DateTimeField';

const BACKGROUND = '#131318';

type LlmFetch = Parameters<typeof extractEventFromShare>[2];
// The opt-in AI path reuses the @mylife/intelligence transport, which calls a
// fetch-shaped function. Wrap the global fetch to satisfy that contract.
const llmFetch = ((url: string, init?: unknown) =>
  fetch(url, init as RequestInit)) as LlmFetch;

export default function ShareConfirmScreen() {
  const db = useManhattanDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ text?: string; url?: string }>();

  const initial = useMemo(
    () => parseShareIntent({ text: params.text, url: params.url }),
    [params.text, params.url],
  );

  const [raw, setRaw] = useState(params.text ?? params.url ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [venue, setVenue] = useState(initial?.venueName ?? '');
  const [startAt, setStartAt] = useState(initial?.startAt ?? '');
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? params.url ?? '');
  const [aiBusy, setAiBusy] = useState(false);

  const aiEnabled = getSetting(db, 'aiExtractionEnabled') === 'true';

  const handleParse = () => {
    const candidate = parseShareIntent({ text: raw, url: raw });
    if (!candidate) {
      Alert.alert('Nothing to parse', 'Paste a link or some event text first.');
      return;
    }
    setTitle(candidate.title);
    setVenue(candidate.venueName ?? '');
    setStartAt(candidate.startAt ?? '');
    setSourceUrl(candidate.sourceUrl ?? '');
  };

  const handleAi = async () => {
    setAiBusy(true);
    try {
      const extracted = await extractEventFromShare(db, raw || title, llmFetch);
      if (extracted) {
        setTitle(extracted.title);
        if (extracted.venueName) setVenue(extracted.venueName);
        if (extracted.startAt) setStartAt(extracted.startAt);
      } else {
        Alert.alert(
          'AI extraction unavailable',
          'Turn on AI in Settings to use it. Your parsed details are unchanged.',
        );
      }
    } catch {
      Alert.alert('AI extraction failed', 'Keep the parsed details and try again later.');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSave = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const eventId = createEvent(db, {
      title: cleanTitle,
      venueName: venue.trim() || null,
      startAt: startAt.trim() || null,
      purchaseUrl: sourceUrl.trim() || null,
      sourceId: 'share_intent',
      saved: true,
    });

    const forClassify: NormalizedEvent = {
      sourceId: 'share_intent',
      title: cleanTitle,
      venueName: venue.trim() || undefined,
      startAt: startAt.trim() || undefined,
    };
    for (const facet of classify(forClassify)) {
      const parsedAxis = FacetAxis.safeParse(facet.axis);
      if (parsedAxis.success) {
        addFacet(db, { eventId, axis: parsedAxis.data, value: facet.value });
      }
    }

    router.replace('/(root)/(tabs)/discover');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text variant="heading" style={styles.title}>Save to Manhattan</Text>
      <Text variant="caption" color="#9F8E81" style={styles.subtitle}>
        Confirm the details parsed from your shared link or text.
      </Text>

      <Card>
        <Text variant="label" color="#9F8E81">Shared text or link</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={raw}
          onChangeText={setRaw}
          placeholder="Paste a link or event text"
          placeholderTextColor="#52443A"
          multiline
        />
        <Button title="Parse" variant="secondary" onPress={handleParse} />
      </Card>

      <Card>
        <Text variant="label" color="#9F8E81">Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Event title"
          placeholderTextColor="#52443A"
        />
        <Text variant="label" color="#9F8E81">Venue</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="Venue (optional)"
          placeholderTextColor="#52443A"
        />
        <DateTimeField
          label="Starts (optional)"
          value={startAt}
          onChange={setStartAt}
          clearable
        />
        <Text variant="label" color="#9F8E81">Link</Text>
        <TextInput
          style={styles.input}
          value={sourceUrl}
          onChangeText={setSourceUrl}
          placeholder="https://..."
          placeholderTextColor="#52443A"
          autoCapitalize="none"
        />
      </Card>

      {aiEnabled ? (
        <Button
          title={aiBusy ? 'Extracting...' : 'Enhance with AI'}
          variant="secondary"
          onPress={() => { void handleAi(); }}
          disabled={aiBusy}
        />
      ) : null}

      <View style={styles.actions}>
        <Button title="Save event" onPress={handleSave} disabled={!title.trim()} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  title: { marginBottom: 2 },
  subtitle: { marginBottom: 8 },
  input: {
    backgroundColor: '#1F1F25',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#E4E1E9',
    fontSize: 16,
    marginTop: 6,
    marginBottom: 12,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  actions: { gap: 8, marginTop: 4 },
});
