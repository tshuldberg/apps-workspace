// useKeyboardShortcuts: global keyboard handling for the shell.
//
//   Cmd/Ctrl+,           open Settings
//   Alt+ArrowUp/Down     previous / next channel in the selected community
//   Cmd/Ctrl+K           focus the channel list (lightweight quick-switch)
//
// Esc (close overlay) lives in Modal; Enter/Shift+Enter lives in Composer. Those
// are intentionally not handled here. We never trap keys while the user is typing
// in an input/textarea/contenteditable (the Composer owns its own Enter), and we
// call preventDefault ONLY when a combo is actually handled, so browser defaults
// are left intact otherwise.

import { useEffect } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import type { AppView, ViewAction } from '../navigation/view-state';

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

export function useKeyboardShortcuts(
  view: AppView,
  dispatch: (action: ViewAction) => void,
): void {
  const m = useMeerkat();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const mod = e.metaKey || e.ctrlKey;
      const typing = isTypingTarget(document.activeElement);

      // Cmd/Ctrl+,  -> Settings. Allowed even while typing (it is not a text key).
      if (mod && !e.altKey && !e.shiftKey && e.key === ',') {
        e.preventDefault();
        dispatch({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } });
        return;
      }

      // Cmd/Ctrl+K -> focus the channel list. Suppress only when we handle it.
      if (mod && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
        const sidebar = document.querySelector<HTMLElement>('.mk-sidebar-scroll');
        if (!sidebar) return;
        e.preventDefault();
        const firstChannel = sidebar.querySelector<HTMLElement>('.mk-channel-row');
        (firstChannel ?? sidebar).focus({ preventScroll: false });
        sidebar.scrollIntoView({ block: 'nearest' });
        return;
      }

      // Alt+ArrowUp / Alt+ArrowDown -> previous / next channel in the community.
      // Never while typing, so it does not fight caret movement in a field.
      if (
        e.altKey &&
        !mod &&
        !e.shiftKey &&
        !typing &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown')
      ) {
        const communityId = view.main.communityId;
        if (!communityId) return;
        const community = m.listCommunities().find((c) => c.communityId === communityId);
        const channels = community?.descriptor.channels ?? [];
        if (channels.length < 2) return;
        const currentIndex = channels.findIndex((c) => c.id === view.main.channelId);
        const base = currentIndex < 0 ? 0 : currentIndex;
        const delta = e.key === 'ArrowUp' ? -1 : 1;
        const nextIndex = (base + delta + channels.length) % channels.length;
        const next = channels[nextIndex];
        if (!next) return;
        e.preventDefault();
        dispatch({ type: 'OPEN_CHANNEL', communityId, channelId: next.id });
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [m, view.main.communityId, view.main.channelId, dispatch]);
}
