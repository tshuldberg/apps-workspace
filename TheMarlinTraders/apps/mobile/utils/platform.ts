import { Platform, Dimensions, StatusBar, StyleSheet } from 'react-native'
import type { ViewStyle, TextStyle } from 'react-native'

/**
 * Platform detection and cross-platform style utilities.
 */

export function isAndroid(): boolean {
  return Platform.OS === 'android'
}

export function isIOS(): boolean {
  return Platform.OS === 'ios'
}

/**
 * Returns the iOS style on iOS, or the Android style on Android.
 */
export function getPlatformStyles<T extends ViewStyle | TextStyle>(
  iosStyle: T,
  androidStyle: T,
): T {
  return Platform.OS === 'android' ? androidStyle : iosStyle
}

/**
 * Returns platform-specific keyboard behavior.
 * Android: 'height' adjusts layout by resizing the view.
 * iOS: 'padding' adds padding at the bottom.
 */
export function getKeyboardBehavior(): 'height' | 'padding' | 'position' {
  return Platform.OS === 'android' ? 'height' : 'padding'
}

/**
 * Returns the keyboard vertical offset for KeyboardAvoidingView.
 * On Android, the status bar height is typically needed.
 * On iOS, the header height (usually ~88) is needed.
 */
export function getKeyboardVerticalOffset(): number {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 0
  }
  return 88
}

/**
 * Returns whether the device has a display cutout (notch/punch hole).
 * On Android API 28+, devices may have cutouts.
 * On iOS, devices with a notch (iPhone X+) have safe area insets > 20.
 */
export function hasDisplayCutout(): boolean {
  if (Platform.OS === 'android') {
    // Android devices with API 28+ may have cutouts.
    // SafeAreaView from react-native-safe-area-context handles this.
    return Platform.Version >= 28
  }
  // iOS: devices with a notch have taller status bars
  const { height } = Dimensions.get('window')
  return height >= 812
}

/**
 * Platform-aware shadow styles.
 * iOS uses shadowColor/shadowOffset/shadowOpacity/shadowRadius.
 * Android uses elevation.
 */
export function getPlatformShadow(
  elevation: number,
  color: string = '#000',
): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation }
  }
  // Map elevation to iOS shadow properties
  const shadowOpacity = Math.min(0.3, elevation * 0.04)
  const shadowRadius = elevation * 0.8
  const shadowOffset = { width: 0, height: Math.ceil(elevation * 0.5) }
  return {
    shadowColor: color,
    shadowOffset,
    shadowOpacity,
    shadowRadius,
  }
}

/**
 * Returns the default font family for the platform.
 * Android: Roboto, iOS: System (SF Pro)
 */
export function getDefaultFontFamily(): string | undefined {
  // React Native uses the system font by default (SF Pro on iOS, Roboto on Android).
  // Returning undefined lets the system default apply.
  // Explicit values here for cases where you need to reference the name.
  if (Platform.OS === 'android') {
    return 'Roboto'
  }
  return undefined // iOS uses system font by default
}

/**
 * Returns platform-specific status bar height.
 */
export function getStatusBarHeight(): number {
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 24
  }
  return hasDisplayCutout() ? 47 : 20
}

/**
 * Returns Android navigation bar height estimate (the system bar at the bottom).
 * This is approximate; the actual value depends on device and navigation mode.
 * On iOS, returns 0 (home indicator is handled by safe area).
 */
export function getNavigationBarHeight(): number {
  if (Platform.OS === 'android') {
    const { height: screenHeight } = Dimensions.get('screen')
    const { height: windowHeight } = Dimensions.get('window')
    return Math.max(0, screenHeight - windowHeight - (StatusBar.currentHeight ?? 0))
  }
  return 0
}

/**
 * Creates a StyleSheet with the correct tab bar height for each platform.
 * Android typically needs less bottom padding (no home indicator).
 */
export function getTabBarHeight(): number {
  if (Platform.OS === 'android') {
    return 60
  }
  return 85 // iOS includes home indicator padding
}

/**
 * Returns the correct bottom padding for a tab bar.
 * iOS needs extra padding for the home indicator.
 */
export function getTabBarBottomPadding(): number {
  if (Platform.OS === 'android') {
    return 8
  }
  return 28
}
