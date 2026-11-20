# Telemetry activation verification evidence

This record distinguishes local transport tests from real service evidence. See the [activation guide](../telemetry-activation.md), [shared contract](../gameplay-telemetry.md), and [relay requirements](../../server/README.md).

## Verified on 20 November 2026

- PostHog EU project and dashboard are available.
- Verified destinations: [PostHog project](https://eu.posthog.com/project/360532) and [dashboard](https://eu.posthog.com/project/360532/dashboard/1136395); configured beta web build: [private beta test site](https://remote-dev.emperor-quillback.ts.net:8444/).
- Live PostHog gameplay events and one synthetic Sentry error were retrieved from their projects. These were separate provider checks; the Sentry event does not validate gameplay event mapping.
- PostHog IP and country properties were empty in the inspected live events.
- Offline reload, reconnect, and delivery passed against a static local server.
- The configured beta web build was served privately through Tailscale at `https://remote-dev.emperor-quillback.ts.net:8444/`.
- The organization uses a paid PostHog account, while the organization-wide Product Analytics spending cap is $0. No billing changes were made.
- GameAnalytics credentials were not obtained: credential requests timed out. The systemd unit is installed but inactive because protected `server.env` is absent. Therefore no owned GameAnalytics project ingestion, relay startup, or dashboard mapping is verified.
- Installed unit: `/home/ubuntu/.config/systemd/user/wilderguard-relay.service`; expected protected config: `/home/ubuntu/.config/wilderguard-relay/server.env`; runtime: `/home/ubuntu/.local/share/wilderguard-relay/current`; state: `/home/ubuntu/.local/share/wilderguard-relay/state`.
- A temporary synthetic-only environment verified systemd startup, authenticated loopback OPTIONS returning HTTP 200, and exclusive `flock` behavior (a second writer exited with status 1). The unit was stopped and the synthetic environment/database were removed; current state is inactive/disabled with no protected environment file. No provider credentials were used and no GA cloud traffic was generated.
- Private Tailscale ingress was tested with a synthetic upstream: trusted loopback carrying the owner identity returned HTTP 200; a request through Tailscale HTTPS port 8443 forging that same identity returned HTTP 403. The temporary 8443 proxy and stub were removed after the check. This verifies the tested host's identity-header boundary, not an active GA relay or service ingestion.

## Still unverified

- Native Android delivery to either provider, including first launch without network, force-stop/restart while offline, and reconnect on the intended device.
- GameAnalytics relay authentication against a real configured project, persistence behavior under host restart, and live project ingestion.
- Account-level privacy and retention configuration beyond the explicitly observed PostHog event properties.
- Delivery during app termination or device storage failure. These are best-effort paths; interrupted or missing events must remain unknown.

## Implementation and regression validation

- RED checkpoints `5ba7fbc` and `c33b692` preceded the relay expiry/reservation fixes.
- GREEN: repeated `npm run test:coverage` passed all 420 tests: 99.49% lines, 93.87% branches, 96.35% functions, and 96.83% statements.
- Focused relay suites: 22 checks passed. Synthetic provider browser suite: 3 checks passed. Release workflow checks: 37 passed; no release or publication was performed.
- Unsigned `npm run android:beta` build and `testBetaUnitTest` passed with JDK 17 and Android SDK 34. No APK signing, upload, or release occurred.
- `npm run test:reporting`: 4 browser checks passed. The full 33-journey gameplay suite is rerunning after identifying a baseline Sentry notice from inherited local `.env.local` configuration; E2E configuration isolation is still in progress and not yet claimed as green.
- A Vite preview cache interaction involving `Vary: Origin` was isolated; the static-server route was used for offline/reconnect validation so preview cache behavior would not be confused with relay/provider behavior.
- General and security reviews reported no critical/high findings in the reviewed implementation. The TDD history records and tests the idle-expiry/quota regression fixes.

## Repeatable local checks

`npm run test:telemetry` runs the synthetic fixture and intercepted browser journeys. It validates client behavior and does not contact or validate either provider account. For live validation, select one provider, accept disclosure, complete one wave, inspect the corresponding project for its start and terminal/mapped events, and compare the values with the run. Then repeat with connectivity disabled and restored, and verify stable IDs/timestamps and no cross-provider delivery. See the activation guide for the exact manual sequence and privacy checks.
