# MyLife Billing SKU Matrix

Date: 2026-02-24
Owner: Core Platform

## Goals
- Keep one app binary per platform.
- Support both business models:
  - Hosted subscription (`$5/mo` or `$25/yr`)
  - Self-host license (`$5` one-time)
- Offer optional annual update pack (`$5/yr`).

## Canonical SKU IDs

| Product | SKU ID | Type | Price Target | Notes |
|---|---|---|---|---|
| Hosted Monthly | `mylife_hosted_monthly_v1` | Subscription | `$5/mo` | Auto-renewing |
| Hosted Yearly | `mylife_hosted_yearly_v1` | Subscription | `$25/yr` | Auto-renewing |
| Self-Host License | `mylife_self_host_lifetime_v1` | Non-consumable | `$5 once` | As-is software license |
| Update Pack 2026 | `mylife_update_pack_2026_v1` | Non-consumable | `$5 once` | Feature/update access for 2026 line |

## Entitlement Mapping

| SKU | hostedActive | selfHostLicense | mode default | updatePackYear |
|---|---:|---:|---|---:|
| `mylife_hosted_monthly_v1` | true | false | hosted | null |
| `mylife_hosted_yearly_v1` | true | false | hosted | null |
| `mylife_self_host_lifetime_v1` | false | true | self_host | null |
| `mylife_update_pack_2026_v1` | false | false | unchanged | 2026 |

## Provider Product Mapping

### Apple / Google
- Hosted SKUs: subscriptions
- Self-host SKU: non-consumable one-time
- Update pack SKU: non-consumable one-time

### Web checkout
- Same canonical SKU IDs are sent as product metadata on checkout events.

## Event Types (billing webhook canonicalized)
- `purchase.created`
- `purchase.renewed`
- `purchase.canceled`
- `purchase.refunded`
- `purchase.disputed`

## Versioning Rule
- New pricing or packaging change creates new SKU version suffix (`_v2`), never mutate old meaning.
