/**
 * The retired Friends tab redirects to Messages (Plan 31 Phase 0, T0.2 / TC-3).
 *
 * Friends merged into Messages; the old route stays one release as a redirect so
 * saved links/state never 404. Mock expo-router's Redirect so the element's href
 * is inspectable under Node (no React Native render harness exists here).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => props,
}));

import FriendsRedirect from '../(root)/(tabs)/friends';

describe('friends route', () => {
  it('renders a Redirect to /messages and nothing else', () => {
    const element = FriendsRedirect() as unknown as { props: { href: string } };
    expect(element.props.href).toBe('/messages');
  });
});
