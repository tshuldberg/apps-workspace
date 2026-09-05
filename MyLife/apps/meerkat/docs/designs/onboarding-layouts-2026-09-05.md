# Meerkat onboarding and device layout defaults

Status: all six starters can load on mobile and web. Device-local defaults and owner draft loading are implemented. Media playback/live composition remains unfinished; native-device UI verification remains outstanding.

## Intent and evidence

The founder requested standard-community guidance, recognizable content layouts, then theme selection. The follow-through explicitly requests easy loading of the incomplete layouts and configurable desktop/mobile defaults.

Reviewed history: `56233f3b` adds the theme catalog; `7c923dcb` and `da1a87ee` establish community archetypes. The August 24 composition plan defines video, short-form, and live surfaces. Current block contracts exist, but their composition renderers and capability runtimes remain incomplete. Layout loading must not claim that playback or broadcasting works.

## Design and review decisions

Use the existing Meerkat theme tokens, type, spacing and radius. Reference labels and local schematic previews avoid external image requests, logos that imply integrations, and account-linking confusion.

```
Name → How to begin → Standard community → Layout → Theme → Create
                                            ↓
                        Optional: use as this device's default
```

- Six choices: Standard community, Discussion board, Shared library, Video channel, Short videos, Live stage.
- Every choice can proceed to theme and creation. Unfinished ones say “Starter · Media unfinished” and explain the missing functionality.
- The initial design disabled incomplete media choices. The founder's follow-through supersedes that restriction: load their structure, show real capability notices, and retain chat.
- Back retains the name, layout, theme, and default opt-in. Browsing previews writes nothing.
- All built-in themes remain selectable. Community themes remain independent of the personal app theme.
- A bounded theme list keeps the preview close to choices. New steps reset scroll; web headings receive focus. Controls have visible selected state, keyboard support, and at least 44px targets.
- Existing join, friend, browse, restore, entitlement, and invite consent paths remain available.

## Two separate authorities

### Owner-created community layout

Onboarding commits a signed descriptor, any starter libraries, the community theme, the layout document where applicable, and completion in the existing staged creation path. Choosing a device default is explicitly optional and commits in the same transaction. A final identity-write failure rolls back the layout, default, and completion and removes the new community.

Video and Short videos provision a Videos collection during creation. Their media blocks remain capability-gated; all media starters retain a general chat.

Existing owners can choose a **Starter layout → Load starter into draft** in the layout editor. It replaces only the home arrangement and adds required capability declarations to the draft. Channel overrides, tiers, channels, and content are retained. Loading does not publish. The real block preview shows what is available; Publish retains the existing owner-signature enforcement.

### Device-local default home

Settings exposes **Default layout on this device**. Web places it under Appearance; native provides a collapsible section in Settings.

- **Use settings for:** Desktop or Mobile. Both profiles are stored independently on this installation/browser.
- **Default community home:** Use community layout, or any of the six starters.
- Fresh native installs use the Mobile profile. Web initially uses Mobile for coarse-pointer devices, Desktop otherwise. An explicit profile selection persists and is not overwritten by resizing.
- The initial default is **Use community layout**, preserving the verified owner layout and legacy routing.
- Local overrides affect community home presentation, not channel contents, permissions, the signed owner document, or other members.
- Local media capabilities are intersected with the verified owner capability declaration. A local Live/Video choice cannot enable an owner-disabled feature. The runtime gate remains a separate requirement.
- Returning to Use community layout restores owner presentation. Web reroutes a legacy home to its real chat/library surface.
- Existing community theme preferences remain independent.

Persistence is only in device-local `mk_settings`: `layout_device_class`, `layout_default:desktop`, and `layout_default:mobile`. No preference is sent through the sync recorder. Unknown/corrupt stored values fall back to community layout. Explicit invalid writes are rejected.

## Implementation map

- Both app trees: `onboarding-experience-core.ts` contains the catalog, creation draft builder, and starter document builder.
- Both app trees: `device-layout-core.ts` validates and stores profiles/defaults and resolves a local home without granting capabilities.
- Both onboarding gates and `ExperienceChooser` components implement layout-before-theme, unfinished starter labels, and optional device-default selection.
- Both staged community template commits persist the optional local default with the rest of creation.
- Both layout editors load starters into a draft before publish.
- Both community homes honor local defaults. Web rail routes to the local home; existing explicit channel/library navigation remains available.
- Both Settings surfaces expose profile/default controls.
- The parity gate byte-locks both new core pairs.

## Verification

- Focused real-database suites: **20 tests passed on mobile and 20 on web**. Coverage includes all six layout/theme combinations, signed media/discussion layout persistence, announcement permissions, library provisioning, default/completion rollback, independent profiles, corrupt preference fallback, zero sync-log writes, and owner capability restrictions.
- Browser launch + onboarding suite: **18 passed, 1 skipped**. The skip requires a configured real relay.
- Browser checks cover all three unfinished starters, retained chat, device default persistence after reload, independent Desktop/Mobile profiles, restoration of the owner view, draft loading without publication, and explicit publication of a Live starter.
- Visual inspection: desktop layout picker, 390px theme picker, device-default settings, and the actual unfinished Live home. Screenshots are local outputs under `apps/meerkat-web/output/playwright/`; do not include generated traces/screenshots in a source commit.
- Relevant sync community, identity, and layout suites: **49 passed**.
- Full web suite during this follow-through: **1,308 passed**; the subsequently added capability-restriction test also passes in the focused run.
- Full native suite during this follow-through: **1,930 passed, 1 failed**. The failure is the pre-existing source-text assertion in `app/__tests__/channels-wiring.test.ts:142`, which expects the exact old `catch { /* already closing */ }` comment from the concurrently edited room adapter. The newer behavioral room-adapter tests pass; this obsolete source assertion was left intact for that workstream.
- App lint and typechecks pass through the changed-function gate. One optional unsubscribe callback in each concurrent call-media test needed a type guard; the guard verifies the callback exists before invoking it, without changing the media runtime or removing an assertion.
- Final `pnpm gate:function:changed`: **passed (exit 0)**, including app lint/typechecks and the selected tests plus shared-package consumer typechecks triggered by concurrent changes. Final `pnpm check:meerkat-parity`: **passed (exit 0)**.

## Remaining limits

Media starters load their real structure and honest unavailable states; this does not complete composition video playback, vertical paging, or live broadcasting. No transport, server, or native playback claim is made.

Native UI walkthrough on the current validated build remains required before release, particularly nested theme scrolling, large text, profile selection, and modal dismissal. Database tests and browser screenshots are not native-device evidence.

Existing users are not forced back through onboarding: Settings and the owner layout editor expose the new controls. Work remains local and uncommitted; concurrent sessions continue to edit other launch areas.
