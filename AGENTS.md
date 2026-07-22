# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TrafficAnalytics is a web analytics proxy service for Ghost that processes and enriches traffic data before forwarding it to Tinybird's analytics API. It parses user agents, extracts referrer information, and generates privacy-preserving user signatures.

## Key Commands

###
- `yarn build` - build TypeScript code
- `docker compose build` - Build docker image

### Development
- `yarn dev` - Start development server in Docker

### Testing
- `yarn test` - Run all tests in Docker
- `yarn test:unit` - Run unit tests in Docker
- `yarn test:integration` - Run integration tests in Docker
- `yarn test:e2e` - Run e2e tests in Docker

### Linting
- `yarn lint` - Run linter in Docker

## Run Modes

The same image runs in two roles, selected by `WORKER_MODE` (see `server.ts`):
- **Ingest app** (`WORKER_MODE` unset — `src/app.ts`): the Fastify HTTP server that receives `POST /api/v1/page_hit`.
- **Worker app** (`WORKER_MODE=true` — `src/worker-app.ts`): a Pub/Sub consumer that enriches events and forwards them to Tinybird. Exposes only health endpoints (`/`, `/health`).

The ingest app has two request strategies (see `src/handlers/page-hit-handlers.ts`), chosen by whether `PUBSUB_TOPIC_PAGE_HITS_RAW` is set:
- **Batch mode (default in dev/prod)**: publish the raw event to the Pub/Sub topic and return `202`; enrichment + forwarding happen later in the worker app. This is the `dev:batch` Compose profile (`analytics-service` + `worker`).
- **Proxy mode (synchronous)**: no topic set — the request is enriched inline and proxied straight to `PROXY_TARGET` (`/v0/events`). This is the `dev:proxy` Compose profile (`analytics-service-proxy`).

See `docs/architecture.md` for a diagram and deeper detail, and `docs/deployment.md` for the CI/deploy pipeline.

## Architecture

Key modules under `src/`:
- **Entrypoints**: `server.ts` (selects app by `WORKER_MODE`), `src/app.ts` (ingest), `src/worker-app.ts` (worker).
- **Routes / handlers** (`src/routes/v1`, `src/handlers/page-hit-handlers.ts`): defines `POST /api/v1/page_hit`, chooses batch vs proxy strategy.
- **Plugins** (`src/plugins/`): `hmac-validation` (global `preValidation` HMAC check), `timestamp` (records `serverReceivedAt` on request), `cors`, `logging`, `proxy` (local `/local-proxy` test endpoint), `worker-plugin` (batch worker lifecycle in the worker app).
- **Events** (`src/services/events/`): `publisher.ts` / `publisherUtils.ts` publish raw page hits to Pub/Sub; `subscriber.ts` consumes from a subscription. Uses `@google-cloud/pubsub`.
- **Batch worker** (`src/services/batch-worker/`): subscribes, transforms each message, batches, and flushes to Tinybird (`BATCH_SIZE`, `BATCH_FLUSH_INTERVAL_MS`).
- **Tinybird** (`src/services/tinybird/`): `client.ts` posts single or NDJSON-batch events to `{PROXY_TARGET}/v0/events?name=analytics_events`.
- **Transformations / schemas** (`src/transformations/page-hit-transformations.ts`, `src/schemas/v1/`): build the raw payload from the request and transform raw → processed (user-agent parsing via `ua-parser-js`, referrer parsing via `@tryghost/referrer-parser`, user signature, bot filtering).
- **Salt store** (`src/services/salt-store/`): adapter pattern (`memory`, `file`, `firestore`) behind `ISaltStore`, selected by `SALT_STORE_TYPE`.
- **User signature** (`src/services/user-signature/`): SHA-256 of daily-rotating salt + site UUID + IP + user agent.
- **Instrumentation** (`src/utils/instrumentation.ts`): OpenTelemetry setup — Jaeger (default) or Google Cloud Trace.

### Salt Store

Adapter pattern behind `ISaltStore`, selected by `SALT_STORE_TYPE` (see `SaltStoreFactory.ts`):
- Code default is `memory` (in-process). Docker Compose dev/test override it to `firestore`.
- Adapters: `memory`, `file` (`SALT_STORE_FILE_PATH`, default `./data/salts.json`), `firestore` (requires `GOOGLE_CLOUD_PROJECT` + `FIRESTORE_DATABASE_ID`; used in dev via the emulator and in production).

## Request Flow

