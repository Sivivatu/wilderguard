# Gameplay telemetry activation and local verification

Gameplay telemetry is an optional beta feature. The same collector feeds one selected provider (Off, PostHog, or GameAnalytics); Sentry has its own separate controls. Release builds keep gameplay telemetry disabled. Queue delivery is best effort, so a missing terminal may mean interruption, expiry, overflow, or app termination. It must not be counted as a defeat or an explicit quit.

## Test the additions locally

Run the isolated browser integration suite:

```sh
npm run test:telemetry
```

This builds a synthetic telemetry fixture and runs the browser journeys with provider requests intercepted. It verifies the consent gate, wave start and terminal summaries, offline/restart/reconnect queue behavior, provider-change purge, and Off behavior. The fixture credentials and endpoint are synthetic: this proves client mapping and queue behavior, not vendor ingestion. `npm run test:reporting` independently verifies the Sentry browser path.

To inspect a real configured beta build locally, use a private ignored `.env.local` file and never paste its contents into chat, logs, screenshots, a commit, or an APK shared outside the intended testers. Keep the provider project settings and configuration epoch aligned with this build. For PostHog, confirm the EU project discards IP data before enabling its explicit IP-discard confirmation. For GameAnalytics, the client needs only the approved private relay URL and matching epoch; keep the GameAnalytics game secret on the relay host. Do not configure both providers as active at once.

Start the local web build with `npm run dev`, choose the provider in the game's telemetry setting, accept the disclosure, then play through at least one wave terminal. The configured beta web build is also privately playable at [the beta test site](https://remote-dev.emperor-quillback.ts.net:8444/). The [PostHog project](https://eu.posthog.com/project/360532) and [dashboard](https://eu.posthog.com/project/360532/dashboard/1136395) are the verified EU destinations. Check the project's live event explorer for `wilderguard_wave_start_v1` and `wilderguard_wave_end_v1` events. Compare event IDs, timestamps, outcome, wave, currency, lives, and tower counts against the local run. Also confirm that a fresh unselected profile sends no provider requests, Off stops subsequent requests and purges queued events, and switching providers does not send old queued events to the new provider. A successful local HTTP response alone is not evidence that the event appeared in the provider project.

Use the browser network panel to confirm requests go only to the selected provider or private relay. Do not capture or share request headers that contain project configuration. Inspect event properties against the allowlisted contract; there should be no name, contact detail, location, touch history, save, screenshot, replay, or persistent player/device identifier. Provider IP handling and ingress access logs are separate from event-property checks.

For offline behavior, start a wave while disconnected, finish it, force-close the app, reopen without connectivity, then restore connectivity. Verify that still-valid queued events retry with their original IDs and timestamps, and check the project for acceptance. Do not assume an app killed during an active wave can report a terminal event. The browser fixture covers intercepted persistence; native force-stop/reconnect and real provider ingestion require the intended Android device and configured projects. Vite preview's cache behavior with `Vary: Origin` can obscure local-origin checks; when that happens, serve the built files directly instead:

```sh
npm run build
python3 -m http.server 4173 --directory dist
```

This avoids the preview cache interaction for the test; it does not validate the relay or provider by itself.

## Current readiness

As of 20 November 2026, the PostHog EU project and dashboard are available. Live PostHog gameplay events and one synthetic Sentry error were retrieved successfully. The observed PostHog IP and country properties were empty. Offline reload, reconnection, and delivery were verified against a static local server. These checks establish web ingestion for the tested configuration; they do not prove native Android delivery or force-stop durability.

GameAnalytics remains unverified for owned-project ingestion. Credential requests timed out; the user service unit at `/home/ubuntu/.config/systemd/user/wilderguard-relay.service` is installed but currently inactive because `/home/ubuntu/.config/wilderguard-relay/server.env` is absent. The runtime path is `/home/ubuntu/.local/share/wilderguard-relay/current`; the private SQLite state directory is `/home/ubuntu/.local/share/wilderguard-relay/state`. A temporary synthetic-only configuration was used to verify that the service starts, an authenticated loopback OPTIONS request succeeds, and a second process is rejected by the `flock`; the unit was stopped and that synthetic environment/database removed. No GA credentials or state remain, and no GA cloud traffic was generated. The organization is on a paid PostHog account, but its organization-wide Product Analytics spending cap is $0; billing settings were not changed. Do not enable paid add-ons or raise the cap as part of validation.

### GameAnalytics activation after credentials are available

The missing inputs are matching GameAnalytics game key and secret for the intended environment, a reviewed project privacy configuration, and the exact approved Tailscale login(s) allowed to reach the relay. Keep the secret only in the protected server environment file; never put it in `.env.local`, `VITE_*`, client code, browser storage, or an APK. Set the server-only fields listed in [the relay setup](../server/README.md), including project epoch, exact allowed origins, privacy and private-ingress confirmations, state path, and allowed Tailscale identities. Install the versioned relay source under the runtime path above, create the state directory with owner-only access, and protect `server.env` with owner-only read/write permissions. Configure and review a private Tailscale Serve HTTPS route to loopback `/telemetry`, then start the existing unit with `systemctl --user enable --now wilderguard-relay.service`; confirm its active status and test an approved request and a forged-identity rejection before building a client that points to it. Then select GameAnalytics in one beta client and verify actual sandbox/project ingestion. None of these credential-dependent steps is complete as of this readiness check; the unit remains inactive.

Private ingress authentication was checked on the host with a synthetic upstream: a trusted loopback request with the owner identity returned HTTP 200, while a request through Tailscale HTTPS port 8443 that forged the same identity returned HTTP 403. The temporary 8443 proxy and stub were removed afterward. This verifies header stripping/authentication for that host configuration; it does not establish an active remote GameAnalytics relay or provider ingestion.

See [implementation and privacy contract](gameplay-telemetry.md), [GameAnalytics relay configuration and mapping](../server/README.md), and [TDD and validation evidence](testing/telemetry-activation.tdd.md). Sentry's separate readiness record is in [error-reporting](error-reporting.md).
