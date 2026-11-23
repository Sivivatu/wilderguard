# Gameplay statistics switch and private browser ingress

## PRD

The owner requests one On/Off setting. An explicit On sends the same allowlisted game facts to both PostHog and GameAnalytics; Off stops and purges both. Previous single-provider consent must not silently expand. The private beta browser must upload through its actual HTTPS relay route, without a loopback identity test harness.

## Architecture and system design

Keep one collector and a bounded v2 outbox. Each entry has one typed event and a pending destination set. Each destination has an independent delivery lane, and every acknowledgement is persisted before clearing that destination. Keep 64-event/48-hour bounds and abort both lanes on opt-out or storage failure. Canonical build/project scope changes require new consent. Both adapters must be configured before On is available.

The embedded browser's authenticated Tailscale node is tagged, so Serve supplies no human login. Keep the exact human allowlist and optionally approve a specific stable node ID. For a missing human login only, resolve the single Serve-supplied forwarded IP through the fixed local Tailscale whois socket; require an exact stable node ID match. Reject malformed/ambiguous forwarding, lookup failure and unapproved identities before reading a body. Do not forward identity/IP metadata to analytics.

## Technical specification

Use v2 consent `off|on` and v2 `{event,pending}` queue storage. Remove the provider picker and disclose both destinations. Keep beta/public/native gates and independent Sentry controls. Treat relay 401/403 as bounded retryable delivery failures rather than discarding still-consented reports. Keep credentials server-only. Node grants authorize the approved host, not each individual using it; host and Tailnet access remain the authentication boundary.

## Task list

1. Record RED tests for dual consent/delivery/UI and approved tagged-node ingress.
2. Implement and review the independent client and relay changes.
3. Configure only the known embedded-browser node, deploy privately and test actual HTTPS preflight/POST with spoofing checks.
4. Play a real wave with On, verify both submissions and selective retry, then Off; record dashboard/native evidence separately.

## Validation and baseline

The relay had only the three previous validation events after the user's waves. A real embedded-browser OPTIONS request failed CORS because authentication rejected it before CORS handling. A temporary same-host Serve probe showed the tagged browser has no login header, and Serve overwrites spoofed forwarded IP/login headers. Local whois resolves the authenticated peer to its stable node ID. The temporary probe was removed. The earlier loopback validation did not cover this path.

Run focused unit/integration tests, coverage, provider browser tests, build/release checks, and the actual private HTTPS browser journey. Use no public relay, paid service, signed release or source-map upload.
