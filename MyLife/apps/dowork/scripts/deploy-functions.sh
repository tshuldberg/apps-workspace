#!/usr/bin/env bash
# Deploy DoWork Supabase Edge Functions with the correct JWT-verification split (BK-1).
#
# Auth invariant: supabase/functions/_shared/broker.ts getUserIdFromAuth() decodes the
# JWT `sub` claim WITHOUT verifying the signature and relies on the Supabase Edge gateway
# to verify the token first. Therefore:
#   - USER-FACING functions MUST keep gateway JWT verification (the default). Do NOT pass
#     --no-verify-jwt, or the only auth check becomes a forgeable, unverified token.
#   - MACHINE-CALLER functions authenticate with their own shared-secret header (never a
#     Supabase user JWT) and are deployed WITH --no-verify-jwt so the gateway does not 401
#     legitimate callers before the handler's secret check runs.
#
# Usage: ./deploy-functions.sh <project-ref>
#   production: ./deploy-functions.sh tgyxkoblbiacjsbmiuyn
#
# Run from the repo root (where supabase/functions lives). Requires the Supabase CLI,
# an authenticated session (supabase login), and server-only secrets already set via
# `supabase secrets set` (never EXPO_PUBLIC): RC_WEBHOOK_SECRET, DOWORK_INTERNAL_SECRET.
# See docs/runbooks/dowork-supabase-setup.md.
set -euo pipefail

REF="${1:-}"
if [[ -z "$REF" ]]; then
  echo "Usage: $0 <supabase-project-ref>" >&2
  exit 1
fi

# User-facing functions: the gateway verifies the caller's JWT (no --no-verify-jwt).
USER_FACING=(
  dowork-upload-finalize
  dowork-delete-account
  dowork-redeem-invite
  dowork-playback-url
)

# Machine-caller functions: gated by their own shared secret, not a user JWT.
#   dowork-rc-webhook -> Authorization header == RC_WEBHOOK_SECRET (RevenueCat cannot
#                        send a Supabase user JWT)
#   dowork-notify     -> x-dowork-internal header == DOWORK_INTERNAL_SECRET (called only
#                        by dowork-upload-finalize and Database Webhooks, server-to-server)
MACHINE_CALLERS=(
  dowork-rc-webhook
  dowork-notify
)

echo "Deploying DoWork Edge Functions to project $REF"

for fn in "${USER_FACING[@]}"; do
  echo "  [verify-jwt]    $fn"
  supabase functions deploy "$fn" --project-ref "$REF"
done

for fn in "${MACHINE_CALLERS[@]}"; do
  echo "  [no-verify-jwt] $fn (secret-gated)"
  supabase functions deploy "$fn" --project-ref "$REF" --no-verify-jwt
done

echo
echo "Deployed. Verify the invariant before trusting the deploy:"
echo "  1) Forged/unsigned JWT to a user-facing fn must 401:"
echo "       curl -i -X POST \"https://$REF.supabase.co/functions/v1/dowork-upload-finalize\" \\"
echo "         -H 'Authorization: Bearer forged.jwt.token' -H 'Content-Type: application/json' -d '{}'"
echo "  2) A machine-caller call with no JWT but a valid shared secret must succeed;"
echo "     the same call WITHOUT the secret must 401."
echo "  3) Confirm every function is listed:"
echo "       supabase functions list --project-ref \"$REF\""
