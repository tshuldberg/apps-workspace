// Plan 38 Phase 1c (Design decision 2 / amendment D.2): the per-community theme
// boundary. It wraps EXACTLY the community route subtrees (community/[communityId]*,
// channel/[communityId]/*, post/[communityId]/*) and re-provides the SAME
// AppThemeContext with the community's resolved colors, so every screen under it
// keeps reading through useAppThemeColors()/useMkStyles() with no per-screen
// change. The tab bar, Feed, Messages, DM threads, Me, and every non-community
// screen are NOT wrapped, so they keep the base theme (the leakage test locks
// this). The choke point is the pure resolveActiveTheme; the honest source line
// ('Community theme' / 'Your theme' / 'High contrast') comes only from its tag.

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { HIGH_CONTRAST, mergeThemeExtras, resolveThemeStyle, type MkThemeStyleExtras } from '@mylife/meerkat-theme';
import { AppThemeContext } from './AppThemeProvider';
import { useMeerkatDatabase } from './DatabaseProvider';
import {
  getCommunityIdentity,
  getCommunityThemeMode,
  setCommunityThemeMode,
  type CommunityThemeMode,
} from '../data/community-core';
import { resolveActiveTheme, type ActiveThemeSource } from '../data/community-theme-core';

interface CommunityThemeContextValue {
  /** Which rule produced the active theme (drives the honest source line). */
  source: ActiveThemeSource;
  /** The member's device-local choice for this community. */
  memberMode: CommunityThemeMode;
  /** Flip the member choice (community <-> mine) and re-resolve. */
  setMemberMode: (mode: CommunityThemeMode) => void;
  /** The community actually set a theme or accent (so the toggle is meaningful). */
  hasCommunityTheme: boolean;
  /** The user's high-contrast override is on (it always wins). */
  highContrast: boolean;
}

const CommunityThemeContext = createContext<CommunityThemeContextValue | null>(null);

/**
 * The community theme controls for the community screen (source line + toggle).
 * Returns null outside a CommunityThemeProvider, so a non-community screen never
 * sees community theme state.
 */
export function useCommunityTheme(): CommunityThemeContextValue | null {
  return useContext(CommunityThemeContext);
}

export function CommunityThemeProvider({
  communityId,
  channelExtras,
  children,
}: {
  communityId: string;
  /**
   * Feature 3: per-channel style override from the OWNER-SIGNED topper policy
   * (closed enums; never descriptor fields). Merged per axis over the
   * community theme's extras; high contrast still wins the color resolution.
   */
  channelExtras?: MkThemeStyleExtras | null;
  children: React.ReactNode;
}) {
  const db = useMeerkatDatabase();
  const parent = useContext(AppThemeContext);
  // Bumped on the member toggle and on focus so an owner's just-saved identity (or
  // a synced update) re-resolves the moment the screen is shown.
  const [tick, setTick] = useState(0);

  useFocusEffect(useCallback(() => { setTick((t) => t + 1); }, []));

  // High contrast is the user's active accessibility preset; it always wins.
  const highContrast = parent.activeId === HIGH_CONTRAST.id;

  const identity = useMemo(
    () => {
      void tick;
      return communityId ? getCommunityIdentity(db, communityId) : null;
    },
    [db, communityId, tick],
  );
  const memberMode = useMemo<CommunityThemeMode>(
    () => {
      void tick;
      return communityId ? getCommunityThemeMode(db, communityId) : 'community';
    },
    [db, communityId, tick],
  );

  const resolved = useMemo(
    () =>
      resolveActiveTheme({
        communityThemeBlob: identity?.themeBlob ?? null,
        communityAccent: identity?.accentColor ?? null,
        memberMode,
        highContrastEnabled: highContrast,
        mode: parent.mode,
        baseTheme: parent.colors,
      }),
    [identity, memberMode, highContrast, parent.mode, parent.colors],
  );

  // Plan 56 feature 1: the community theme's extended style axes resolve to
  // concrete values here (host-owned mapping) and ride the SAME context, so
  // the chat kit picks them up through its existing theme seam.
  const mergedExtras = useMemo(
    () => mergeThemeExtras(resolved.styleExtras, channelExtras ?? undefined),
    [resolved.styleExtras, channelExtras],
  );
  const communityStyle = useMemo(
    () => (mergedExtras ? resolveThemeStyle(mergedExtras) : undefined),
    [mergedExtras],
  );

  const themeValue = useMemo(
    () => ({ ...parent, colors: resolved.theme, communityStyle, communityStyleExtras: mergedExtras }),
    [parent, resolved.theme, communityStyle, mergedExtras],
  );

  const setMemberMode = useCallback(
    (mode: CommunityThemeMode) => {
      setCommunityThemeMode(db, communityId, mode);
      setTick((t) => t + 1);
    },
    [db, communityId],
  );

  const communityValue = useMemo<CommunityThemeContextValue>(
    () => ({
      source: resolved.source,
      memberMode,
      setMemberMode,
      hasCommunityTheme: Boolean(identity?.themeBlob || identity?.accentColor),
      highContrast,
    }),
    [resolved.source, memberMode, setMemberMode, identity, highContrast],
  );

  return (
    <AppThemeContext.Provider value={themeValue}>
      <CommunityThemeContext.Provider value={communityValue}>
        {children}
      </CommunityThemeContext.Provider>
    </AppThemeContext.Provider>
  );
}
