import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  analyzePhotoForFoods,
  isPhotoAnalysisError,
  createFoodFromAIEstimate,
  createFoodLogEntry,
  addFoodLogItem,
  getFoodLogEntries,
  getSetting,
  type AIFoodEstimate,
  type MealType,
} from '@mylife/nutrition';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.nutrition;

type EstimateState = AIFoodEstimate & { accepted: boolean; rejected: boolean };

export default function PhotoScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimates, setEstimates] = useState<EstimateState[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('lunch');

  const pickImage = async (useCamera: boolean) => {
    let result;
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera access is needed for photo logging.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const uri = result.assets[0].uri;
    setImageUri(uri);
    setEstimates([]);
    await analyzeImage(uri);
  };

  const analyzeImage = async (uri: string) => {
    const apiKey = getSetting(db, 'claude_api_key');
    if (!apiKey) {
      Alert.alert(
        'API Key Required',
        'Set your Claude API key in Settings to use AI photo logging.',
        [
          { text: 'Cancel' },
          { text: 'Go to Settings', onPress: () => router.push('/(nutrition)/settings') },
        ],
      );
      return;
    }

    setLoading(true);
    try {
      const result = await analyzePhotoForFoods(apiKey, uri);
      if (isPhotoAnalysisError(result)) {
        Alert.alert('Analysis Failed', result.message);
        return;
      }
      setEstimates(
        result.foods.map((f) => ({ ...f, accepted: false, rejected: false })),
      );
    } catch {
      Alert.alert('Error', 'Failed to analyze photo. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAccept = (index: number) => {
    setEstimates((prev) =>
      prev.map((e, i) =>
        i === index
          ? { ...e, accepted: !e.accepted, rejected: false }
          : e,
      ),
    );
  };

  const toggleReject = (index: number) => {
    setEstimates((prev) =>
      prev.map((e, i) =>
        i === index
          ? { ...e, rejected: !e.rejected, accepted: false }
          : e,
      ),
    );
  };

  const handleAddAll = useCallback(() => {
    const accepted = estimates.filter((e) => e.accepted);
    if (accepted.length === 0) {
      Alert.alert('No Items', 'Accept at least one item to add to your log.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const entries = getFoodLogEntries(db, today);
    let logEntry = entries.find((e) => e.mealType === selectedMeal);

    if (!logEntry) {
      const logId = uuid();
      createFoodLogEntry(db, logId, { date: today, mealType: selectedMeal });
      logEntry = { id: logId, date: today, mealType: selectedMeal, notes: null, createdAt: new Date().toISOString() };
    }

    for (const est of accepted) {
      const food = createFoodFromAIEstimate(db, {
        name: est.name,
        servingSize: est.servingSize,
        servingUnit: est.servingUnit,
        calories: est.calories,
        proteinG: est.proteinG,
        carbsG: est.carbsG,
        fatG: est.fatG,
      });

      addFoodLogItem(db, uuid(), {
        logId: logEntry.id,
        foodId: food.id,
        servingCount: 1,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      });
    }

    Alert.alert(
      'Added',
      `${accepted.length} item${accepted.length > 1 ? 's' : ''} added to ${selectedMeal}.`,
      [{ text: 'OK', onPress: () => router.back() }],
    );
  }, [db, estimates, selectedMeal, router]);

  const confidenceColor = (c: AIFoodEstimate['confidence']) => {
    switch (c) {
      case 'high': return colors.success;
      case 'medium': return colors.warning;
      case 'low': return colors.danger;
    }
  };

  const acceptedCount = estimates.filter((e) => e.accepted).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Image picker */}
      {!imageUri && (
        <Card>
          <Text variant="subheading">AI Photo Food Log</Text>
          <Text variant="caption" color={colors.textSecondary}>
            Take a photo of your meal and AI will identify the foods and estimate nutrition.
          </Text>
          <View style={styles.pickerButtons}>
            <Pressable style={styles.primaryButton} onPress={() => pickImage(true)}>
              <Text variant="label" color={colors.background}>Take Photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => pickImage(false)}>
              <Text variant="label">Choose from Library</Text>
            </Pressable>
          </View>
        </Card>
      )}

      {/* Image preview */}
      {imageUri && (
        <View style={styles.imageContainer}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          <Pressable
            style={styles.retakeButton}
            onPress={() => {
              setImageUri(null);
              setEstimates([]);
            }}
          >
            <Text variant="caption" color={colors.text}>Retake</Text>
          </Pressable>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <Card>
          <View style={styles.loadingState}>
            <Text variant="body" color={ACCENT}>Analyzing your meal...</Text>
            <Text variant="caption" color={colors.textSecondary}>
              AI is identifying foods and estimating nutrition values.
            </Text>
          </View>
        </Card>
      )}

      {/* Estimates */}
      {estimates.length > 0 && (
        <>
          <Text variant="subheading" style={styles.sectionTitle}>
            Identified Foods ({estimates.length})
          </Text>
          {estimates.map((est, index) => (
            <Card
              key={index}
              style={[
                styles.estimateCard,
                est.accepted && styles.estimateAccepted,
                est.rejected && styles.estimateRejected,
              ]}
            >
              <View style={styles.estimateHeader}>
                <View style={styles.estimateInfo}>
                  <Text variant="body">{est.name}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {est.servingSize} {est.servingUnit}
                  </Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor(est.confidence) + '30' }]}>
                  <Text variant="caption" color={confidenceColor(est.confidence)}>
                    {est.confidence}
                  </Text>
                </View>
              </View>
              <View style={styles.macroChips}>
                <Text variant="caption" color={colors.textSecondary}>
                  {est.calories} cal
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  P: {est.proteinG}g
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  C: {est.carbsG}g
                </Text>
                <Text variant="caption" color={colors.textTertiary}>
                  F: {est.fatG}g
                </Text>
              </View>
              <View style={styles.estimateActions}>
                <Pressable
                  style={[styles.actionButton, est.accepted && styles.acceptedButton]}
                  onPress={() => toggleAccept(index)}
                >
                  <Text
                    variant="caption"
                    color={est.accepted ? colors.success : colors.textSecondary}
                  >
                    {est.accepted ? 'Accepted' : 'Accept'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.actionButton, est.rejected && styles.rejectedButton]}
                  onPress={() => toggleReject(index)}
                >
                  <Text
                    variant="caption"
                    color={est.rejected ? colors.danger : colors.textSecondary}
                  >
                    {est.rejected ? 'Rejected' : 'Reject'}
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))}

          {/* Meal picker */}
          <Card>
            <Text variant="body">Add to Meal</Text>
            <View style={styles.mealRow}>
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((meal) => (
                <Pressable
                  key={meal}
                  style={[
                    styles.mealButton,
                    selectedMeal === meal && styles.mealButtonActive,
                  ]}
                  onPress={() => setSelectedMeal(meal)}
                >
                  <Text
                    variant="caption"
                    color={selectedMeal === meal ? ACCENT : colors.textSecondary}
                    style={selectedMeal === meal ? { fontWeight: '600' } : undefined}
                  >
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.primaryButton, acceptedCount === 0 && styles.disabledButton]}
              onPress={handleAddAll}
            >
              <Text variant="label" color={colors.background}>
                Add {acceptedCount} Item{acceptedCount !== 1 ? 's' : ''} to Log
              </Text>
            </Pressable>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  pickerButtons: { marginTop: spacing.md, gap: spacing.sm },
  primaryButton: {
    borderRadius: 8,
    backgroundColor: ACCENT,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.5 },
  imageContainer: { borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', height: 220, borderRadius: 12 },
  retakeButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.surface + 'CC',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  loadingState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.text },
  estimateCard: { borderWidth: 1, borderColor: 'transparent' },
  estimateAccepted: { borderColor: colors.success + '40' },
  estimateRejected: { borderColor: colors.danger + '40', opacity: 0.6 },
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  estimateInfo: { flex: 1, gap: 2 },
  confidenceBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  macroChips: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  estimateActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  acceptedButton: { borderColor: colors.success, backgroundColor: colors.success + '15' },
  rejectedButton: { borderColor: colors.danger, backgroundColor: colors.danger + '15' },
  mealRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  mealButton: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  mealButtonActive: {
    borderColor: ACCENT,
    backgroundColor: ACCENT + '20',
  },
});
