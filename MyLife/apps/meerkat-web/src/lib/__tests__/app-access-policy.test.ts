import { describe, expect, it } from 'vitest';
import {
  webActionRequiresAppUnlock,
  webOverlayRequiresAppUnlock,
  webPaneRequiresAppUnlock,
} from '../app-access-policy';

describe('web app access policy', () => {
  it('keeps public reading and purchase settings free', () => {
    expect(webPaneRequiresAppUnlock('public')).toBe(false);
    expect(webPaneRequiresAppUnlock('discover')).toBe(false);
    expect(webOverlayRequiresAppUnlock('settings')).toBe(false);
    expect(webActionRequiresAppUnlock({ type: 'OPEN_PUBLIC' })).toBe(false);
    expect(webActionRequiresAppUnlock({ type: 'OPEN_OVERLAY', overlay: { kind: 'settings' } })).toBe(false);
  });

  it.each(['feed', 'messages', 'channel', 'files', 'downloads', 'library'] as const)(
    'requires the unlock for private pane %s',
    (pane) => expect(webPaneRequiresAppUnlock(pane)).toBe(true),
  );

  it('fails closed for private commands and overlays', () => {
    expect(webActionRequiresAppUnlock({ type: 'OPEN_MESSAGES' })).toBe(true);
    expect(webActionRequiresAppUnlock({ type: 'OPEN_CHANNEL', communityId: 'c', channelId: 'g' })).toBe(true);
    expect(webActionRequiresAppUnlock({ type: 'OPEN_OVERLAY', overlay: { kind: 'sync' } })).toBe(true);
    expect(webActionRequiresAppUnlock({ type: 'OPEN_OVERLAY', overlay: { kind: 'create-community' } })).toBe(true);
  });
});
