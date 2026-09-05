#!/usr/bin/env bash
# Deploy BestChef Supabase Edge Functions with the correct JWT-verification split (OPS-04).
#
# Auth invariant: supabase/functions/_shared/broker.ts getUserIdFromAuth() decodes the
# JWT `sub` claim WITHOUT verifying the signature and relies on the Supabase Edge gateway
# to verify the token first. Therefore:
#   - USER-FACING functions MUST keep gateway JWT verification (the default). Do NOT pass
#     --no-verify-jwt, or the only auth check becomes a forgeable, unverified token.
#   - WORKER functions are gated by a server-only secret (not a user JWT) and are invoked
#     by cron / server tooling, so they are deployed WITH --no-verify-jwt.
#
# Usage: ./deploy-functions.sh <project-ref>
#   staging:    ./deploy-functions.sh tcikvihyjetsfkjjpljv
#   production: ./deploy-functions.sh zjxabnazbdocrqpyixgo
#
# Run from the repo root (where supabase/functions lives). Requires the Supabase CLI,
# an authenticated session (supabase login), and server-only secrets already set via
# `supabase secrets set` (never EXPO_PUBLIC): SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
# the worker secrets, and MODERATION_PROVIDER. See AUTH-09.
set -euo pipefail

REF="${1:-}"
if [[ -z "$REF" ]]; then
  echo "Usage: $0 <supabase-project-ref>" >&2
  exit 1
fi

# User-facing functions: the gateway verifies the caller's JWT (no --no-verify-jwt).
USER_FACING=(
  bestchef-vision
  bestchef-nutrition
  bestchef-product-identity
  bestchef-media-upload
  bestchef-media-finalize
  bestchef-export-account
)

# Worker functions: invoked by server/cron with a worker secret, not a user JWT.
WORKERS=(
  bestchef-delete-account
  moderate_vote_proof
  bestchef-media-screening
  bestchef-media-purge
  bestchef-url-resign
  bestchef-push-fanout
)

echo "Deploying BestChef Edge Functions to project $REF"

for fn in "${USER_FACING[@]}"; do
  echo "  [verify-jwt]    $fn"
  supabase functions deploy "$fn" --project-ref "$REF"
done

for fn in "${WORKERS[@]}"; do
  echo "  [no-verify-jwt] $fn (secret-gated)"
  supabase functions deploy "$fn" --project-ref "$REF" --no-verify-jwt
done

echo
echo "Deployed. Verify the invariant before trusting the deploy:"
echo "  1) Forged/unsigned JWT to a user-facing fn must 401:"
echo "       curl -i -X POST \"https://$REF.supabase.co/functions/v1/bestchef-vision\" \\"
echo "         -H 'Authorization: Bearer forged.jwt.token' -H 'Content-Type: application/json' -d '{}'"
echo "  2) A worker call with no JWT but a valid worker secret must succeed;"
echo "     the same call WITHOUT the secret must 401."
echo "  3) Confirm every function is listed:"
echo "       supabase functions list --project-ref \"$REF\""
