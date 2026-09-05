import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { extractThemeBlob } from '@mylife/meerkat-theme';

// Catches an incoming `meerkat://theme/import#<blob>` deep link (cold start or
// while running) and routes it into the Appearance import flow. The blob is
// still validated/sanitized by the codec on import, so this only navigates; it
// never trusts the link. Pasting a deep link already works without this; this
// adds OS-level auto-open. Mounted once inside the provider tree (needs router).
export function ThemeLinkListener(): null {
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const handle = (incoming: string | null): void => {
      if (!incoming || incoming === handled.current) return;
      const blob = extractThemeBlob(incoming);
      if (!blob) return;
      handled.current = incoming;
      router.push({ pathname: '/appearance', params: { import: blob } });
    };
    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const sub = Linking.addEventListener('url', (event) => handle(event.url));
    return () => sub.remove();
  }, [router]);

  return null;
}
