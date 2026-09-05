# Yearn

Yearn is the Expo / React Native rewrite of the native SwiftUI Yearn app at `/Users/trey/Superapp-Projects/need-works`.

The native app remains the product reference while this standalone app becomes the shippable public TestFlight beta target under MyLife.

## S0 Scope

- Expo Router app in `apps/yearn`.
- TypeScript, Turbo, EAS, and Expo export wiring.
- Yearn token palette and first token-driven discover shell.
- Supabase client scaffold targeting the existing `yearn` schema with sessions stored in `expo-secure-store`.
- App-level cloud provider that restores persisted Supabase sessions and tracks auth state.
- Typed repository methods for the reusable RPC surface: `discover_profiles`, `send_like`, `send_pass`, `incoming_likes`, `like_back`, `dismiss_like`, `my_matches`, `archive_match`, and `current_membership`.
- Boost purchases activate through the authenticated `yearn-boost-activate` Edge Function after it locally verifies the App Store certificate chain and signed transaction.
- Ciphertext-only intro/message repository paths for `messages_ciphertext`; plaintext intros are blocked in the Expo client and May 31 SQL.
- Basic trust and safety client writes for `blocks` and `reports`.
- Discover, Likes, Matches, and You surfaces wired to the live repository when authenticated.
- In-app repository harness panel for authenticated smoke checks against the live Yearn RPC surface.

## Environment

Copy `.env.example` to `.env.local` and provide the existing Yearn Supabase URL and anon key locally. Do not commit real keys.

```bash
EXPO_PUBLIC_YEARN_SUPABASE_URL=https://PROJECT_REF.supabase.co
EXPO_PUBLIC_YEARN_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_YEARN_CLOUD_ENV=development
EXPO_PUBLIC_YEARN_PUBLIC_BETA=0
```

Public beta builds must point at the production Yearn Supabase project.
Development-only surfaces, including the repository harness and sample deck,
are hidden automatically when `EXPO_PUBLIC_YEARN_PUBLIC_BETA=1` or
`NODE_ENV=production`.

## Launch identity

Use the Yearn identity consistently across Expo, native reference builds,
Supabase Edge Functions, App Store Connect, APNs, and purchase products:

- iOS bundle ID, Android package, and APNs topic: `com.mylife.yearn`
- Membership product ID: `com.mylife.yearn.membership`
- Boost product ID: `com.mylife.yearn.boost`

Do not commit placeholder EAS project IDs or App Store Connect app IDs. Configure
those values through EAS project setup and release credentials instead.
