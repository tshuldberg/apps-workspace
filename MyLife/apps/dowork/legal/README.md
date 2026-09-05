# DoWork legal site (founder-ops F5)

Static pages for dowork.app. The shipped app links these EXACT paths, so the
host must serve clean URLs (no `.html`):

| App link | File |
|---|---|
| `https://dowork.app/terms` | `terms.html` (PaywallSheet) |
| `https://dowork.app/privacy` | `privacy.html` (PaywallSheet + Settings) |
| `https://dowork.app/guidelines` | `guidelines.html` (Settings) |
| `https://dowork.app/trainer-license` | `trainer-license.html` (linked from Terms) |

## Deploy

Any static host works. Cloudflare Pages and Vercel serve `/terms` from
`terms.html` automatically (clean URLs on by default for Pages; for Vercel add
`"cleanUrls": true` in a `vercel.json`). Netlify needs "Pretty URLs" enabled.
Point the `dowork.app` apex + `www` at the host and enforce HTTPS.

## Before going live (founder review)

1. Read all four documents once; they were drafted 2026-07-04 to match the
   shipped app behavior (on-device voice, RLS-private coaching, opt-in
   marketing push, account deletion, $4.99 app + tier ladder subs).
2. Governing law is drafted as California; confirm or change.
3. The trainer revenue share is intentionally NOT a number here; it points to
   the individual trainer agreement (founder decision F4). Update section 4 of
   `trainer-license.html` if you want the split published.
4. Have a lawyer review before public (non-TestFlight) launch.

## Later: universal links

When ready to enable `https://dowork.app/...` universal links (see
`docs/runbooks/dowork-supabase-setup.md`), host
`/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
on this same site.
