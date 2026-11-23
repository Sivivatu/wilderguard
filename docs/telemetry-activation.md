# Gameplay telemetry activation and local verification

Gameplay telemetry is an optional beta feature. The same collector feeds one selected provider (Off, PostHog, or GameAnalytics); Sentry has its own separate controls. Release builds keep gameplay telemetry disabled. Queue delivery is best effort, so a missing terminal may mean interruption, expiry, overflow, or app termination. It must not be counted as a defeat or an explicit quit.

## Active connection — 23 November 2026

GameAnalytics is configured in the [private beta](https://remote-dev.emperor-quillback.ts.net:8444/). Refresh it on your approved Tailscale connection, then choose **Settings → Gameplay statistics → GameAnalytics**. The keys stay on the relay server. The current readiness section below distinguishes verified API acceptance from dashboard and device checks.

## Test the additions locally

Run the isolated browser integration suite:

```sh
npm run test:telemetry
```

This builds a synthetic telemetry fixture and runs the browser journeys with provider requests intercepted. It verifies the consent gate, wave start and terminal summaries, offline/restart/reconnect queue behavior, provider-change purge, and Off behavior. The fixture credentials and endpoint are synthetic: this proves client mapping and queue behavior, not vendor ingestion. `npm run test:reporting` independently verifies the Sentry browser path.

To inspect a real configured beta build locally, use a private ignored `.env.local` file and never paste its contents into chat, logs, screenshots, a commit, or an APK shared outside the intended testers. Keep the provider project settings and configuration epoch aligned with this build. For PostHog, confirm the EU project discards IP data before enabling its explicit IP-discard confirmation. For GameAnalytics, the client needs only the approved private relay URL and matching epoch; keep the GameAnalytics game secret on the relay host. Do not configure both providers as active at once.

Start the local web build with `npm run dev`, choose the provider in the game's telemetry setting, accept the disclosure, then play through at least one wave terminal. The configured beta web build is also privately playable at [the beta test site](https://remote-dev.emperor-quillback.ts.net:8444/). The [PostHog project](https://eu.posthog.com/project/360532) and [dashboard](https://eu.posthog.com/project/360532/dashboard/1136395) are the verified EU destinations. Check the project's live event explorer for `wilderguard_wave_start_v1` and `wilderguard_wave_end_v1` events. Compare event IDs, timestamps, outcome, wave, currency, lives, and tower counts against the local run. Also confirm that a fresh unselected profile sends no provider requests, Off stops subsequent requests and purges queued events, and switching providers does not send old queued events to the new provider. A successful local HTTP response alone is not evidence that the event appeared in the provider project.

For a real GameAnalytics beta test, refresh the private beta site, connect with an approved human Tailscale identity, then choose **GameAnalytics** under **Gameplay statistics** and accept the disclosure. Play through a wave and check its start and terminal in the relay/upstream evidence; use the owned GameAnalytics project event explorer to confirm dashboard visibility. The automated run verified API acceptance but did not inspect the dashboard.

Use the browser network panel to confirm requests go only to the selected provider or private relay. Do not capture or share request headers that contain project configuration. Inspect event properties against the allowlisted contract; there should be no name, contact detail, location, touch history, save, screenshot, replay, or persistent player/device identifier. Provider IP handling and ingress access logs are separate from event-property checks.

For offline behavior, start a wave while disconnected, finish it, force-close the app, reopen without connectivity, then restore connectivity. Verify that still-valid queued events retry with their original IDs and timestamps, and check the project for acceptance. Do not assume an app killed during an active wave can report a terminal event. The browser fixture covers intercepted persistence; native force-stop/reconnect and real provider ingestion require the intended Android device and configured projects. Vite preview's cache behavior with `Vary: Origin` can obscure local-origin checks; when that happens, serve the built files directly instead:

```sh
npm run build
python3 -m http.server 4173 --directory dist
```

This avoids the preview cache interaction for the test; it does not validate the relay or provider by itself.

## Current readiness — 23 November 2026

As of 23 November 2026, the PostHog EU project and dashboard are available. Live PostHog gameplay events and one synthetic Sentry error were retrieved successfully. The observed PostHog IP and country properties were empty. Offline reload, reconnection, and delivery were verified against a static local server. These checks establish web ingestion for the tested configuration; they do not prove native Android delivery or force-stop durability.

The user confirmed that the GameAnalytics game is configured for child-directed privacy and is on the free plan. The protected GameAnalytics secret remains only in `/home/ubuntu/.config/wilderguard-relay/server.env`; keep its contents out of chats, logs, client artifacts and Git. The user systemd relay is enabled and running from `/home/ubuntu/.local/share/wilderguard-relay/current`, with private SQLite state at `/home/ubuntu/.local/share/wilderguard-relay/state`. Tailscale Serve privately exposes HTTPS `/telemetry` on port 8443; the beta site remains on port 8444.

Live Playwright validation used the local beta client, the real relay, and the real GameAnalytics upstream. It sent wave 1 start, clear terminal, and wave 2 start while offline; the queued wave 2 start survived browser reload and arrived after reconnect. All three GameAnalytics `/events` submissions returned HTTP 200. The clear carried the expected archer count and `clear` outcome, initial Off and opt-out purge checks passed, and selecting GameAnalytics produced zero PostHog requests. After relay restart, replay of the first event got an HTTP 200 cached acknowledgement without increasing physical event rows (21 before and after), confirming relay-side deduplication for that replay. This validates the tested browser payload, offline queue, relay, and upstream acceptance; it does not establish exactly-once processing by GameAnalytics or dashboard visibility. The project event explorer was not inspected.

The test server's own Tailscale identity is tagged and is not on the approved human tester allowlist. The browser harness forwarded requests over trusted loopback with the approved test identity; a separate HTTPS forged-identity probe returned HTTP 403. This does not test human-device Tailnet authentication. Native Android ingestion, first-launch offline behavior, native force-stop/restart/reconnect, and delivery during app termination remain unverified. The organization has a paid PostHog account, but its organization-wide Product Analytics spending cap is $0; billing settings were not changed. Do not enable paid add-ons or raise the cap as part of validation.

### GameAnalytics activation

The GameAnalytics activation steps are complete for the configured beta environment. Setup details and secret-handling requirements are in [the relay setup](../server/README.md). The user confirmed child-directed privacy and the free plan. The relay is private and enabled; do not move its game secret into `.env.local`, `VITE_*`, client code, browser storage, or an APK. API acceptance is verified; check the project's event explorer separately before claiming dashboard visibility.

See [implementation and privacy contract](gameplay-telemetry.md), [GameAnalytics relay configuration and mapping](../server/README.md), and [TDD and validation evidence](testing/telemetry-activation.tdd.md). Sentry's separate readiness record is in [error-reporting](error-reporting.md).
