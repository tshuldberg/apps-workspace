import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, surfaceTiers } from '@mylife/ui';
import {
  deleteMemorabilia,
  getMemorabilia,
  type Memorabilia,
} from '@mylife/sports';
import { useDatabase } from '../../../../components/DatabaseProvider';
import { SPORTS_ACCENT } from '../../_ui';

function formatDate(ms: number | null): string {
  if (ms === null) return '—';
  return new Date(ms).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCents(cents: number): string {
  if (!cents) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function signedCents(cents: number): string {
  if (!cents) return '—';
  const abs = `$${(Math.abs(cents) / 100).toFixed(2)}`;
  return cents > 0 ? `+${abs}` : `−${abs}`;
}

export default function MemorabiliaDetailScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const rawId = params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [row, setRow] = useState<Memorabilia | null>(null);

  const reload = useCallback(() => {
    if (!id) return;
    setRow(getMemorabilia(db, id));
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleDelete = useCallback(() => {
    if (!id || !row) return;
    Alert.alert('Delete memorabilia?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMemorabilia(db, id);
          router.back();
        },
      },
    ]);
  }, [db, id, router, row]);

  const handleEdit = useCallback(() => {
    if (!id) return;
    router.push(`/(sports)/events/memorabilia/add?editId=${id}` as never);
  }, [id, router]);

  if (!row) {
    return (
      <View style={[styles.screen, styles.emptyWrap]}>
        <Text style={styles.missingText}>Item not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const appreciation =
    row.estimated_value_cents - row.purchase_price_cents;

  const appreciationColor =
    appreciation > 0
      ? SPORTS_ACCENT
      : appreciation < 0
        ? '#F87171'
        : colors.text;

  const meta = [row.sport, row.team, row.player]
    .filter((p): p is string => !!p && p.trim() !== '')
    .join(' · ');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.eyebrow}>{row.item_type.toUpperCase()}</Text>
      <Text style={styles.title}>{row.description}</Text>
      {meta ? <Text style={styles.subtitle}>{meta}</Text> : null}

      <View style={styles.metaCard}>
        <MetaRow label="Acquired" value={formatDate(row.acquired_at)} />
        <MetaRow
          label="Paid"
          value={formatCents(row.purchase_price_cents)}
        />
        <MetaRow
          label="Est. value"
          value={formatCents(row.estimated_value_cents)}
        />
        <MetaRow
          label="Change"
          value={signedCents(appreciation)}
          accentColor={appreciationColor}
        />
      </View>

      {row.notes_md ? (
        <View style={styles.block}>
          <Text style={styles.blockLabel}>Notes</Text>
          <View style={styles.flatCard}>
            <Text style={styles.bodyText}>{row.notes_md}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={styles.secondaryBtn} onPress={handleEdit}>
          <Text style={styles.secondaryBtnText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.destructiveBtn} onPress={handleDelete}>
          <Text style={styles.destructiveBtnText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function MetaRow({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          accentColor ? { color: accentColor, fontWeight: '700' } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surfaceTiers.lowest },
  content: { padding: 20, paddingBottom: 140, gap: 14 },
  emptyWrap: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  missingText: { color: colors.textSecondary, fontSize: 15 },
  eyebrow: {
    color: SPORTS_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textSecondary, fontSize: 14 },
  metaCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  metaValue: { color: colors.text, fontSize: 14 },
  block: { gap: 10 },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  flatCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bodyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  secondaryBtnText: { color: colors.text, fontSize: 15, fontWeight: '800' },
  destructiveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F87171',
    backgroundColor: surfaceTiers.container,
    alignItems: 'center',
  },
  destructiveBtnText: { color: '#F87171', fontSize: 15, fontWeight: '800' },
});
