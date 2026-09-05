// Plan 38 Phase 1c (web, D.2): the per-community theme boundary. It wraps EXACTLY
// a community's own-screen subtree (the channel + files main content, and the
// community channel sidebar) and sets the resolved community palette as inline
// --mk-* CSS custom properties on its wrapper, so descendants that read var(--mk-*)
// pick up the community look. Nothing OUTSIDE a boundary (the rail, the Messages/DM
// surface, the Feed, Discover) ever receives these vars, so app chrome and DM
// threads keep the base theme. The theme is chosen by the ONE pure choke point
// (resolveActiveTheme): the member's high-contrast selection always wins, a member
// who opted out ('mine') gets the base theme, and a malformed blob fails safe.

import { createContext, useContext, useMemo } from 'react';
import { HIGH_CONTRAST, mergeThemeExtras, resolveThemeStyle, type MkThemeStyleExtras } from '@mylife/meerkat-theme';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useThemeLibrary } from '../theme/ThemeProvider';
import { resolveActiveTheme } from '../../lib/community-theme-core';
import { themeToCssVars } from '../theme/css-vars';
import { channelThemeExtras } from '../../lib/canvas-core';

/**
 * Features 3/4: the RAW merged style extras (community theme layered under a
 * per-channel topper override) for hosts that resolve per-role bubble shapes.
 */
const CommunityStyleExtrasContext = createContext<MkThemeStyleExtras | undefined>(undefined);
export function useCommunityStyleExtras(): MkThemeStyleExtras | undefined {
  return useContext(CommunityStyleExtrasContext);
}

export function useCommunityActiveTheme(communityId: string): ReturnType<typeof resolveActiveTheme> {
  const m = useMeerkat();
  const themeLib = useThemeLibrary();
  void m.revision; // re-resolve after an identity publish / mode toggle
  const identity = m.communityIdentity(communityId);
  const mode = m.communityThemeMode(communityId);
  const highContrastEnabled = themeLib.activeId === HIGH_CONTRAST.id;
  return useMemo(
    () =>
      resolveActiveTheme({
        communityThemeBlob: identity?.themeBlob ?? null,
        communityAccent: identity?.accentColor ?? null,
        memberMode: mode,
        highContrastEnabled,
        mode: themeLib.resolved,
        baseTheme: themeLib.colors,
      }),
    [identity?.themeBlob, identity?.accentColor, mode, highContrastEnabled, themeLib.resolved, themeLib.colors],
  );
}

/**
 * Wrap a community's own-screen subtree. `contents` renders the wrapper with
 * `display: contents` (no layout box) so it can wrap a flex/grid child region
 * without disturbing it while still cascading the community CSS vars.
 */
export function CommunityThemeBoundary({
  communityId,
  channelId,
  contents = false,
  className,
  children,
}: {
  communityId: string;
  /** Feature 3: merge this channel's owner-signed topper style overrides. */
  channelId?: string | null;
  contents?: boolean;
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  const m = useMeerkat();
  const active = useCommunityActiveTheme(communityId);
  void m.revision;
  const mergedExtras = useMemo(
    () => mergeThemeExtras(active.styleExtras, channelId ? channelThemeExtras(m.db, communityId, channelId) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active.styleExtras, channelId, m.db, communityId, m.revision],
  );
  const style = useMemo<React.CSSProperties>(() => {
    const vars = themeToCssVars(active.theme) as React.CSSProperties;
    // Plan 56 feature 1: the extended style axes ride CSS variables consumed
    // by the chat bubbles and community panels (defaults reproduce today's
    // rendering; app.css falls back when the vars are absent).
    if (mergedExtras) {
      const resolved = resolveThemeStyle(mergedExtras);
      Object.assign(vars as Record<string, string>, {
        '--mk-bubble-radius': `${resolved.bubbleRadius}px`,
        '--mk-community-font-scale': String(resolved.fontScale),
        '--mk-community-border-w': `${resolved.borderWidth}px`,
      });
    }
    return contents ? { ...vars, display: 'contents' } : vars;
  }, [active.theme, mergedExtras, contents]);
  return (
    <CommunityStyleExtrasContext.Provider value={mergedExtras}>
      <div className={className} style={style} data-community-theme={active.source}>
        {children}
      </div>
    </CommunityStyleExtrasContext.Provider>
  );
}
