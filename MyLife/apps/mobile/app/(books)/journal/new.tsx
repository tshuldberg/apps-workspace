import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
  Alert,
  FlatList,
  Image,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@mylife/ui';
import { GlassCard, GenreChip } from '@mylife/books/ui';
import {
  BOOKS_TYPOGRAPHY,
  BOOKS_SURFACES,
  JAKARTA_FONTS,
  BOOKS_CTA_GRADIENT,
} from '@mylife/books';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from 'lucide-react-native';
import { useJournal } from '../../../hooks/books/use-journal';
import { useBooks } from '../../../hooks/books/use-books';

const ACCENT = colors.modules.books;
const ImageIcon = icons.Image;
const ListIcon = icons.List;
const LinkIcon = icons.Link;
const CameraIcon = icons.Camera;
const XIcon = icons.X;

const MOOD_OPTIONS = [
  { label: 'Inspired', value: 'inspired' },
  { label: 'Thoughtful', value: 'reflective' },
  { label: 'Intrigued', value: 'intrigued' },
  { label: 'Contemplative', value: 'contemplative' },
  { label: 'Excited', value: 'excited' },
  { label: 'Peaceful', value: 'peaceful' },
  { label: 'Confused', value: 'confused' },
  { label: 'Sad', value: 'sad' },
];

