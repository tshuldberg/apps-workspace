// The ONE permitted provider seam for the chat kit.
//
// The kit is props-only for all DATA and CAPABILITY (Design Decision 7 / TC-4):
// it imports no ChatProvider, SyncProvider, NodeProvider, IdentityProvider, or
// DatabaseProvider, and every capability flag arrives as a prop. Theming is the
// sole exception: it is app-wide, orthogonal to data, and every Meerkat
// component reads it. Centralizing the two theme hooks here keeps every other
// chat-kit file free of any providers/ import, and the TC-4 enforcement test
// allowlists this file (theme only) while forbidding data providers everywhere.
export { useMkStyles, useAppThemeColors } from '../../providers/AppThemeProvider';

// Plan 56 feature 1: the community theme's extended style axes (bubble shape,
// typography scale, ...). They ride the SAME AppThemeContext (set only by the
// community boundary), so this stays the one theme seam; outside a community
// subtree the defaults resolve to today's rendering exactly.
import { useContext } from 'react';
import { resolveThemeStyle, type MkResolvedThemeStyle } from '@mylife/meerkat-theme';
import { AppThemeContext } from '../../providers/AppThemeProvider';

export function useCommunityChatStyle(): MkResolvedThemeStyle {
  const context = useContext(AppThemeContext);
  return context.communityStyle ?? resolveThemeStyle(null);
}
