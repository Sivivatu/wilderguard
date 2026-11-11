# Gameplay telemetry TDD evidence

Plan: [gameplay-telemetry.md](../gameplay-telemetry.md). Journeys: consent before collection, wave difficulty/margin summaries, best-effort offline recovery, and independent error-reporting controls.

## Foundation

- RED checkpoint `c5fc14f`: four focused suites failed because the new contract, collector, outbox and policy modules did not exist. These were intended missing-module compile failures.
- GREEN: `npm run test:coverage`: 366 tests passed; 99.51% lines, 94.11% branches, 95.43% functions, 96.69% statements.
- Review regression: quota failure during Off reproduced a restored PostHog preference. After adding consent/outbox removal fallbacks, the same test passes. Total storage denial remains explicitly reported as session-only Off with app-data-clear guidance.
- `npm run build`: TypeScript and Vite pass; private error maps are removed from web output and remain local/ignored.
- `npm run test:release`: 37 tests pass. These use fixtures; they do not publish a release.
- `npm run test:reporting`: all 3 inherited Sentry browser tests pass.
- Android: Capacitor sync, `assembleBeta testBetaUnitTest --no-daemon` with JDK 17 and Android SDK 34 pass; unsigned APK only, no device installation or publication.
- `npm audit --omit=dev --audit-level=low`: zero production vulnerabilities. Install reports 4 inherited development vulnerabilities; no forced dependency upgrades were performed.

| Guarantee | Test | Type |
|---|---|---|
| Only strict bounded game facts serialize | telemetry-contract.test.ts | unit |
| Start/terminal once; actual health loss, economy and tower composition | gameplay-telemetry.test.ts | integration with pure game operations |
| Retry/restore/missing terminal differ; pauses and background intervals excluded | gameplay-telemetry.test.ts | unit |
| Stable IDs on retry, 64-event/48-hour bounds, expiry, overflow, scope purge, abort, storage failure | telemetry-outbox.test.ts | storage/transport integration |
| Exclusive opt-in, public/unconfigured off, revocation fallback | telemetry-controller.test.ts, telemetry-policy.test.ts | integration |
| Disclosure, beta-only timer and unavailable-storage warning | telemetry-settings.test.ts | unit |
| Public settings/off/play/reload preserve checkpoint and make no analytics requests | e2e/telemetry.spec.ts | browser |

General and security reviews found the revocation issue; fixed before GREEN completion. Cloud projects are unconfigured. Tests/builds do not establish real provider ingestion, native first-launch offline behavior, force-stop durability, or live project privacy settings.

Browser result: full gameplay run passed 32 existing tests; new telemetry test initially failed because Playwright's `toBeDisabled` matcher does not apply to `<option>`. Checking the actual `disabled` DOM property fixed it; focused telemetry rerun passed 1/1. Both options had correctly been disabled throughout. All 33 browser journeys are verified across those runs.

## Inherited CI runner fix

- Baseline run 42493022068 failed before project tests because `sdkmanager` was not on `PATH` on the Ubuntu 24.04 runner. The runner image exposes the Android SDK under `ANDROID_HOME`; both beta and publisher build steps now call the pinned SDK command-line tools path via `"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"`.
- Local evidence: `ANDROID_HOME=/home/ubuntu/Android/Sdk /home/ubuntu/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --version` completed successfully and reported 1.0.16261425. `npm run test:release` passed (37 tests). No release step was run.

## PostHog layer

- RED checkpoint `7ac308f` (original `a6bc3c0`, rebased while unpublished to inherit foundation CI path fix): missing adapter module and ignored native `allowed()` gate fail focused tests.
- GREEN: `npm run test:coverage`: 380 tests pass; 99.52% lines, 94.19% branches, 95.95% functions, 96.89% statements. Adapter tests assert exact anonymous payload, stable UUID/time, EU-only config, explicit IP-discard confirmation, extra-field rejection, abort propagation and HTTP retry/drop behavior.
- Native runtime tests cover pending identity, `.beta` success, public package denial, and failed bridge lookup. `npm run build`, Capacitor sync and unsigned `assembleBeta testBetaUnitTest` pass on JDK 17/SDK 34.
- General/security review: no critical/high findings. Live account IP discard, zero-spend limits and ingestion are unverified. Non-native beta bundles rely on the explicit build channel; never publish configured beta fixtures as public builds.
- `node scripts/build-telemetry-fixture.mjs && playwright test --config playwright.telemetry.config.ts`: 2/2 browser tests pass with real timers. All requests intercepted with synthetic config. Tests verify no capture before selection, real start/terminal summaries, pause exclusion, save/reload, same IDs across offline/restart/reconnect, and Off purge. Virtual-clock test timing was replaced after exposing modal/timer hangs; no gameplay change was needed.

## GameAnalytics layer

- RED checkpoint `8884168`: focused suites failed because the client adapter, server mapper and relay did not exist.
- GREEN: `npm run test:coverage`: 398 tests pass; 99.45% lines, 94.51% branches, 96.16% functions, 97.14% statements. Server code reaches 98.86% lines / 94.82% branches. Tests cover 18 GA mapping/transport/relay cases including strict body/epoch/origin, generic identifiers, no fabricated failures, fixed cardinality, HMAC bytes, missing starts, row budget, expiry, CORS/methods, rate reset and concurrent requests.
- Review regressions: a partial HTTP 400 originally failed to reserve quota; fixed and tested. A subsequent reserve-per-attempt implementation exhausted a run after repeated transient errors; RED reproduced 422 on the second retry with a two-row budget. Pending ID/digest reservations now charge logical quota once, while every physical attempt consumes a separate daily network budget. Four 503 responses then success pass; 1,000 transient submissions exhaust daily quota with retryable 429, and UTC rollover restores retryability.
- `npm run test:telemetry`: all 3 synthetic/intercepted provider browser tests pass. The GA test verifies relay epoch/no credentials, real wave start/end, pending terminal queue, provider-change purge, fresh PostHog attempt and Off.
- TypeScript/Vite build, Capacitor sync, unsigned Android `assembleBeta testBetaUnitTest`, and production dependency audit pass. Server-only retry fixes were subsequently covered by unit tests and typecheck; they are not bundled in Android assets.
- A Node 24.22.2 runner using synthetic configuration successfully bound loopback and returned HTTP 200 to an allowed-origin OPTIONS request, then was stopped. No remote relay deployment occurred.
- Official vendor public sandbox credentials were used only in transient process environment (never committed, printed or bundled) to submit 20 synthetic rows from the actual mapper. Init and events returned HTTP 200. This verifies API acceptance of generic hardware/ephemeral session fields; no owned account, real game data, dashboard, native delivery or force-stop durability was verified.
- Final general/security reviews: no critical/high issue remains in the source-only, loopback scope. `server/README.md` records private authenticated ingress requirements, in-memory cap/dedup limitations, free dashboard mapping omissions and raw-clock/ephemeral-user semantics.
