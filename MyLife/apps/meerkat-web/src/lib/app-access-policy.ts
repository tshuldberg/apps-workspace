import type { MainPane, OverlayKind, ViewAction } from '../ui/navigation/view-state';

const FREE_PANES = new Set<MainPane>(['public', 'discover']);
const FREE_OVERLAYS = new Set<OverlayKind>(['settings']);

export function webPaneRequiresAppUnlock(pane: MainPane): boolean {
  return !FREE_PANES.has(pane);
}

export function webOverlayRequiresAppUnlock(kind: OverlayKind): boolean {
  return !FREE_OVERLAYS.has(kind);
}

export function webActionRequiresAppUnlock(action: ViewAction): boolean {
  switch (action.type) {
    case 'OPEN_PUBLIC':
    case 'OPEN_DISCOVER':
    case 'SHOW_SIDEBAR':
    case 'CLOSE_OVERLAY':
      return false;
    case 'OPEN_OVERLAY':
      return webOverlayRequiresAppUnlock(action.overlay.kind);
    default:
      return true;
  }
}
