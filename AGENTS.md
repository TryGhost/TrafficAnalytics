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
- **Batch mode (default in dev/prod)**: filter bot traffic, publish non-bot raw events to the Pub/Sub topic, and return `202`; enrichment + forwarding happen later in the worker app. This is the `dev:batch` Compose profile (`analytics-service` + `worker`).
- **Proxy mode (synchronous)**: no topic set — bot traffic is filtered, then non-bot requests are enriched inline and proxied straight to `PROXY_TARGET` (`/v0/events`). This is the `dev:proxy` Compose profile (`analytics-service-proxy`).

See `docs/architecture.md` for a diagram and deeper detail, and `docs/deployment.md` for the CI/deploy pipeline.

## Architecture

Key modules under `src/`:
- **Entrypoints**: `server.ts` (selects app by `WORKER_MODE`), `src/app.ts` (ingest), `src/worker-app.ts` (worker).
- **Routes / handlers** (`src/routes/v1`, `src/handlers/page-hit-handlers.ts`): defines `POST /api/v1/page_hit`, chooses batch vs proxy strategy.
- **Plugins** (`src/plugins/`): `hmac-validation` (global `preValidation` HMAC check), `bot-detection` (page-hit `preHandler` bot filter), `timestamp` (records `serverReceivedAt` on request), `cors`, `logging`, `proxy` (local `/local-proxy` test endpoint), `worker-plugin` (batch worker lifecycle in the worker app).
- **Events** (`src/services/events/`): `publisher.ts` / `publisherUtils.ts` publish raw page hits to Pub/Sub; `subscriber.ts` consumes from a subscription. Uses `@google-cloud/pubsub`.
- **Batch worker** (`src/services/batch-worker/`): subscribes, transforms each message, batches, and flushes to Tinybird (`BATCH_SIZE`, `BATCH_FLUSH_INTERVAL_MS`).
- **Tinybird** (`src/services/tinybird/`): `client.ts` posts single or NDJSON-batch events to `{PROXY_TARGET}/v0/events?name=analytics_events`.
- **Transformations / schemas** (`src/transformations/page-hit-transformations.ts`, `src/schemas/v1/`): Zod schemas for the request, raw and processed events; build the raw payload from the request and transform raw → processed (user-agent parsing via `ua-parser-js`, referrer parsing via `@tryghost/referrer-parser`, user signature, bot filtering).
- **Validation** (`src/schemas/validation.ts`): compiles the Zod schemas to ajv validators, and provides the Fastify type provider.
- **Salt store** (`src/services/salt-store/`): adapter pattern (`memory`, `file`, `firestore`) behind `ISaltStore`, selected by `SALT_STORE_TYPE`.
- **User signature** (`src/services/user-signature/`): SHA-256 of daily-rotating salt + site UUID + IP + user agent.
- **Instrumentation** (`src/utils/instrumentation.ts`): OpenTelemetry setup — Jaeger (default) or Google Cloud Trace.

### Schemas & Validation

Schemas are written in Zod (`src/schemas/v1/`), but nothing validates with Zod at runtime. `src/schemas/validation.ts` converts each schema to JSON Schema once at boot via `z.toJSONSchema` and compiles it with ajv, so the per-request path is generated code rather than Zod's interpreter. Zod is there for authoring and type inference (`z.infer`, and the `ZodTypeProvider` that types route handlers).

Two ajv instances, because they are used for different things:
- `requestAjv` — route validation. Mirrors Fastify's own options (`coerceTypes: 'array'`, `useDefaults`, `removeAdditional`), since HTTP query params and headers arrive as strings and need coercing.
- `dataAjv` — `createValidator`, used off the HTTP path (the batch worker validating Pub/Sub messages). Coercion is off: that data is already typed JSON, and coercing it rewrites a null into an empty string to satisfy the string branch of a union.

