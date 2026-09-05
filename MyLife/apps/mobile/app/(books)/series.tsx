import { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  Image,
  Alert,
  Text as RNText,
} from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState, colors } from '@mylife/ui';
import {
  GlassCard,
  GradientButton,
  BOOKS_SURFACES,
  BOOKS_TYPOGRAPHY,
  JAKARTA_FONTS,
} from '@mylife/books/ui';
import { useSeries } from '../../hooks/books/use-series';

const BOOKS_ACCENT = colors.modules.books;

export default function SeriesScreen() {
  const router = useRouter();
  const { allSeries, loading, create, remove, getBooks } = useSeries();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    create(name.trim(), description.trim() || undefined);
    setName('');
    setDescription('');
    setShowCreate(false);
  };

  const handleDelete = (seriesId: string) => {
    Alert.alert('Delete Series', 'Remove this series and unlink all books?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(seriesId) },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  if (allSeries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="📚"
          title="No series yet"
          message="Organize your books into series to track reading order and progression."
          actionLabel="Create Series"
          onAction={() => setShowCreate(true)}
          accentColor={BOOKS_ACCENT}
        />
        <CreateSeriesModal
          visible={showCreate}
          onClose={() => setShowCreate(false)}
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          onCreate={handleCreate}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <RNText style={styles.headerLabel}>COLLECTION</RNText>
        <RNText style={styles.headerTitle}>Series Library</RNText>
        <RNText style={styles.headerSubtitle}>
          Organize and track your multi-book collections, trilogies, sagas, and
          narrative sequences.
        </RNText>
      </View>

      {/* Create Button */}
      <View style={styles.buttonRow}>
        <GradientButton
          label="+ Create Series"
          onPress={() => setShowCreate(true)}
        />
      </View>

      {/* Series Cards */}
      {allSeries.map((s) => {
        const booksInSeries = getBooks(s.id);
        const firstCover = booksInSeries.find((b) => b.cover_url)?.cover_url;

        return (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/(books)/series/${s.id}`)}
            onLongPress={() => handleDelete(s.id)}
          >
          <GlassCard
            level={2}
            style={styles.seriesCard}
          >
            <View style={styles.seriesCardInner}>
              {/* Cover */}
              <View style={styles.seriesCoverWrap}>
                {firstCover ? (
                  <Image
                    source={{ uri: firstCover }}
                    style={styles.seriesCover}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.seriesCover, styles.seriesCoverPlaceholder]}>
                    <RNText style={styles.placeholderIcon}>📚</RNText>
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.seriesCardInfo}>
                <RNText style={styles.seriesName} numberOfLines={2}>
                  {s.name}
                </RNText>
                {s.description && (
                  <RNText style={styles.seriesDescription} numberOfLines={2}>
                    {s.description}
                  </RNText>
                )}
                <RNText style={styles.seriesBookCount}>
                  {booksInSeries.length} book{booksInSeries.length !== 1 ? 's' : ''}
                </RNText>
              </View>

              {/* Delete on long press is handled by the card itself */}
            </View>
          </GlassCard>
          </Pressable>
        );
      })}

      {/* Inspirational Quote */}
      <View style={styles.quoteSection}>
        <RNText style={styles.quoteText}>
          "KNOWLEDGE IS A SEQUENCE, NOT A POINT."
        </RNText>
      </View>

      {/* Create Modal */}
      <CreateSeriesModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        onCreate={handleCreate}
      />
    </ScrollView>
  );
}

// ── Create Series Modal ───────────────────────────────────

function CreateSeriesModal({
  visible,
  onClose,
  name,
  setName,
  description,
  setDescription,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  onCreate: (isDraft?: boolean) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <RNText style={styles.modalTitle}>New Series</RNText>
            <Pressable onPress={onClose} hitSlop={12}>
              <RNText style={styles.modalClose}>{'\u2715'}</RNText>
            </Pressable>
          </View>

          {/* Series Name */}
          <RNText style={styles.inputLabel}>SERIES NAME</RNText>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. The Sprawl Trilogy"
            placeholderTextColor="rgba(228,225,233,0.3)"
          />

          {/* Description */}
          <RNText style={styles.inputLabel}>DESCRIPTION</RNText>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the theme or narrative arc..."
            placeholderTextColor="rgba(228,225,233,0.3)"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Initialize Button */}
          <GradientButton
            label="Initialize Collection"
            onPress={() => onCreate(false)}
            disabled={!name.trim()}
          />

          {/* Save as Draft */}
          <Pressable
            onPress={() => onCreate(true)}
            style={styles.draftLink}
          >
            <RNText style={styles.draftText}>Save as Draft</RNText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    padding: 20,
    gap: 16,
  },
  skeleton: {
    height: 100,
    borderRadius: 16,
    backgroundColor: BOOKS_SURFACES.lift,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    marginBottom: 6,
  },
  headerTitle: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
    color: '#D6C3B5',
    lineHeight: 22,
  },

  // Buttons
  buttonRow: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  // Series Cards
  seriesCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  seriesCardInner: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  seriesCoverWrap: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  seriesCover: {
    width: 70,
    height: 100,
    borderRadius: 12,
  },
  seriesCoverPlaceholder: {
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 28,
  },
  seriesCardInfo: {
    flex: 1,
    gap: 4,
  },
  seriesName: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 17,
    color: '#E4E1E9',
  },
  seriesDescription: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 13,
    color: '#D6C3B5',
    lineHeight: 19,
  },
  seriesBookCount: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#9F8E81',
    marginTop: 2,
  },

  // Quote
  quoteSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  quoteText: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 13,
    color: 'rgba(228,225,233,0.25)',
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modal: {
    backgroundColor: BOOKS_SURFACES.lift,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 22,
    color: '#E4E1E9',
  },
  modalClose: {
    fontSize: 20,
    color: '#9F8E81',
  },
  inputLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#C9894D',
    fontSize: 11,
  },
  input: {
    backgroundColor: BOOKS_SURFACES.focus,
    borderRadius: 12,
    padding: 14,
    color: '#E4E1E9',
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  draftLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  draftText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
    textDecorationLine: 'underline',
  },
});
