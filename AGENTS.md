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

## Architecture

The service follows a modular architecture:

1. **Proxy Service** (`src/services/proxy/`): Handles request validation and processing
   - Validates required query parameters (`token` and `name`)
   - Parses user agents and referrer URLs
   - Forwards enriched data to upstream

2. **Salt Store** (`src/services/salt-store/`): Adapter pattern for salt storage
   - Currently uses in-memory storage
   - Configurable via `SALT_STORE_TYPE` environment variable

3. **User Signature Service** (`src/services/user-signature/`): Generates privacy-preserving user signatures
   - Uses daily-rotating salts
   - Creates SHA-256 hashes from salt + IP + user agent + timestamp

## Request Flow

1. Requests come to `/api/v1/page_hit`
2. Global HMAC validation plugin extracts and validates HMAC signature and timestamp from URL parameters
3. preValidation hook validates hmac
4. preHandler hook processes user agent and referrer data
5. Request is forwarded to `PROXY_TARGET` (default: `http://localhost:3000/local-proxy`)

## Environment Variables

- `PORT` - Server port (default: 3000)
- `PROXY_TARGET` - Upstream URL to forward requests
- `TINYBIRD_WAIT` - Pass `wait=true` parameter to Tinybird, which makes it respond only after data is ingested (default: false)
- `LOG_LEVEL` - Logging level (default: info)
- `SALT_STORE_TYPE` - Salt store implementation (default: memory)
- `ENABLE_SALT_CLEANUP_SCHEDULER` - Enable automatic daily salt cleanup (default: true, set to 'false' to disable)
- `TRUST_PROXY` - Enable trust proxy to resolve client IPs from X-Forwarded-For headers (default: true, set to 'false' to disable)
- `HMAC_SECRET` - Secret key for HMAC validation (Optional. Disabled if missing.)
- `HMAC_VALIDATION_LOG_ONLY` - When set to 'true', HMAC validation failures are logged but requests are not rejected (default: false)
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
