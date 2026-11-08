# Gameplay telemetry implementation plan

## PRD

Family beta testers can choose Off, PostHog or GameAnalytics in Camp settings. Statistics describe wave challenge, clear margin, economy, defense composition and slow frames. Reporting is separate from Sentry. No paid products, source-map uploads, release activation or publication are part of this change.

## Architecture and system design

One versioned strict event contract feeds one collector at UI state transitions. `game.ts` stays pure. Provider adapters receive only validated snapshots; no SDK auto collection. An outbox stores at most 64 events for 48 hours separately from saves; oldest events expire/drop first. Transport runs asynchronously, retries with stable IDs and timestamps, and never waits in the render loop. Collection is opt-in, beta-only, and unavailable without valid configuration. Changing provider or project purges the old outbox. Storage failure disables delivery. Quota failures remove old preferences/outbox as a fallback; if writes and removals are both blocked, Off applies to this session and settings explicitly require clearing app data before restart/share.

PostHog uses the documented public capture API, anonymous run IDs, no person profiles and GeoIP disabled. GameAnalytics uses a private relay to keep its HMAC game secret out of bundles. The relay is source only; deployment requires separate authorization. No accounts are configured in this implementation.

## Technical specification

- `wave_start` starts the denominator; `wave_end` records clear, defeat or explicit campaign abandon once. Missing terminal events remain unknown/interrupted; checkpoint restores do not infer failure.
- Run IDs reset at launch, campaign restart, and provider selection. Attempts have new IDs. Retry and checkpoint context are explicit. Never interpret run IDs as people.
- Terminal facts include actual cumulative health loss (including later healing), opening/remaining diamonds, observed earned/spent deltas during a wave, separate preparation spend, tower type/level counts, and sampled frame/update/render durations. Active duration estimates wall time at animation-frame resolution, excluding the first and terminal intervals and pauses/dialogs/background, independent of game speed. Frame timings sample every 30 active frames; slow-frame counts describe samples, not all frames.
- No saves, names, contact data, location, exact touch history, screenshots, replay, persistent player IDs, hardware fingerprint or full state are transmitted.
- Queue delivery is best effort. An app kill can lose a live attempt or pending storage write. A lost acknowledgement can cause a duplicate. Opt-out cannot recall sent requests or data already accepted by a provider.

## Task list

1. Foundation: strict contract, collector, outbox, exclusive preference, disclosure, UI hooks, tests and coverage.
2. PostHog: config, mapping and bounded transport; tests for privacy and retry.
3. GameAnalytics: client relay adapter and server-only authenticated Collection API mapping; free design metrics, bounded cardinality; tests for mapping, secrets, rate bounds and failures.
4. Register and verify all three PRs above Sentry PR #1; preserve its head and release gates.

## Validation plan

RED/GREEN unit and integration tests for contract, lifecycle, denominators, performance and queue. Browser settings/wave/restart/offline journeys, public-build no-traffic assertion, full coverage/build/release checks, Android beta build and native tests where available. Real native ingestion and force-stop/reconnect tests require configured projects, relay and device; mocked transports do not prove those stages.

## Baseline

Sentry base `faecfeb2b76f2ba439ff57be4eeb6da9c97e30aa`: CI run 42420070057 failed because Playwright preview started without a built `dist` directory (60-second webServer timeout). The foundation will make its browser test harness build first, without editing the Sentry branch or release publication behavior.

## PostHog adapter and local beta configuration

