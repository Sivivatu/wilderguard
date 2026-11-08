# Private GameAnalytics relay

This is reviewable source, not a deployed service. The client adapter never receives the GameAnalytics game secret. The runner was tested on Node 24.22.2, which executes these TypeScript files directly. Start the local runner with `node scripts/run-gameanalytics-relay.ts` only after protected server environment configuration is available. No keys or `.env` contents belong in Git, logs, client bundles, APKs or published artifacts.

Required **server-only** environment:

| Variable | Meaning |
|---|---|
| `GA_GAME_KEY`, `GA_GAME_SECRET` | Matching sandbox or production Collection API credentials from protected server configuration |
| `GA_PROJECT_EPOCH` | Safe project/config revision; must match the client epoch; rotate when changing project or credentials |
| `GA_ALLOWED_ORIGINS` | Comma-separated exact origins, for example native `https://localhost`; no wildcard or trailing slash |
| `GA_PRIVACY_REVIEWED=true` | Project's child-directed collection/privacy configuration has been reviewed |
| `GA_PRIVATE_RELAY_CONFIRMED=true` | Private ingress boundary has been reviewed; this flag does not authenticate callers |
| `GA_ENVIRONMENT` | `sandbox` by default; `production` only after separately verified readiness |
| `GA_RELAY_PORT` | Local loopback port, default 8787 |

The runner binds **127.0.0.1 only**. The HTTPS `/telemetry` endpoint needed by clients does not exist until a separate, authorized private deployment provides it. Do not expose this runner publicly. A remote deployment requires private network access or authenticated ingress, request limits, and reviewed logging that suppresses IP/user payloads. Origin/CORS and the public epoch header are filters, not authentication; any non-browser client can forge them. A client-embedded relay password would not fix this. Do not add one.

Upstream requests target only the official GA sandbox/production host. The relay signs the exact JSON bytes with server-held HMAC-SHA256, fetches init only for new runs, ignores remote flags/experiments, and honors collection disabled by the upstream. It never forwards client IP, cookies, device/user-agent strings, authorization headers, or unallowlisted input. GameAnalytics's country lookup therefore describes the relay's network, not player location. Access logs at the ingress are a separate deployment privacy responsibility.

Requests are bounded to 8 KB, strict versioned facts, 48-hour age (60-second future skew allowance), one concurrent upstream batch, 120 requests/minute, 480 expanded rows for unique events/run and 2,000 network-attempt rows/process/UTC day. Logical run quota is reserved once per stable event ID/digest before submission. The daily network bound counts every attempt, including potentially partial failures; exhaustion returns retryable HTTP 429 until the next UTC day. Permanent upstream failures (including potentially partial HTTP 400) are not retried; offline/timeout/429/5xx return a retry response. Client storage caps/expiry apply independently.

Deduplication/reservations remember 512 event IDs for at most 48 hours; run state holds 128 runs. These caches and limits are **in memory** and reset on process restart. Replicas have independent state. Lost upstream acknowledgements, eviction or restart can duplicate events or user starts; ambiguous retries consume the conservative daily network quota. Pending retries reuse their logical run reservation while it remains in the bounded cache. This source is suitable for a bounded private beta integration after readiness checks, not a guarantee of exactly-once ingestion or a publicly authenticated multi-tenant service. A scaled deployment needs shared persistent idempotency/rate state before activation. Public deployment and paid hosting are outside this change.

## Free event mapping

The supported API is documented at [Collection API setup](https://docs.gameanalytics.com/event-tracking-and-integrations/sdks-and-collection-api/api/setup) and [event schemas](https://docs.gameanalytics.com/event-tracking-and-integrations/sdks-and-collection-api/api/event-types), reviewed 8 November 2026.

- One `user` row starts each ephemeral run; a start maps to `Start:rN:wN`; observed clear/defeat map to `Complete`/`Fail`. `score` means remaining castle lives; `attempt_num` is the current run's retry count. Explicit abandon is a Design event. Missing starts/terminals remain missing; no synthetic Fail or session end is inferred from app termination.
- Each terminal emits 15 numeric Design metrics: cumulative lives lost, active milliseconds, remaining diamonds, sampled mean frame/update/render intervals, and nine tower type/level counts (zero counts included). Names contain only contract version, fixed metric, finite region/wave and outcome. No attempt IDs, timestamps or arbitrary values in names/dimensions.
- Resource Source is observed wave currency income, including refunds. Sink is preparation spend plus wave spend. Preparation refunds are not part of Source; this is attempt evidence, not a complete campaign ledger. Zero resource rows are skipped.
- Maximum normal full campaign: 476 rows (25 starts + 25 terminals with at most 18 rows each + one user). Retries or ambiguous delivery can exhaust the 480-row run budget; missing data must remain visible as unknown. No paid Health/FPS product, custom field export, raw PipelineIQ export, or subscription is enabled. See [limits](https://docs.gameanalytics.com/event-tracking-and-integrations/data-retention-and-limits/event-tracking-and-cardinality-limits) and [pricing](https://www.gameanalytics.com/pricing).

The full neutral contract stays in the local outbox. GA's free dashboards receive the mapped subset above; frame maximum, slow-frame/sample counts, original event/attempt IDs, balance label and preparation spend breakdown are not separate free dashboard metrics. PostHog receives the full allowlisted contract. GA Design metrics are custom numeric summaries, not a dedicated FPS dashboard. Design metrics do not support progression/custom-dimension filters, so region/wave/outcome are finite name components.

Privacy intentionally departs from GA's recommended persistent user/session model. `user_id` and `session_id` are random run IDs, `session_num=1`, hardware is generic `webgl 0`/`unknown`, and build labels are truncated to GA's 32-character field limit. Do not interpret GA user, retention or cohort counts as people or devices. Original event time is retained without server-clock correction; clock skew can affect ordering or cause expiry. The official public sandbox accepted 20 synthetic rows from this mapper with HTTP 200 on 8 November 2026. This proves API protocol acceptance only, not owned-project privacy/billing settings, dashboards, or native ingestion.