function formatDateDisplay(): string {
  const d = new Date();
  const month = d.toLocaleDateString('en-US', { month: 'long' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

export default function JournalNewScreen() {
  const router = useRouter();
  const { create } = useJournal();
  const { books } = useBooks();
  const [title, setTitle] = useState('Reflection & Notes');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<string | undefined>();
  const [encrypt, setEncrypt] = useState(true);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);

  const handleSave = useCallback(async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await create(content, {
        title: title.trim() || undefined,
        mood,
        bookIds: selectedBookIds.length > 0 ? selectedBookIds : undefined,
        passphrase: encrypt && passphrase ? passphrase : undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert('Save Failed', e instanceof Error ? e.message : 'Could not save journal entry.');
    } finally {
      setSaving(false);
    }
  }, [content, title, mood, selectedBookIds, encrypt, passphrase, create, router]);

  const toggleBook = useCallback((bookId: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId],
    );
  }, []);

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Date */}
        <Text style={styles.dateDisplay}>{formatDateDisplay()}</Text>

        {/* Title */}
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Reflection & Notes"
          placeholderTextColor="rgba(228,225,233,0.35)"
        />

        {/* Current Mood */}
        <Text style={styles.sectionLabel}>CURRENT MOOD</Text>
        <FlatList
          horizontal
          data={MOOD_OPTIONS}
          keyExtractor={(item) => item.value}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.moodRow}
          renderItem={({ item }) => (
            <GenreChip
              label={item.label}
              selected={mood === item.value}
              onPress={() => setMood(mood === item.value ? undefined : item.value)}
            />
          )}
        />

        {/* Linked Book */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>LINKED BOOK</Text>
          <Pressable hitSlop={8}>
            <Text style={styles.browseLink}>+ Browse Library</Text>
          </Pressable>
        </View>

        {books.length > 0 && (
          <FlatList
            horizontal
            data={books.slice(0, 10)}
            keyExtractor={(b) => b.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bookRow}
            renderItem={({ item }) => {
              const isSelected = selectedBookIds.includes(item.id);
              return (
                <Pressable onPress={() => toggleBook(item.id)} style={styles.bookPickerItem}>
                  <View style={[styles.bookCoverWrap, isSelected && styles.bookCoverSelected]}>
                    {item.cover_url ? (
                      <Image source={{ uri: item.cover_url }} style={styles.bookCover} />
                    ) : (
                      <View style={[styles.bookCover, styles.bookCoverPlaceholder]}>
                        <Text style={styles.bookEmoji}>{'\u{1F4D6}'}</Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={styles.checkBadge}>
                        <Text style={styles.checkText}>{'\u2713'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.bookPickerTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.bookPickerAuthor} numberOfLines={1}>
                    {(() => {
                      try {
                        const arr = JSON.parse(item.authors);
                        return Array.isArray(arr) ? arr[0] ?? '' : item.authors;
                      } catch {
                        return item.authors;
                      }
                    })()}
                  </Text>
                </Pressable>
              );
            }}
          />
        )}

        {/* Markdown editor */}
        <GlassCard level={2} style={styles.editorCard}>
          <TextInput
            style={styles.contentInput}
            value={content}
            onChangeText={setContent}
            placeholder="Write your markdown thoughts here..."
            placeholderTextColor="rgba(228,225,233,0.35)"
            multiline
            textAlignVertical="top"
          />
          <View style={styles.toolbarRow}>
            <Pressable style={styles.toolbarButton} hitSlop={8}>
              <ImageIcon size={20} color="#D6C3B5" />
            </Pressable>
            <Pressable style={styles.toolbarButton} hitSlop={8}>
              <ListIcon size={20} color="#D6C3B5" />
            </Pressable>
            <Pressable style={styles.toolbarButton} hitSlop={8}>
              <LinkIcon size={20} color="#D6C3B5" />
            </Pressable>
          </View>
        </GlassCard>

        {/* Encrypted Journal Section */}
        <GlassCard level={2} style={styles.encryptionCard}>
          <View style={styles.encryptRow}>
            <View style={styles.encryptLeft}>
              <Text style={styles.lockIcon}>{'\u{1F512}'}</Text>
              <View>
                <Text style={styles.encryptTitle}>Encrypted Journal</Text>
                <Text style={styles.encryptSubtitle}>END-TO-END PRIVACY</Text>
              </View>
            </View>
            <Switch
              value={encrypt}
              onValueChange={setEncrypt}
              trackColor={{ true: ACCENT, false: BOOKS_SURFACES.focus }}
              thumbColor="#E4E1E9"
            />
          </View>
          {encrypt && (
            <>
              <Text style={styles.passphraseLabel}>ENTRY PASSPHRASE</Text>
              <View style={styles.passphraseRow}>
                <TextInput
                  style={styles.passphraseInput}
                  value={passphrase}
                  onChangeText={setPassphrase}
                  placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                  placeholderTextColor="rgba(228,225,233,0.35)"
                  secureTextEntry={!showPassphrase}
                />
                <Pressable onPress={() => setShowPassphrase(!showPassphrase)} hitSlop={8}>
                  {showPassphrase ? (
                    <icons.Eye size={20} color="#D6C3B5" />
                  ) : (
                    <icons.EyeOff size={20} color="#D6C3B5" />
                  )}
                </Pressable>
              </View>
              <Text style={styles.biometricHint}>
                Your biometric key will also unlock this entry.
              </Text>
            </>
          )}
        </GlassCard>

        {/* Attachments */}
        <Text style={styles.sectionLabel}>ATTACHMENTS</Text>
        <View style={styles.attachmentRow}>
          {attachments.map((uri, idx) => (
            <View key={idx} style={styles.attachmentThumb}>
              <Image source={{ uri }} style={styles.attachmentImage} />
              <Pressable
                style={styles.attachmentRemove}
                onPress={() => removeAttachment(idx)}
              >
                <XIcon size={14} color="#E4E1E9" />
              </Pressable>
            </View>
          ))}
          <Pressable style={styles.addImageButton}>
            <CameraIcon size={24} color="#D6C3B5" />
            <Text style={styles.addImageText}>ADD IMAGE</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Header overlay with Publish button */}
      <View style={styles.headerOverlay}>
        <View style={styles.headerLeft} />
        <Pressable
          onPress={handleSave}
          disabled={!content.trim() || saving}
          style={[styles.publishWrap, (!content.trim() || saving) && styles.publishDisabled]}
        >
          <LinearGradient
            colors={[BOOKS_CTA_GRADIENT.from, BOOKS_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.publishGradient}
          >
            <Text style={styles.publishText}>{saving ? 'Saving...' : 'Publish'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.base,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  // Header overlay
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  headerLeft: {
    flex: 1,
  },
  publishWrap: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  publishDisabled: {
    opacity: 0.5,
  },
  publishGradient: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  publishText: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 14,
    color: '#1a1008',
  },
  // Date
  dateDisplay: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: ACCENT,
    marginBottom: 8,
  },
  // Title
  titleInput: {
    ...BOOKS_TYPOGRAPHY.displayLg,
    color: '#E4E1E9',
    padding: 0,
    marginBottom: 24,
  },
  // Sections
  sectionLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    marginBottom: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  browseLink: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 14,
    color: ACCENT,
  },
  // Mood
  moodRow: {
    gap: 8,
    marginBottom: 24,
  },
  // Book picker
  bookRow: {
    gap: 12,
    marginBottom: 24,
  },
  bookPickerItem: {
    width: 100,
    gap: 4,
  },
  bookCoverWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  bookCoverSelected: {
    borderWidth: 2,
    borderColor: ACCENT,
    borderRadius: 10,
  },
  bookCover: {
    width: 96,
    height: 140,
    borderRadius: 8,
  },
  bookCoverPlaceholder: {
    backgroundColor: BOOKS_SURFACES.focus,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookEmoji: {
    fontSize: 28,
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontSize: 13,
    color: '#1a1008',
    fontWeight: '700',
  },
  bookPickerTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 12,
    color: '#E4E1E9',
  },
  bookPickerAuthor: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 11,
    color: '#D6C3B5',
  },
  // Editor
  editorCard: {
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  contentInput: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#E4E1E9',
    lineHeight: 26,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
  toolbarButton: {
    padding: 4,
  },
  // Encryption
  encryptionCard: {
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  encryptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  encryptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lockIcon: {
    fontSize: 22,
  },
  encryptTitle: {
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 15,
    color: '#E4E1E9',
  },
  encryptSubtitle: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 9,
  },
  passphraseLabel: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 10,
  },
  passphraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BOOKS_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  passphraseInput: {
    flex: 1,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 16,
    color: '#E4E1E9',
    paddingVertical: 12,
  },
  biometricHint: {
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 12,
    color: ACCENT,
    fontStyle: 'italic',
  },
  // Attachments
  attachmentRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  attachmentThumb: {
    width: 100,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  attachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 80,
    borderRadius: 12,
    backgroundColor: BOOKS_SURFACES.lift,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  addImageText: {
    ...BOOKS_TYPOGRAPHY.labelUpper,
    color: '#D6C3B5',
    fontSize: 9,
  },
});
