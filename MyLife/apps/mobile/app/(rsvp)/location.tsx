import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  getEvents,
  getEventCoordinates,
  buildAppleMapsUrl,
  buildGoogleMapsUrl,
  buildDirectionsUrl,
  isVirtualLocation,
} from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;

export default function LocationScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();

  const events = useMemo(() => getEvents(db), [db]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;
  const event = events.find((e) => e.id === eventId) ?? null;

  const coordinates = useMemo(
    () => (eventId ? getEventCoordinates(db, eventId) : null),
    [db, eventId],
  );

  const isVirtual = event?.locationName ? isVirtualLocation(event.locationName) : false;

  const handleOpenAppleMaps = () => {
    if (!coordinates) return;
    const url = buildAppleMapsUrl(coordinates.lat, coordinates.lng);
    Linking.openURL(url);
  };

  const handleOpenGoogleMaps = () => {
    if (!coordinates) return;
    const url = buildGoogleMapsUrl(coordinates.lat, coordinates.lng);
    Linking.openURL(url);
  };

  const handleGetDirections = () => {
    if (!coordinates) return;
    const url = buildDirectionsUrl('ios', coordinates.lat, coordinates.lng, event?.locationAddress ?? null);
    if (url) Linking.openURL(url);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!event ? (
        <EmptyState
          icon={'\uD83D\uDCCD'}
          title="No event selected"
          message="Select an event to view location details."
        />
      ) : (
        <>
          {/* Venue details */}
          <Card>
            <Text variant="subheading">Venue</Text>
            <View style={styles.detailList}>
              {event.locationName && (
                <View style={styles.detailRow}>
                  <Text variant="caption" color={colors.textSecondary}>Name</Text>
                  <Text variant="body">{event.locationName}</Text>
                </View>
              )}
              {event.locationAddress && (
                <View style={styles.detailRow}>
                  <Text variant="caption" color={colors.textSecondary}>Address</Text>
                  <Text variant="body">{event.locationAddress}</Text>
                </View>
              )}
              {isVirtual && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text variant="caption" color={colors.background}>VIRTUAL EVENT</Text>
                </View>
              )}
              {!event.locationName && !event.locationAddress && (
                <Text variant="caption" color={colors.textSecondary}>
                  No location set for this event.
                </Text>
              )}
            </View>
          </Card>

          {/* Coordinates and map links */}
          {coordinates && (
            <Card>
              <Text variant="subheading">Map</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
              </Text>
              <View style={styles.buttonRow}>
                <Pressable style={styles.mapButton} onPress={handleOpenAppleMaps}>
                  <Text variant="label" color={colors.background}>Apple Maps</Text>
                </Pressable>
                <Pressable style={styles.mapButton} onPress={handleOpenGoogleMaps}>
                  <Text variant="label" color={colors.background}>Google Maps</Text>
                </Pressable>
                <Pressable style={styles.mapButton} onPress={handleGetDirections}>
                  <Text variant="label" color={colors.background}>Directions</Text>
                </Pressable>
              </View>
            </Card>
          )}

          {/* Accessibility notes placeholder */}
          <Card>
            <Text variant="subheading">Venue Notes</Text>
            <Text variant="caption" color={colors.textSecondary}>
              Add parking info, accessibility notes, or indoor directions for your guests.
              {/* TODO: Add editable notes field when venue notes CRUD is available */}
            </Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  detailList: { gap: spacing.sm, marginTop: spacing.sm },
  detailRow: { gap: 2 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999, alignSelf: 'flex-start' },
  buttonRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  mapButton: {
    flex: 1, backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
