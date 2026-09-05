// Deep-link target for dowork://video/<id>.
//
// The player lives at /(root)/player?videoId=. This thin route lets a shared
// dowork://video/<id> link resolve to the real player (which fetches a signed
// URL and re-checks entitlement server-side). A missing id falls back to the
// trainers directory rather than opening a dead player.

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function VideoDeepLinkRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id.trim() : '';
  if (!id) {
    return <Redirect href={'/(root)/(tabs)/trainers' as never} />;
  }
  return <Redirect href={`/(root)/player?videoId=${encodeURIComponent(id)}` as never} />;
}
