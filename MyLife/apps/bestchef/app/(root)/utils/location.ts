import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

type Translate = (key: string) => string;

const defaultTranslate: Translate = (key) => key;

export async function getCurrentLocation(t: Translate = defaultTranslate): Promise<string | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert(
      t('Location Access Needed'),
      t('Enable location access in Settings to auto-detect your city.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        { text: t('Open Settings'), onPress: () => Linking.openSettings() },
      ],
    );
    return null;
  }
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Low,
  });
  const geocode = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
  if (geocode.length > 0) {
    const { city, region, country } = geocode[0];
    const parts = [city, region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : country ?? null;
  }
  return null;
}
