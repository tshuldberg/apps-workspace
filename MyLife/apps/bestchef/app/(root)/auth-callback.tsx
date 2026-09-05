import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function AuthCallbackRoute() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)');
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color="#22C55E" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131318',
  },
});
