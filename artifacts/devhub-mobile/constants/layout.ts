import { Platform } from 'react-native';

/**
 * Classic tab bar content height (icons + labels), excluding safe-area inset.
 * Web uses a fixed taller bar (see app/(tabs)/_layout.tsx).
 */
const TAB_BAR_CONTENT_HEIGHT = Platform.OS === 'web' ? 84 : 49;

/**
 * Offsets so list content and FABs sit above the absolute-positioned tab bar.
 */
export function getTabBarLayout(insetsBottom: number) {
  // Web tab bar already includes its full height; native adds home-indicator inset.
  const tabBarTotal =
    Platform.OS === 'web' ? TAB_BAR_CONTENT_HEIGHT : TAB_BAR_CONTENT_HEIGHT + insetsBottom;

  return {
    /** Bottom offset for FABs so they clear the tab bar. */
    fabBottom: tabBarTotal + 16,
    /** Extra scroll padding so last list items clear FAB + tab bar. */
    listPaddingBottom: tabBarTotal + 88,
    /** Bottom padding for non-FAB scroll screens (e.g. dashboard). */
    contentPaddingBottom: tabBarTotal + 24,
  };
}

/** Header top padding: Replit/web chrome vs device status bar. */
export function getHeaderTopPadding(insetsTop: number) {
  return Platform.OS === 'web' ? 67 : insetsTop;
}
