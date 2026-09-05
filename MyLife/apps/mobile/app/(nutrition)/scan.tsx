import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import {
  FoodRow,
  MaterialSymbol,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  getFoodByBarcode,
  getRecentBarcodeScans,
  handleBarcodeScan,
  type Food,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  formatFoodServing,
  logFoodToMeal,
  parseFoodImage,
  resolveMealType,
  resolveSourceMeta,
} from './phase2-data';

const SCAN_FRAME_WIDTH = 250;
const SCAN_FRAME_HEIGHT = 150;

type ScanSelection = {
  food: Food | null;
  barcode: string;
  source: Food['source'] | 'cache';
  imageUri: string | null;
};

export default function ScanScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ meal?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [manualVisible, setManualVisible] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [selectedMeal] = useState(resolveMealType(params.meal));
  const [selection, setSelection] = useState<ScanSelection | null>(null);
  const [portionVisible, setPortionVisible] = useState(false);
  const [portionCount, setPortionCount] = useState(1);
  const [refreshToken, setRefreshToken] = useState(0);
  const [scanDisabled, setScanDisabled] = useState(false);
  const scanLine = useRef(new Animated.Value(0)).current;
  const processingRef = useRef(false);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, {
          toValue: SCAN_FRAME_HEIGHT - 24,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(scanLine, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();

    return () => {
      animation.stop();
    };
  }, [scanLine]);

  const recentScans = useMemo(() => {
    try {
      return getRecentBarcodeScans(db, 10);
    } catch {
      return [];
    }
  }, [db, refreshToken]);

  async function resolveBarcode(code: string) {
    if (!code || processingRef.current) {
      return;
    }

    processingRef.current = true;
    setScanDisabled(true);

    try {
      const scanResult = await handleBarcodeScan(db, code);
      const localFood = getFoodByBarcode(db, code);
      if (!scanResult.result.found || !localFood) {
        Alert.alert(
          'No match found',
          `We could not find nutrition data for barcode ${code}.`,
          [
            {
              text: 'Manual entry',
              onPress: () => {
                setManualCode(code);
                setManualVisible(true);
              },
            },
            {
              text: 'Try again',
              onPress: resetScanner,
            },
          ],
        );
        return;
      }

      setSelection({
        food: localFood,
        barcode: code,
        source:
          scanResult.result.source === 'cache'
            ? 'cache'
            : localFood.source,
        imageUri: parseFoodImage(scanResult.result.food?.rawJson),
      });
      setRefreshToken((current) => current + 1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not look up that barcode.';
      Alert.alert('Scan failed', message, [{ text: 'Try again', onPress: resetScanner }]);
    } finally {
      processingRef.current = false;
    }
  }

  function resetScanner() {
    setSelection(null);
    setScanDisabled(false);
    setPortionVisible(false);
    setPortionCount(1);
  }

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanDisabled || !result.data) {
      return;
    }
    void resolveBarcode(result.data);
  };

  function openPortionSheet(food: Food) {
    setSelection((current) =>
      current
        ? {
            ...current,
            food,
          }
        : current,
    );
    setPortionCount(1);
    setPortionVisible(true);
  }

  function addSelectionToDiary() {
    if (!selection?.food) {
      return;
    }

    try {
      logFoodToMeal(db, selection.food, selectedMeal, {
        servingCount: portionCount,
      });
      setPortionVisible(false);
      Alert.alert('Added', `${selection.food.name} added to ${selectedMeal}.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not add this scan.';
      Alert.alert('Add failed', message);
    }
  }

  if (!permission) {
    return (
      <View style={styles.permissionScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.permissionTitle}>Loading camera</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIcon}>
            <MaterialSymbol
              name="qr_code_scanner"
              size={28}
              color={NU_ACCENT_LIGHT}
            />
          </View>
          <Text style={styles.permissionTitle}>Scan Barcode</Text>
          <Text style={styles.permissionBody}>
            Camera access lets MyNutrition scan packaging and pull nutrition
            details into your diary.
          </Text>
          <LinearGradient
            colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.permissionButtonWrap}
          >
            <Pressable
              style={styles.permissionButton}
              onPress={() => requestPermission()}
            >
              <Text style={styles.permissionButtonText}>Enable camera</Text>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    );
  }

  const sourceMeta = selection
    ? resolveSourceMeta(selection.source)
    : resolveSourceMeta('cache');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'],
        }}
        enableTorch={flashOn}
        onBarcodeScanned={scanDisabled ? undefined : onBarcodeScanned}
      />

      <View style={styles.topOverlay}>
        <View style={styles.headerBar}>
          <Pressable style={styles.headerButton} onPress={() => router.back()}>
            <MaterialSymbol name="close" size={20} color={NU_TEXT} />
          </Pressable>
          <Text style={styles.headerTitle}>Scan Barcode</Text>
          <Pressable
            style={styles.headerButton}
            onPress={() => setFlashOn((current) => !current)}
          >
            <MaterialSymbol
              name={flashOn ? 'flash_on' : 'flash_off'}
              size={18}
              color={flashOn ? NU_ACCENT_LIGHT : NU_TEXT}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.centerOverlay}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ translateY: scanLine }],
              },
            ]}
          />
        </View>
        <Text style={styles.scanHint}>
          Align the barcode inside the frame
        </Text>
      </View>

      <View style={styles.drawer}>
        <View style={styles.drawerHandle} />
        {selection?.food ? (
          <View style={styles.drawerContent}>
            <Text style={styles.drawerTitle}>Scan result</Text>
            <View style={styles.resultCard}>
              {selection.imageUri ? (
                <Image source={{ uri: selection.imageUri }} style={styles.resultImage} />
              ) : (
                <View style={styles.resultImageFallback}>
                  <MaterialSymbol
                    name={sourceMeta.icon}
                    size={26}
                    color={sourceMeta.color}
                  />
                </View>
              )}
              <View style={styles.resultCopy}>
                <View
                  style={[
                    styles.sourceBadge,
                    { backgroundColor: `${sourceMeta.color}1A` },
                  ]}
                >
                  <MaterialSymbol
                    name={sourceMeta.icon}
                    size={12}
                    color={sourceMeta.color}
                  />
                  <Text
                    style={[styles.sourceBadgeText, { color: sourceMeta.color }]}
                  >
                    {sourceMeta.label}
                  </Text>
                </View>
                <Text style={styles.resultName}>{selection.food.name}</Text>
                {selection.food.brand ? (
                  <Text style={styles.resultBrand}>{selection.food.brand}</Text>
                ) : null}
                <Text style={styles.resultNutrition}>
                  {Math.round(selection.food.calories)} kcal • P{' '}
                  {Math.round(selection.food.proteinG)}g • C{' '}
                  {Math.round(selection.food.carbsG)}g • F{' '}
                  {Math.round(selection.food.fatG)}g
                </Text>
              </View>
            </View>
            <LinearGradient
              colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonWrap}
            >
              <Pressable
                style={styles.primaryButton}
                onPress={() => openPortionSheet(selection.food!)}
              >
                <Text style={styles.primaryButtonText}>Add to Diary</Text>
              </Pressable>
            </LinearGradient>
            <Pressable style={styles.secondaryLink} onPress={resetScanner}>
              <Text style={styles.secondaryLinkText}>Scan another</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.drawerContent}>
            <Text style={styles.drawerTitle}>Recent scans</Text>
            <ScrollView
              style={styles.drawerScroll}
              contentContainerStyle={styles.drawerList}
              showsVerticalScrollIndicator={false}
            >
              {recentScans.length === 0 ? (
                <Text style={styles.emptyLabel}>
                  Your last 10 barcode matches will appear here.
                </Text>
              ) : (
                recentScans.map((scan) => {
                  const scanFood = scan.food;
                  if (!scanFood) {
                    return null;
                  }

                  return (
                    <FoodRow
                      key={scan.barcode}
                      foodName={scanFood.name}
                      calories={scanFood.calories}
                      servingSize={formatFoodServing(scanFood)}
                      source={scanFood.source}
                      leadingImage={parseFoodImage(scan.rawJson) ?? undefined}
                      macros={{
                        p: Math.round(scanFood.proteinG),
                        c: Math.round(scanFood.carbsG),
                        f: Math.round(scanFood.fatG),
                      }}
                      onPress={() =>
                        setSelection({
                          food: scanFood,
                          barcode: scan.barcode,
                          source: scanFood.source,
                          imageUri: parseFoodImage(scan.rawJson),
                        })
                      }
                      onAdd={() =>
                        setSelection({
                          food: scanFood,
                          barcode: scan.barcode,
                          source: scanFood.source,
                          imageUri: parseFoodImage(scan.rawJson),
                        })
                      }
                    />
                  );
                })
              )}
            </ScrollView>
            <Pressable
              style={styles.manualEntryButton}
              onPress={() => setManualVisible(true)}
            >
              <MaterialSymbol name="edit" size={15} color={NU_ACCENT_LIGHT} />
              <Text style={styles.manualEntryText}>Manual Entry</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        visible={manualVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setManualVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Look up a barcode</Text>
            <Text style={styles.sheetBody}>
              Enter the code manually if the camera cannot pick it up.
            </Text>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="0123456789012"
              placeholderTextColor={NU_TEXT_TERTIARY}
              keyboardType="number-pad"
              style={styles.sheetInput}
            />
            <LinearGradient
              colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonWrap}
            >
              <Pressable
                style={styles.primaryButton}
                onPress={() => {
                  setManualVisible(false);
                  void resolveBarcode(manualCode.trim());
                }}
              >
                <Text style={styles.primaryButtonText}>Look up</Text>
              </Pressable>
            </LinearGradient>
            <Pressable
              style={styles.secondaryLink}
              onPress={() => {
                setManualVisible(false);
                router.push(
                  `/(nutrition)/log?custom=true&meal=${selectedMeal}` as never,
                );
              }}
            >
              <Text style={styles.secondaryLinkText}>Add as custom food</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={portionVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPortionVisible(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setPortionVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Portion picker</Text>
            <Text style={styles.sheetBody}>
              Adjust the serving before adding to {selectedMeal}.
            </Text>
            <View style={styles.portionRow}>
              <StepperButton
                label="-"
                onPress={() => setPortionCount((value) => Math.max(0.25, value - 0.25))}
              />
              <View style={styles.portionValueCard}>
                <Text style={styles.portionValue}>{portionCount.toFixed(2)}x</Text>
                <Text style={styles.portionValueHint}>
                  {selection?.food ? formatFoodServing(selection.food) : ''}
                </Text>
              </View>
              <StepperButton
                label="+"
                onPress={() => setPortionCount((value) => Math.min(8, value + 0.25))}
              />
            </View>
            <LinearGradient
              colors={[NU_ACCENT_LIGHT, NU_CALORIE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonWrap}
            >
              <Pressable style={styles.primaryButton} onPress={addSelectionToDiary}>
                <Text style={styles.primaryButtonText}>Add to Diary</Text>
              </Pressable>
            </LinearGradient>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function StepperButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.stepperButton} onPress={onPress}>
      <Text style={styles.stepperLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(14,14,19,0.52)',
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  centerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  scanFrame: {
    width: SCAN_FRAME_WIDTH,
    height: SCAN_FRAME_HEIGHT,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: NU_ACCENT_LIGHT,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  scanLine: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    height: 3,
    borderRadius: 999,
    backgroundColor: NU_ACCENT_LIGHT,
    shadowColor: NU_ACCENT_LIGHT,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  scanHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: '#FFFFFF',
    backgroundColor: 'rgba(14,14,19,0.42)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 270,
    maxHeight: '48%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: NU_SURFACES.base,
  },
  drawerHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    marginBottom: 12,
    backgroundColor: NU_TEXT_TERTIARY,
    opacity: 0.5,
  },
  drawerContent: {
    flex: 1,
    gap: 14,
  },
  drawerTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  drawerScroll: {
    flex: 1,
  },
  drawerList: {
    gap: 10,
    paddingBottom: 6,
  },
  emptyLabel: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  resultCard: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 22,
    padding: 14,
    backgroundColor: NU_SURFACES.low,
  },
  resultImage: {
    width: 84,
    height: 84,
    borderRadius: 18,
  },
  resultImageFallback: {
    width: 84,
    height: 84,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.14)',
  },
  resultCopy: {
    flex: 1,
    gap: 6,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sourceBadgeText: {
    ...NU_TYPOGRAPHY.labelUpper,
  },
  resultName: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_TEXT,
  },
  resultBrand: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  resultNutrition: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_TERTIARY,
  },
  primaryButtonWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  primaryButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  secondaryLink: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  secondaryLinkText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 42,
  },
  manualEntryText: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_ACCENT_LIGHT,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: NU_SURFACES.base,
    gap: 14,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 999,
    backgroundColor: NU_TEXT_TERTIARY,
    opacity: 0.5,
  },
  sheetTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    textAlign: 'center',
  },
  sheetBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  sheetInput: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: NU_TEXT,
    backgroundColor: NU_SURFACES.low,
    fontFamily: 'PlusJakartaSans_500Medium',
    fontSize: 16,
  },
  portionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  portionValueCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: NU_SURFACES.low,
  },
  portionValue: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  portionValueHint: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.low,
  },
  stepperLabel: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
  },
  permissionScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: NU_SURFACES.lowest,
  },
  permissionCard: {
    width: '100%',
    alignItems: 'center',
    gap: 14,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: NU_SURFACES.base,
  },
  permissionIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.14)',
  },
  permissionTitle: {
    ...NU_TYPOGRAPHY.headlineMd,
    color: NU_TEXT,
    textAlign: 'center',
  },
  permissionBody: {
    ...NU_TYPOGRAPHY.bodySm,
    color: NU_TEXT_SECONDARY,
    textAlign: 'center',
  },
  permissionButtonWrap: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  permissionButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    ...NU_TYPOGRAPHY.titleMd,
    color: '#4A2600',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
