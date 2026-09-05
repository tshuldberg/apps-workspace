# @mylife/meerkat-icloud-storage

Owned iOS Expo module for Meerkat encrypted storage destinations:

- app-owned iCloud Documents container access;
- coordinated reads, writes, lists, deletes, downloads, and conflict inspection;
- iCloud identity-change events;
- security-scoped bookmark persistence for user-selected iOS Files folders.

## Honesty boundary

The Swift implementation is **UNVERIFIED - pending dev build / physical device QA**.
Source authorship is not evidence that iCloud uploaded a file, that a bookmark
survives restart, or that an account switch was observed. Expo Go and builds
without the compiled module receive typed `native_module_absent` results from
every bridge method.

`coordinatedWriteICloudFile` reports only `local_container_write`. Callers must
query the ubiquitous item state and perform a coordinated read-back before they
produce storage verification evidence. A local container write is never remote
durability.

## Founder operations

Configure the plugin with the real signed container identifier:

```ts
[
  '@mylife/meerkat-icloud-storage',
  { containerIdentifier: process.env.MEERKAT_ICLOUD_CONTAINER_ID ?? '' },
]
```

An empty identifier adds no entitlement. The signed App ID, provisioning
profile, CloudDocuments container, fresh-install restore, account switch, quota,
conflict, and provider-bookmark matrix require a physical-device dev build.

The app presents the iOS directory picker. This package only persists and
resolves the selected directory bookmark, and starts security-scoped access for
each individual native operation.