Things to know when editing a schema:
- **Never use `.transform()` or `.pipe()` in a schema.** JSON Schema cannot express them and `z.toJSONSchema` drops them without error, so the transform silently stops running. Do that work in a preHandler instead — `resolveEventId` in `page-hit-request.ts` is the pattern. `.default()` is fine; it survives as `default` and ajv's `useDefaults` applies it.
- **`z.guid()`, not `z.uuid()`.** We only require UUID-shaped values; `z.uuid()` enforces RFC version and variant nibbles and would reject IDs real Ghost sites send.
- **`z.iso.datetime({precision: 3})`.** Without the precision, offsets and second-granularity timestamps are accepted; we only store the canonical `toISOString()` shape.
- `test/unit/schemas/validation.test.ts` guards the Zod ↔ ajv projection. Nothing in the type system keeps the two in step, so add a case there when adding a schema construct that is new to the codebase.

### Salt Store

Adapter pattern behind `ISaltStore`, selected by `SALT_STORE_TYPE` (see `SaltStoreFactory.ts`):
- Code default is `memory` (in-process). Docker Compose dev/test override it to `firestore`.
- Adapters: `memory`, `file` (`SALT_STORE_FILE_PATH`, default `./data/salts.json`), `firestore` (requires `GOOGLE_CLOUD_PROJECT` + `FIRESTORE_DATABASE_ID`; used in dev via the emulator and in production).

## Request Flow

**Batch mode (default):**
1. `POST /api/v1/page_hit` reaches the ingest app (`src/app.ts`).
2. Global HMAC plugin validates the signature/timestamp in the URL params and strips them (skipped if `HMAC_SECRET` unset).
3. Fastify validates the body/query/headers, then the `bot-detection` `preHandler` returns `202` for bot traffic without publishing it. The route `preHandler` (`populateAndTransformPageHitRequest`) applies payload defaults for non-bot requests.
4. The handler builds non-bot requests into raw payloads and publishes them to `PUBSUB_TOPIC_PAGE_HITS_RAW`, then responds `202`.
5. The worker app consumes from `PUBSUB_SUBSCRIPTION_PAGE_HITS_RAW`, enriches each event (user agent, referrer, user signature), defensively filters any bot events that bypassed the API, batches, and posts to Tinybird `/v0/events`.

**Proxy mode (synchronous — no Pub/Sub topic set):**
1–3 as above.
4. The `bot-detection` plugin returns `202` for bot traffic; the handler enriches non-bot requests inline (user agent, referrer, user signature) and proxies them to `PROXY_TARGET` (default `http://localhost:3000/local-proxy`).

## Environment Variables

### Core / run mode
- `PORT` - Server port (default: 3000)
- `LISTEN_HOST` - Server listen host (default: 0.0.0.0)
- `WORKER_MODE` - When `'true'`, `server.ts` runs the worker app (Pub/Sub consumer) instead of the ingest app (default: unset)
- `PROXY_TARGET` - Upstream URL to forward requests. Used directly in proxy mode, and as the Tinybird base URL by the worker (`/v0/events` is stripped/re-added). Default: `http://localhost:3000/local-proxy`
- `TINYBIRD_TRACKER_TOKEN` - Bearer token for authenticating with Tinybird
- `TINYBIRD_WAIT` - Pass `wait=true` parameter to Tinybird, which makes it respond only after data is ingested (default: false)
- `LOG_LEVEL` - Logging level (default: info)
- `LOG_FORMAT` - Production log shape: `gcp` (Cloud Logging structured fields) or `json` (plain pino). Defaults to `gcp` when `K_SERVICE`, `GAE_SERVICE` or `GOOGLE_CLOUD_PROJECT` is set, otherwise `json`. Ignored when `NODE_ENV=development`, which always uses pretty logs.

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
- `ENABLE_BOT_DETECTION_HEADER` - When set to 'true', filtered bot responses include `x-ghost-bot-detected: true` (default: false; header omitted)

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

Coverage is measured across the unit **and** integration suites together and enforced in CI. CI runs `yarn _test` (inside the test container), which performs the type check and then the combined coverage run (`vitest.config.coverage.ts`), failing if line/function/branch/statement coverage drops below the thresholds set there. Locally, `yarn test` wraps the same thing in Docker; `yarn test:unit` / `yarn test:integration` remain for fast per-suite iteration.

## Development Notes

- The project uses Fastify for high-performance HTTP handling
- Zod for schemas, compiled to ajv validators (see Schemas & Validation above)
- TypeScript with strict mode enabled
- Docker-first development approach
- All external dependencies are kept in package.json (not bundled in build)
