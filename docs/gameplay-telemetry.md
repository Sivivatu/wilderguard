# Gameplay telemetry implementation and privacy contract

## Product behavior

Family beta testers have one **Gameplay statistics** On/Off switch in Camp settings. It is Off by default. On sends the same allowlisted gameplay facts to both PostHog and GameAnalytics; both destinations must have valid configuration before the control is enabled. Statistics describe wave challenge, clear margin, economy, defense composition, and sampled frame timings. This feature is separate from Sentry error reporting. Public builds and release builds do not collect gameplay statistics; a native build also has to pass the beta Android package ID gate.

## Collection and delivery

A strict versioned event contract feeds one collector at UI state transitions; `game.ts` stays pure and no provider SDK auto-collects. `wave_start` starts the denominator. `wave_end` records clear, defeat, or explicit campaign abandon once. Missing terminal events remain unknown/interrupted; checkpoint restores do not infer failure.

Terminal facts include cumulative health loss (including later healing), opening/remaining diamonds, observed earned/spent deltas during a wave, separate preparation spend, tower type/level counts, and sampled frame/update/render durations. Active duration estimates wall time at animation-frame resolution, excluding initial and terminal intervals and pauses/dialogs/background, independent of game speed. Frame timings sample every 30 active frames; slow-frame counts describe samples, not all frames.

The local outbox is separate from saves and is bounded to 64 events and 48 hours. Each v2 outbox event starts with two pending provider lanes. PostHog and GameAnalytics retry and acknowledge independently; an acknowledgement clears only that provider from the event's pending list. Delivery is asynchronous, uses stable event IDs and timestamps, and never blocks the render loop. A fresh v2 **On** consent is required for the current build and both provider configuration scopes. Old v1 provider selections are removed and do not grant consent. Changing either destination's project/endpoint/epoch changes the consent scope and purges old queued data. Storage failure disables delivery. Off aborts active requests, clears the queue, and persists Off; if storage cannot retain that choice, the session remains Off and settings require clearing app data before restart/share.

Queue delivery is best effort. An app kill can lose an active attempt or pending storage write; a lost acknowledgement can produce a duplicate. Off cannot recall sent requests or data already accepted by a provider.

## Data and provider handling

No saves, names, contact data, location, exact touch history, screenshots, replay, persistent player IDs, hardware fingerprints, or full game state are transmitted. Random run and attempt IDs are ephemeral and reset at launch/campaign boundaries; they do not identify people.

PostHog uses the public EU capture API, sends the full allowlisted contract, disables person profiles and GeoIP enrichment, and does not initialize an SDK, fetch remote flags, or capture pageviews, sessions, replay, heatmaps, touches, or web vitals. Network delivery exposes the source IP to PostHog in transit; project-level IP discard and per-event GeoIP suppression are separate controls.

GameAnalytics uses a private relay so its HMAC game secret stays off client bundles. Its free dashboards receive a mapped subset of the same contract: progression, resource, and Design metrics. Frame maximum, slow-frame/sample counts, original event/attempt IDs, balance label, and preparation spend breakdown are not separate free dashboard metrics. GA uses ephemeral run IDs and does not provide a dedicated FPS dashboard. Do not interpret GA user, retention, or cohort counts as people or devices. Relay ingress requirements, bounds, and mapping are in [server/README.md](../server/README.md).

## Beta configuration

Use an ignored local environment file. The bundle needs `VITE_GAMEPLAY_CHANNEL=beta` and a safe `VITE_GAMEPLAY_BUILD`, plus valid configuration for both destinations:

- PostHog: `VITE_POSTHOG_HOST=https://eu.i.posthog.com`, the public project token, a safe project/config epoch, and `VITE_POSTHOG_IP_DISCARD_CONFIRMED=true` only after confirming project IP discard.
- GameAnalytics: the approved private HTTPS relay URL and matching project epoch. The client has no GA game key or secret.

Changing either provider's configuration requires new consent. Public Android package IDs stay Off even if beta web configuration is accidentally bundled. Release CI blanks all gameplay provider settings. PostHog billing and privacy settings must be checked in the project; code cannot inspect them. Do not enable paid add-ons or raise the organization's $0 Product Analytics spending cap as part of validation. No paid GameAnalytics feature is enabled.

## Readiness — 23 November 2026

The PostHog EU project and dashboard are available, and earlier live gameplay events were retrieved; inspected events had empty IP and country properties. Earlier offline reload/reconnect/delivery checks used a static local server. The user confirmed that the GameAnalytics project has child-directed privacy settings and is on the free plan. Earlier live GameAnalytics validation sent three events through the relay to its `/events` API and received HTTP 200 responses. Those checks predate the current dual-provider consent/outbox behavior.

The prior GameAnalytics browser harness forwarded an approved test identity over trusted loopback; it did not prove browser ingress. A deployed HTTPS relay preflight on port 8443 later returned HTTP 403. The updated dual-provider flow and browser ingress have not been verified after rollout, so live dual delivery and human browser access are pending. GameAnalytics dashboard visibility, human-device Tailnet authentication, native Android ingestion, first-launch offline behavior, native force-stop/restart/reconnect, and delivery during app termination are also unverified. Earlier relay replay checks establish only relay-side deduplication for that replay, not exactly-once provider processing. See [activation and local verification](telemetry-activation.md) and [TDD validation evidence](testing/telemetry-activation.tdd.md).