Reviewed 8 November 2026 against [capture API](https://posthog.com/docs/api/capture), [privacy controls](https://posthog.com/docs/privacy/data-collection), and official SDK payload construction (`PostHog/posthog-js`, `packages/core/src/posthog-core-stateless.ts`). Registry versions observed: posthog-js 1.447.3, GameAnalytics JS 5.0.0. Neither provider SDK is installed. Zod 4.6.7 validates storage/transport boundaries; Capacitor App 6.0.3 verifies native beta package identity and supplies foreground/background signals without upgrading Capacitor.

Use an ignored local environment file only. Set `VITE_GAMEPLAY_CHANNEL=beta`, a safe `VITE_GAMEPLAY_BUILD` (up to 64 letters/digits/`.`/`_`/`+`/`-`), `VITE_POSTHOG_HOST=https://eu.i.posthog.com`, public `VITE_POSTHOG_TOKEN`, and `VITE_POSTHOG_EPOCH` (a safe project/config revision). Confirm **Settings → Project → General → IP data capture → discard** before setting `VITE_POSTHOG_IP_DISCARD_CONFIRMED=true`. Changing token/host/epoch requires new consent and purges queued events. Public Android package IDs stay off even if beta web configuration is accidentally bundled. Release CI blanks all provider settings.

Set a zero-spend project ingestion limit within the free Product Analytics allowance and verify that no paid add-ons or billing upgrade is enabled before supplying a real project token. This implementation cannot inspect an unconfigured account's billing or server privacy settings. Do not use a personal/admin API key, source-map token, or GameAnalytics secret in `VITE_*`. No subscription, account, paid feature or source upload is created by the code.

The adapter sends only `wilderguard_wave_start_v1` and `wilderguard_wave_end_v1` to the EU public capture API, with the stable event ID as `uuid`, original timestamp, random launch/campaign/provider-scoped run identity, `$process_person_profile=false` and `$geoip_disable=true`. It never initializes a PostHog SDK, sends browser metadata/URLs/cookies, fetches remote flags, or captures pageviews, sessions, replay, heatmaps, touches or web vitals. Network delivery necessarily exposes the source IP to PostHog in transit; project-level IP discard and per-event GeoIP suppression solve different problems. A successful HTTP response means accepted for transport, not verified dashboard ingestion.

Analyze attempt IDs and explicit starts/terminals, rather than person-based funnels: clear rate is `clears / observed terminals` with starts and missing-terminal count shown separately. Missing terminals include interrupts, expiry and queue overflow; they are not defeats or quits. Group clear margin by region/wave/build/balance, lives lost/remaining, economy and tower counts. Mean/sample-max intervals and sampled update/render durations describe game slowdown; they are not Web Vitals or a paid health dashboard.

Configured beta web bundles are beta builds regardless of serving origin. Only publish unconfigured public builds; do not publish the synthetic browser fixtures or a configured beta bundle to a public web surface. Android additionally verifies the package ID at runtime.

## GameAnalytics activation and readiness

Set `VITE_GAMEANALYTICS_RELAY` to an approved private HTTPS `/telemetry` endpoint and `VITE_GAMEANALYTICS_EPOCH` to the exact server project epoch. The client has no GA game key/secret and no provider SDK. A changed endpoint/epoch invalidates consent and queue ownership. Server configuration, free mapping details and ingress requirements are in [server/README.md](../server/README.md). No relay was deployed, no account created and no paid plan enabled.

One collector still feeds exactly one chosen adapter. GameAnalytics maps free progression/resource/Design metrics; it does not expose every raw contract field in free dashboards. It omits unique attempt IDs from names/dimensions and uses ephemeral runs, so GA user/retention counts do not measure people. Full-contract attempt correlation remains available in PostHog. Compare clear/defeat outcomes against observed starts and retain unknown/missing-terminal counts; never infer that queue loss, interruption or opt-out is a defeat.

Readiness on 8 November 2026: both adapters and server mapping installed as source and validated by unit/browser mocks; unsigned native build passes. A loopback relay preflight invoked successfully with synthetic configuration, and the vendor's public sandbox accepted 20 synthetic mapper rows over HMAC-authenticated HTTP. No owned PostHog/GA account is configured/authenticated here, no project dashboards were inspected, no actual device ingestion/force-stop/reconnect journey was verified, and no private remote relay/ingress is deployed. Activation requires those separate checks, appropriate child-directed project configuration and zero-spend controls. Release CI still blanks gameplay configuration and Sentry remains disabled there.
