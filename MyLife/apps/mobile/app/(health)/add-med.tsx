import { View, StyleSheet } from 'react-native';
import { Text, colors } from '@mylife/ui';

export default function AddMedScreen() {
  return (
    <View style={styles.container}>
      <Text variant="heading">Add Medication</Text>
      <Text variant="caption" color={colors.textSecondary}>
        Coming soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
