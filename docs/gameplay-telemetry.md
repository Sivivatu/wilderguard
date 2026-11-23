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
