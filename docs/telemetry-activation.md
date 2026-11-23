# Gameplay telemetry activation and local verification

Gameplay statistics are optional and Off by default. The single **Gameplay statistics** switch controls collection: On sends the same allowlisted facts to both PostHog and GameAnalytics; Off stops collection, aborts pending requests, and purges the local outbox. Both provider configurations must be valid before the switch is available. This is separate from Sentry error reporting. Public builds and release builds keep gameplay statistics disabled, and native delivery additionally requires the beta Android package ID.

The outbox holds at most 64 events for 48 hours. Each event has independent PostHog and GameAnalytics delivery lanes, acknowledgements, and retries. Delivery is best effort: interruption, expiry, overflow, or app termination can leave a missing terminal, which must not be counted as a defeat or explicit quit. Off cannot recall data already sent.

## Configure and use the beta

Use an ignored local `.env.local` for the beta web build. Configure both destinations: `VITE_POSTHOG_HOST=https://eu.i.posthog.com`, the public PostHog project token and epoch, and `VITE_POSTHOG_IP_DISCARD_CONFIRMED=true` only after confirming project IP discard; also set the approved private HTTPS `VITE_GAMEANALYTICS_RELAY` and matching `VITE_GAMEANALYTICS_EPOCH`. Keep the GameAnalytics secret on the relay host. Never put credentials in chat, logs, screenshots, Git, browser storage, or an APK. See [GameAnalytics relay configuration](../server/README.md).

Start the local web build with `npm run dev`, turn **Settings → Gameplay statistics** On, accept the disclosure, and play through a wave. The configured beta web build is privately served at [the beta test site](https://remote-dev.emperor-quillback.ts.net:8444/). Check the [PostHog EU project](https://eu.posthog.com/project/360532) and [dashboard](https://eu.posthog.com/project/360532/dashboard/1136395) for `wilderguard_wave_start_v1` and `wilderguard_wave_end_v1`; check the owned GameAnalytics event explorer for its mapped progression, resource, and Design metrics. Compare IDs, times, outcomes, wave, currency, lives, and tower counts where available. GameAnalytics free dashboards expose a mapped subset; PostHog receives the full allowlisted contract. HTTP acceptance alone does not establish dashboard visibility.

Use the browser network panel to confirm that On sends to both the EU PostHog capture endpoint and the private relay, while a fresh profile or Off sends to neither. Check that Off aborts pending requests and purges queued events. Do not capture or share request headers containing project configuration. Event properties exclude names, contact details, location, touch history, saves, screenshots, replay, and persistent player/device identifiers. Network addresses are visible to PostHog and the relay; PostHog GeoIP enrichment is disabled. Ingress access logs are a separate deployment privacy responsibility.

For offline behavior, queue events while disconnected, reload, then reconnect and confirm each provider lane retries with its original event ID and timestamp. Native force-stop/reconnect and real provider ingestion require the intended Android beta device and configured projects; browser mocks do not prove them. To avoid Vite preview cache interactions in local-origin checks, serve the built files directly:

```sh
npm run build
python3 -m http.server 4173 --directory dist
```

This does not validate relay ingress or provider ingestion by itself. The isolated browser suite can be run with `npm run test:telemetry`; its synthetic endpoints prove client mapping and queue behavior only. `npm run test:reporting` covers the separate Sentry browser path.

## Readiness — 23 November 2026

The PostHog EU project and dashboard are available. Earlier live PostHog gameplay events were retrieved and inspected events had empty IP and country properties. Offline reload, reconnection, and delivery were verified against a static local server. These checks do not prove native Android delivery or force-stop durability. The organization has a paid PostHog account; its organization-wide Product Analytics spending cap is $0, and billing settings were not changed.

The user confirmed that the GameAnalytics project has child-directed privacy settings and is on the free plan. Earlier live validation sent three events through the relay to the GameAnalytics `/events` API and received HTTP 200 responses. That browser harness supplied trusted identity over loopback; it did not establish real browser ingress. A later browser preflight against the deployed HTTPS relay on port 8443 returned HTTP 403. The prior loopback identity harness and forged-identity probe therefore do not prove an approved human browser can reach the relay. The updated dual-provider flow and this ingress path have not yet been verified after rollout. Mark live dual-delivery and browser ingress verification pending until retested.

GameAnalytics dashboard visibility was not checked. Human-device Tailnet authentication, native Android ingestion, first-launch offline behavior, native force-stop/restart/reconnect, and delivery during app termination remain unverified. Do not claim exactly-once provider processing: relay deduplication only covered the tested replay. Release CI blanks gameplay configuration; Sentry has independent controls and remains disabled in release builds.

See [implementation and privacy contract](gameplay-telemetry.md), [relay configuration and mapping](../server/README.md), [TDD and validation evidence](testing/telemetry-activation.tdd.md), and [Sentry readiness](error-reporting.md).
