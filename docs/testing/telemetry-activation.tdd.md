# Telemetry activation verification evidence

This record distinguishes local transport tests from real service evidence. See the [activation guide](../telemetry-activation.md), [shared contract](../gameplay-telemetry.md), and [relay requirements](../../server/README.md).

## Verified on 23 November 2026

- PostHog EU project and dashboard are available.
- Verified destinations: [PostHog project](https://eu.posthog.com/project/360532) and [dashboard](https://eu.posthog.com/project/360532/dashboard/1136395); configured beta web build: [private beta test site](https://remote-dev.emperor-quillback.ts.net:8444/).
- Live PostHog gameplay events and one synthetic Sentry error were retrieved from their projects. These were separate provider checks; the Sentry event does not validate gameplay event mapping.
- PostHog IP and country properties were empty in the inspected live events. The three successful live browser event UUIDs (including the queued offline start) were retrieved from the intended project, with the expected shared start/terminal attempt ID. A project persons query returned zero profiles.
- Offline reload, reconnect, and delivery passed against a static local server.
- The configured beta web build was served privately through Tailscale at `https://remote-dev.emperor-quillback.ts.net:8444/`.
- The organization uses a paid PostHog account, while the organization-wide Product Analytics spending cap is $0. No billing changes were made.
- The user confirmed the GameAnalytics game uses child-directed privacy settings and the free plan.
- The user systemd unit `/home/ubuntu/.config/systemd/user/wilderguard-relay.service` is enabled and running. Its protected configuration is `/home/ubuntu/.config/wilderguard-relay/server.env` (keep its contents out of chats, logs, client artifacts and Git); runtime is `/home/ubuntu/.local/share/wilderguard-relay/current`; private SQLite state is `/home/ubuntu/.local/share/wilderguard-relay/state`.
- Private Tailscale Serve exposes the relay at HTTPS `/telemetry` on port 8443. The beta site is separately served at [the private beta test site](https://remote-dev.emperor-quillback.ts.net:8444/).
- Live Playwright validation used the configured local beta client, the real relay, and the real GameAnalytics `/events` upstream. Since the test server's Tailscale identity is tagged and not on the approved human tester allowlist, the harness intercepted the browser HTTPS request and forwarded it over trusted loopback with the approved test identity. Wave 1 start, a clear terminal, and wave 2 start held offline across browser reload and delivered after reconnection all returned HTTP 200. The terminal carried the expected archer count and `clear` outcome; initial Off and opt-out purge passed; GameAnalytics selection made zero PostHog requests.
- After restarting the relay, replay of the first event returned a cached HTTP 200 acknowledgement without increasing physical event rows (21 before and after). A separate forged-identity HTTPS probe returned HTTP 403. This verifies the tested relay deduplication and ingress boundary; it does not prove exactly-once GameAnalytics processing or exercise human-device Tailnet authentication.
- The test confirms real API acceptance through the relay, not appearance in the owned GameAnalytics dashboard. The project event explorer was not inspected.

- Production HMAC `/init` authentication returned HTTP 200 with collection enabled and a valid server clock. Secure import stored server configuration with mode 0600; neither credential was printed or committed.
- `npm run build` passed for build `local-20261123`. The immutable private web release is `e270c426f83b103e`; served HTML matches the tested build. Scans found neither GameAnalytics credential in built/deployed files, and no source maps or private-key formats. No executable source changed for credential activation; the earlier code-validation baseline remains applicable.

## Still unverified

- Native Android delivery to either provider, including first launch without network, force-stop/restart while offline, and reconnect on the intended device.
- GameAnalytics event visibility in the owned project dashboard/event explorer.
- A real human-device Tailnet authentication request to the private relay.
- Account-level privacy and retention configuration beyond the explicitly observed PostHog event properties.
- Delivery during app termination or device storage failure. These are best-effort paths; interrupted or missing events must remain unknown.

## Implementation and regression validation

- RED checkpoints `5ba7fbc` and `c33b692` preceded the relay expiry/reservation fixes.
- GREEN: repeated `npm run test:coverage` passed all 420 tests: 99.49% lines, 93.87% branches, 96.35% functions, and 96.83% statements.
- Focused relay suites: 22 checks passed. Synthetic provider browser suite: 3 checks passed. Release workflow checks: 37 passed; no release or publication was performed.
- Unsigned `npm run android:beta` build and `testBetaUnitTest` passed with JDK 17 and Android SDK 34. No APK signing, upload, or release occurred.
- `npm run test:reporting`: 4 browser checks passed. The isolated baseline gameplay suite passed all 33 journeys in 2.5 minutes. Its initial run inherited the configured Sentry notice and clicks were blocked; explicitly blanked test environment values reproduced GREEN, and the final fixture builds into `artifacts/gameplay-fixture` so developer builds cannot overwrite its assets.
- A Vite preview cache interaction involving `Vary: Origin` was isolated; the static-server route was used for offline/reconnect validation so preview cache behavior would not be confused with relay/provider behavior.
- General and security reviews reported no critical/high findings in the reviewed implementation. The TDD history records and tests the idle-expiry/quota regression fixes.

## Repeatable local checks

`npm run test:telemetry` runs the synthetic fixture and intercepted browser journeys. It validates client behavior and does not contact or validate either provider account. For live validation, select one provider, accept disclosure, complete one wave, inspect the corresponding project for its start and terminal/mapped events, and compare the values with the run. Then repeat with connectivity disabled and restored, and verify stable IDs/timestamps and no cross-provider delivery. See the activation guide for the exact manual sequence and privacy checks.
