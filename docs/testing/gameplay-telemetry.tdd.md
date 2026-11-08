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