**Batch mode (default):**
1. `POST /api/v1/page_hit` reaches the ingest app (`src/app.ts`).
2. Global HMAC plugin validates the signature/timestamp in the URL params and strips them (skipped if `HMAC_SECRET` unset).
3. `preHandler` (`populateAndTransformPageHitRequest`) applies payload defaults and validates body/query/headers.
4. The handler builds the raw payload and publishes it to `PUBSUB_TOPIC_PAGE_HITS_RAW`, then responds `202`.
5. The worker app consumes from `PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW`, enriches each event (user agent, referrer, user signature), filters bot traffic, batches, and posts to Tinybird `/v0/events`.

**Proxy mode (synchronous — no Pub/Sub topic set):**
1–3 as above.
4. The handler enriches the request inline (user agent, referrer, user signature), filters bot traffic, and proxies it to `PROXY_TARGET` (default `http://localhost:3000/local-proxy`).

## Environment Variables

### Core / run mode
- `PORT` - Server port (default: 3000)
- `LISTEN_HOST` - Server listen host (default: 0.0.0.0)
- `WORKER_MODE` - When `'true'`, `server.ts` runs the worker app (Pub/Sub consumer) instead of the ingest app (default: unset)
- `PROXY_TARGET` - Upstream URL to forward requests. Used directly in proxy mode, and as the Tinybird base URL by the worker (`/v0/events` is stripped/re-added). Default: `http://localhost:3000/local-proxy`
- `TINYBIRD_TRACKER_TOKEN` - Bearer token for authenticating with Tinybird
- `TINYBIRD_WAIT` - Pass `wait=true` parameter to Tinybird, which makes it respond only after data is ingested (default: false)
- `LOG_LEVEL` - Logging level (default: info)

### Pub/Sub (batch mode)
- `PUBSUB_TOPIC_PAGE_HITS_RAW` - Topic the ingest app publishes raw events to. If set, the ingest app runs in batch mode; if unset, it runs in synchronous proxy mode.
- `PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW` - Subscription the worker app consumes from
- `PUBSUB_EMULATOR_HOST` - Pub/Sub emulator address for local dev/test (e.g. `pubsub:8085`)
- `GOOGLE_CLOUD_PROJECT` - GCP project ID used for Pub/Sub and Firestore
- `BATCH_SIZE` - Worker flush batch size (default: 50)
- `BATCH_FLUSH_INTERVAL_MS` - Worker flush interval in ms (default: 1000)

### Salt store
- `SALT_STORE_TYPE` - Salt store implementation: `memory` | `file` | `firestore` (code default: memory; Docker Compose dev/test default: firestore)
- `SALT_STORE_FILE_PATH` - Path for the `file` salt store (default: `./data/salts.json`)
- `FIRESTORE_DATABASE_ID` - Firestore database ID (required for the firestore salt store)
- `FIRESTORE_EMULATOR_HOST` - Firestore emulator address for local dev/test (e.g. `firestore:8080`)
- `ENABLE_SALT_CLEANUP_SCHEDULER` - Enable automatic daily salt cleanup (default: true, set to 'false' to disable)
- `FIRESTORE_CLEANUP_BATCH_SIZE` - Number of Firestore documents to delete per cleanup loop (default: 500, max: 500)

### Security & networking
- `TRUST_PROXY` - Enable trust proxy to resolve client IPs from X-Forwarded-For headers (default: true, set to 'false' to disable)
- `HMAC_SECRET` - Secret key for HMAC validation (Optional. Disabled if missing.)
- `HMAC_VALIDATION_LOG_ONLY` - When set to 'true', HMAC validation failures are logged but requests are not rejected (default: false)

### Tracing (OpenTelemetry)
- `OTEL_TRACE_EXPORTER` - OpenTelemetry trace exporter type: 'jaeger' (default) or 'gcp' for Google Cloud Trace
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` - Custom OTLP traces endpoint (default: http://jaeger:4318/v1/traces)
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` - Custom OTLP metrics endpoint (default: http://jaeger:4318/v1/metrics)
- `K_SERVICE` - Automatically set by Cloud Run; when present, enables Google Cloud Trace

## Testing Approach

Tests use Vitest and follow the same directory structure as the source code. When adding new features:
- Create corresponding test files in the `test/` directory
- Use the existing test patterns for consistency
- Ensure all new code has test coverage
- Do not add constant timeouts to tests

## Development Notes

- The project uses Fastify for high-performance HTTP handling
- TypeScript with strict mode enabled
- Docker-first development approach
- All external dependencies are kept in package.json (not bundled in build)
