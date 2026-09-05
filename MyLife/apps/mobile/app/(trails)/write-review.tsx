import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  createReview,
  getTrail,
  getTrailPhotos,
  getTrails,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  TR_ACCENT,
  TR_ACCENT_LIGHT,
  TR_FONTS,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  type TrailCondition,
  type TrailPhoto,
  withAlpha,
} from '@mylife/trails';
import { Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const RATINGS = [1, 2, 3, 4, 5] as const;

const CONDITION_OPTIONS: Array<{
  value: TrailCondition;
  label: string;
  icon: string;
}> = [
  { value: 'clear', label: 'Clear', icon: 'partly_cloudy_day' },
  { value: 'muddy', label: 'Muddy', icon: 'terrain' },
  { value: 'snowy', label: 'Snowy', icon: 'landscape' },
  { value: 'icy', label: 'Icy', icon: 'warning' },
  { value: 'buggy', label: 'Buggy', icon: 'flag' },
  { value: 'crowded', label: 'Crowded', icon: 'group' },
  { value: 'overgrown', label: 'Overgrown', icon: 'route' },
  { value: 'well_maintained', label: 'Well Maintained', icon: 'check_box' },
];

export default function WriteReviewScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { trailId } = useLocalSearchParams<{ trailId?: string }>();
  const [selectedTrailId, setSelectedTrailId] = useState(trailId ?? '');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [conditions, setConditions] = useState<TrailCondition[]>([]);
  const [selectedPhotoUris, setSelectedPhotoUris] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (trailId) {
      setSelectedTrailId(trailId);
    }
  }, [trailId]);

  const trails = useMemo(() => getTrails(db, { limit: 100 }), [db]);

  useEffect(() => {
    if (!selectedTrailId && trails.length > 0) {
      setSelectedTrailId(trails[0].id);
    }
  }, [selectedTrailId, trails]);

  const trail = useMemo(() => {
    if (!selectedTrailId) {
      return null;
    }
    return getTrail(db, selectedTrailId);
  }, [db, selectedTrailId]);

  const trailPhotos = useMemo(() => {
    if (!selectedTrailId) {
      return [] as TrailPhoto[];
    }
    return getTrailPhotos(db, selectedTrailId, 10);
  }, [db, selectedTrailId]);

  const ratingCopy = useMemo(() => {
    switch (rating) {
      case 5:
        return 'Worth the trip';
      case 4:
        return 'Strong trail day';
      case 3:
        return 'Solid with caveats';
      case 2:
        return 'Needs some caution';
      case 1:
        return 'Would not recommend';
      default:
        return 'Tap to rate your hike';
    }
  }, [rating]);

  const handleToggleCondition = (value: TrailCondition) => {
    setConditions((current) => (
      current.includes(value)
        ? current.filter((condition) => condition !== value)
        : [...current, value]
    ));
  };

  const handleTogglePhoto = (uri: string) => {
    setSelectedPhotoUris((current) => (
      current.includes(uri)
        ? current.filter((entry) => entry !== uri)
        : [...current, uri].slice(0, 3)
    ));
  };

  const handleSubmit = async () => {
    if (!selectedTrailId) {
      Alert.alert('Pick a trail', 'Choose the trail you are reviewing first.');
      return;
    }

    if (rating === 0) {
      Alert.alert('Add a rating', 'Choose at least one star before posting.');
      return;
    }

    setSubmitting(true);
    try {
      createReview(db, uuid(), {
        trailId: selectedTrailId,
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
        photoUris: selectedPhotoUris.length > 0 ? JSON.stringify(selectedPhotoUris) : null,
        conditions: conditions.length > 0 ? JSON.stringify(conditions) : null,
        visitedAt: new Date().toISOString(),
      });

      router.replace({
        pathname: '/(trails)/reviews',
        params: { trailId: selectedTrailId },
      });
    } catch {
      Alert.alert('Post failed', 'The review could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: trail ? `Review ${trail.name}` : 'Write Review' }} />

      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Review</Text>
            <Text style={styles.heroTitle}>Share Trail Conditions</Text>
            <Text style={styles.heroSubtitle}>
              Rate the route, note surface conditions, and attach up to three trail photos.
            </Text>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={submitting || rating === 0 || !selectedTrailId}
            style={[
              styles.postButton,
              submitting || rating === 0 || !selectedTrailId ? styles.postButtonDisabled : null,
            ]}
          >
            <Text style={styles.postButtonLabel}>
              {submitting ? 'Posting...' : 'Post'}
            </Text>
          </Pressable>
        </View>

        {trail ? (
          <View style={styles.selectedTrailCard}>
            <MaterialSymbol name="place" size={18} color={TR_ACCENT_LIGHT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedTrailName}>{trail.name}</Text>
              <Text style={styles.selectedTrailRegion}>{trail.region ?? 'Offline local trail'}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyInlineCopy}>
            Pick the trail you want to review before posting.
          </Text>
        )}
      </GlassCard>

      {trails.length > 1 ? (
        <View style={styles.selectorSection}>
          <SectionHeader title="Trail" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorRail}>
            {trails.map((entry) => {
              const active = entry.id === selectedTrailId;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setSelectedTrailId(entry.id)}
                  style={[
                    styles.selectorChip,
                    active ? styles.selectorChipActive : null,
                  ]}
                >
                  <Text style={[styles.selectorLabel, active ? styles.selectorLabelActive : null]}>
                    {entry.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <GlassCard style={styles.card}>
        <SectionHeader title="Rating" />
        <View style={styles.ratingRail}>
          {RATINGS.map((value) => (
            <Pressable
              key={`rating-${value}`}
              onPress={() => setRating(value)}
              style={styles.ratingButton}
            >
              <MaterialSymbol
                name="star"
                size={34}
                color={value <= rating ? TR_ACCENT_LIGHT : 'rgba(228,225,233,0.24)'}
                filled={value <= rating}
              />
            </Pressable>
          ))}
        </View>
        <Text style={styles.ratingCopy}>{ratingCopy}</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Trail Conditions" />
        <View style={styles.conditionGrid}>
          {CONDITION_OPTIONS.map((option) => {
            const active = conditions.includes(option.value);

            return (
              <Pressable
                key={option.value}
                onPress={() => handleToggleCondition(option.value)}
                style={[styles.conditionChip, active ? styles.conditionChipActive : null]}
              >
                <MaterialSymbol
                  name={option.icon}
                  size={14}
                  color={active ? '#102108' : TR_ACCENT_LIGHT}
                />
                <Text style={[styles.conditionLabel, active ? styles.conditionLabelActive : null]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Headline" />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Summarize your trail day"
          placeholderTextColor={TR_TEXT_TERTIARY}
          maxLength={100}
          style={styles.input}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Review" />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What was the route like, and what should the next hiker know?"
          placeholderTextColor={TR_TEXT_TERTIARY}
          multiline
          maxLength={2000}
          style={styles.multilineInput}
        />
        <Text style={styles.counter}>{body.length}/2000</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader title="Attach Trail Photos" />
        {trailPhotos.length > 0 ? (
          <>
            <Text style={styles.helperCopy}>
              Pick up to three photos from trail memories already saved on this device.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRail}>
              {trailPhotos.map((photo) => {
                const selected = selectedPhotoUris.includes(photo.uri);

                return (
                  <Pressable
                    key={photo.id}
                    onPress={() => handleTogglePhoto(photo.uri)}
                    style={styles.photoTile}
                  >
                    <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.photoImage} />
                    <View style={[styles.photoOverlay, selected ? styles.photoOverlaySelected : null]}>
                      <MaterialSymbol
                        name={selected ? 'check_box' : 'check_box_outline_blank'}
                        size={18}
                        color={selected ? '#102108' : TR_TEXT}
                        filled={selected}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <View style={styles.emptyPhotoCard}>
            <MaterialSymbol name="photo_camera" size={22} color={TR_ACCENT_LIGHT} />
            <Text style={styles.emptyPhotoTitle}>No trail photos yet</Text>
            <Text style={styles.emptyPhotoCopy}>
              Record a hike and capture trail photos first. They will appear here for review attachments.
            </Text>
          </View>
        )}
      </GlassCard>

      <Pressable
        onPress={handleSubmit}
        disabled={submitting || rating === 0 || !selectedTrailId}
        style={[
          styles.submitButton,
          submitting || rating === 0 || !selectedTrailId ? styles.submitButtonDisabled : null,
        ]}
      >
        <Text style={styles.submitLabel}>
          {submitting ? 'Posting Review...' : 'Post Review'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.lowest,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  heroCard: {
    gap: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  heroTitle: {
    ...TR_TYPOGRAPHY.displayLg,
    fontSize: 28,
    lineHeight: 30,
    color: TR_TEXT,
  },
  heroSubtitle: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  postButton: {
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postButtonDisabled: {
    opacity: 0.45,
  },
  postButtonLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: '#102108',
    fontFamily: TR_FONTS.bold,
  },
  selectedTrailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedTrailName: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  selectedTrailRegion: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  emptyInlineCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  selectorSection: {
    gap: 10,
  },
  selectorRail: {
    gap: 10,
    paddingRight: 4,
  },
  selectorChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectorChipActive: {
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.92),
  },
  selectorLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    fontFamily: TR_FONTS.semiBold,
  },
  selectorLabelActive: {
    color: '#102108',
  },
  card: {
    gap: 12,
  },
  ratingRail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  ratingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  ratingCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  conditionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  conditionChipActive: {
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.92),
  },
  conditionLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
    fontFamily: TR_FONTS.semiBold,
  },
  conditionLabelActive: {
    color: '#102108',
  },
  input: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: TR_TEXT,
    fontFamily: TR_FONTS.regular,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  multilineInput: {
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    color: TR_TEXT,
    fontFamily: TR_FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  counter: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
    textAlign: 'right',
  },
  helperCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
  },
  photoRail: {
    gap: 10,
    paddingRight: 4,
  },
  photoTile: {
    width: 110,
    height: 110,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,14,19,0.56)',
  },
  photoOverlaySelected: {
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.92),
  },
  emptyPhotoCard: {
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingVertical: 22,
    paddingHorizontal: 18,
  },
  emptyPhotoTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  emptyPhotoCopy: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    textAlign: 'center',
  },
  submitButton: {
    borderRadius: 22,
    backgroundColor: TR_ACCENT,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitLabel: {
    ...TR_TYPOGRAPHY.titleMd,
    color: '#F4FFE8',
    fontFamily: TR_FONTS.bold,
  },
});
