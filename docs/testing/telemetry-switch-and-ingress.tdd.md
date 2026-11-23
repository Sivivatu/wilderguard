# Dual-provider statistics and private browser ingress evidence

Source plan: [switch and ingress](../plans/telemetry-switch-and-ingress.md). Verified 23 November 2026.

The owner requires one On/Off setting, with On sending to both services. The reported failure was no GameAnalytics events from the private beta on port 8444. Real browser preflight failed because the tagged Tailscale host has no user-login header. Earlier loopback identity injection tested upstream acceptance but masked this ingress failure.

## Checkpoints and guarantees

- RED `9b96269`: focused eight-file Vitest invocation recorded 43 failed / 15 passed tests, plus the missing node lookup module. Failures exercised missing dual consent, independent delivery, UI and tagged-node ingress. Browser mock preflights were corrected before using E2E results.
- GREEN `17ae054`: versioned On/Off consent and one outbox entry with independent pending destinations; exact build/project scopes, legacy consent purge, per-provider acknowledgements, timeout/abort handling, native identity gate, and restricted local-node authorization.
- A live LocalAPI probe then required the fixed `Host: local-tailscaled.sock`. The fixture reproduced the omission (one failed / two passed); adding that fixed Host passed all 11 lookup/HTTP tests. This correction is included in GREEN.

| Guarantee | Test/evidence | Result |
|---|---|---|
| Fresh Off, identical events to both, exact config consent, legacy purge | `tests/telemetry-controller.test.ts`, `tests/telemetry-policy.test.ts` | PASS |
| Independent retry lanes, ACK race safety, restart selective retry, bounded expiry, abort even when transport ignores signal | `tests/telemetry-outbox.test.ts` | PASS |
| Single accessible On/Off, disclosure, pending native verification preserves beta queue, public identity purges | Settings/native unit tests and provider E2E suites | PASS |
| Strict loopback/user/node boundary, no fallback on rejected human, fixed local bounded Whois lookup, metadata stripped | `tests/gameanalytics-http.test.ts`, `tests/tailscale-node-lookup.test.ts` | PASS |
| Public builds send no gameplay events; ordinary play/save/render journeys work | `npm run test:e2e -- --workers=1` | 33 PASS |
| Dual start/terminal, pause time exclusion, each provider failing/reloading, Off purge | `npm run test:telemetry` plus corrected single-case rerun | 4 PASS |
| Independent Sentry notice/error scrub/offline/retry/opt-out | `npm run test:reporting` | 4 PASS |
| Full unit/integration and coverage | `npm run test:coverage` | 462 PASS; 96.12% statements, 93.98% branches, 96.03% functions, 98.96% lines |
| TypeScript, optimized web bundle, private map archive, offline cache | `npm run build` | PASS |
| Native packaging/Java checks | `npx cap sync android`; JDK 17 / SDK 34 `android/gradlew -p android assembleBeta testBetaUnitTest --no-daemon` | PASS; unsigned beta only, 5 app unit tests |
| Release workflow safety checks | `npm run test:release` | 37 PASS; no publication |

The first telemetry browser run had three passes and one failure from an assertion expecting Sentry configuration in a deliberately unconfigured fixture. Correcting that assertion and rerunning the affected case passed. This was a test setup issue; the independent configured Sentry suite passed separately. General/security reviews found no critical/high issue. A minor native UI limitation remains: Settings opened before package verification finishes may require reopening before the switch becomes available.

## Private deployment and real ingestion

- Relay immutable runtime: `71324b6914927d31`; beta static bundle: `0b06b4d706cba6a8`. Both remain private Tailscale Serve routes on ports 8443/8444. Existing server credentials stayed in the protected environment file and were checked absent from web artifacts and staged diffs. No maps, database or private archives entered the served bundle.
- Actual 8443 normal and spoofed-login/XFF/protocol preflights returned 200 with the exact beta origin. Serve overwrote the spoofed headers. Real browser wrong-epoch POST returned 409 with readable CORS response. Unit tests separately reject unapproved identities, malformed forwarding and lookup failures.
- A real embedded-browser wave sent start and clear terminal to both endpoints: four HTTP 200 responses. PostHog project 360532 query read-back confirmed the pair and shared attempt; terminal active time 17,749 ms, earned 48, spent 0, IP/country empty. Preparation spend is separate from terminal wave spend.
- Relay SQLite acknowledgements for those same IDs were 200, which the forwarding code only records after GameAnalytics `/events` HTTP 200. No identity/IP metadata is forwarded. The outbox emptied. The following wave with Off produced no additional provider traffic while Sentry remained On.

GameAnalytics dashboard authentication was unavailable in this environment (login screen), so chart visibility remains unverified. Native device ingestion, first-launch offline, force-stop/restart/reconnect and app-kill delivery remain unverified. Mock/browser tests and an unsigned build cannot establish those. Best-effort delivery does not guarantee exactly-once upstream processing, and missing terminals are unknown, not inferred defeats/quits. No billing setting, merge, release tag, signed APK or public publication was changed.
