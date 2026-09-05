/**
 * Navigation design tokens for the unified module navigation system.
 *
 * All navigation components (ModuleHeader, ModuleTabBar, ModuleLayoutWrapper)
 * consume these values so that a single change propagates across all 30 modules.
 */
export const navigation = {
  /** Fixed header height excluding safe area inset */
  headerHeight: 56,
  /** Fixed tab bar height excluding safe area inset */
  tabBarHeight: 80,
  /** Bottom padding inside tab bar for home indicator clearance */
  tabBarBottomPadding: 28,
  /** Top padding inside tab bar above icons */
  tabBarTopPadding: 12,
  /** BlurView intensity for tab bar glass effect */
  tabBarBlurIntensity: 80,
  /** Top corner radius for tab bar */
  tabBarBorderRadius: 32,
  /** Inactive tab icon/label tint */
  inactiveTint: 'rgba(228, 225, 233, 0.4)',
  /** Tab label font size */
  tabLabelFontSize: 10,
  /** Tab icon size */
  tabIconSize: 22,
  /** Horizontal content padding for module screens */
  contentPaddingHorizontal: 16,
  /** Tab bar horizontal inset from screen edges */
  tabBarHorizontalInset: 0,
  /** Header horizontal padding */
  headerPaddingHorizontal: 16,
  /** Web header height */
  webHeaderHeight: 64,
  /** Web content max width */
  webContentMaxWidth: 1200,
  /** Web content horizontal padding */
  webContentPaddingHorizontal: 24,
} as const;

export type NavigationTokens = typeof navigation;
