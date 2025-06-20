# Traffic Analytics

Traffic Analytics Service - A web analytics proxy for Ghost that processes and enriches traffic data before forwarding it to Tinybird's analytics API.

## Features

- User agent parsing for OS, browser, and device detection
- Referrer URL parsing and categorization
- Privacy-preserving user signatures with daily-rotating salts
- Configurable salt storage (in-memory or Firestore)
- Docker-first development with Firestore emulator support

## Configuration

Copy `.env.example` to `.env` and configure as needed:

- `PORT` - Server port (default: 3000)
- `LOG_LEVEL` - Logging level (default: info)
- `PROXY_TARGET` - Upstream URL to forward requests (default: http://localhost:3000/local-proxy)
- `SALT_STORE_TYPE` - Salt store implementation: memory or firestore (default: memory)
- `GOOGLE_CLOUD_PROJECT` - Google Cloud project ID for Firestore (required when using firestore salt store)
- `LOG_PROXY_REQUESTS` - Enable logging of proxy requests (default: true)
- `ENABLE_SALT_CLEANUP_SCHEDULER` - Enable automatic daily salt cleanup (default: true)
- `FIRESTORE_DATABASE_ID` - Firestore database ID (required when using firestore salt store)
- `PUBSUB_TOPIC_PAGE_HITS_RAW` - Pub/Sub topic for raw page hits (required for pub/sub functionality)
- `TRUST_PROXY` - Enable trust proxy to resolve client IPs from X-Forwarded-For headers (default: true)

## Develop

1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.

## Build
- `yarn build` to transpile Typescript to JS
- `docker compose build` or `yarn docker:build` to build docker image

## Run

- `yarn dev` start development server locally
- `docker compose up` or `yarn docker:dev` start development server in docker compose (includes Firestore emulator)
- View: [http://localhost:3000](http://localhost:3000)

## Run locally with Ghost in Docker

Sometimes it's useful to test the full setup with Ghost pointing its tracker script to this analytics service running locally. This can be acheived relatively easily with Docker Compose:
- Set the `tinybird:tracker:endpoint` to `http://localhost/.ghost/analytics/tb/web_analytics` in your Ghost config
- Run `docker compose --profile=split up` in your Ghost clone
- If you want to test the full e2e flow to Tinybird, set the `PROXY_TARGET=https://api.tinybird.co/v0/events` value in your `.env` file in this repo. Otherwise the analytics service will use the `/local-proxy` mock endpoint, which does not forward events to Tinybird.
- Run `yarn docker:dev:ghost` in the root of this repo
- Visit your Ghost site's homepage at `http://localhost` and you should see a successful request in the network tab.

## Test

- `yarn test` run all tests locally
- `docker compose run --rm test` or `yarn docker:test` run all tests in docker compose

## Lint
- `yarn lint` run eslint locally
- `docker compose run --rm lint` or `yarn docker:lint` run eslint in docker compose

## Multi-Worktree Development

This project supports running multiple worktrees simultaneously using Docker Compose. Each worktree can run its own isolated development environment with unique ports and container names.

### Setup

1. **Create worktrees** as usual with git worktree
2. **Configure each worktree** with a unique `.env` file:

```bash
# main worktree (.env) - uses defaults
NODE_ENV=development

# work worktree (.env)  
NODE_ENV=development
COMPOSE_PROJECT_NAME=traffic-analytics-work
ANALYTICS_PORT=3001
FIRESTORE_PORT=8081

# scratch worktree (.env)
NODE_ENV=development  
COMPOSE_PROJECT_NAME=traffic-analytics-scratch
ANALYTICS_PORT=3002
FIRESTORE_PORT=8082
```

### Usage

Each worktree runs completely isolated:
- **Unique ports**: No conflicts between worktrees
- **Isolated containers**: Auto-generated names like `traffic-analytics-work-analytics-service-1`
- **Separate volumes**: Each worktree has its own `node_modules` volume
- **Independent projects**: Services can run simultaneously

```bash
# Start development in any worktree
cd /path/to/worktree
docker compose up

# Each worktree accessible on its configured port
# main: http://localhost:3000
# work: http://localhost:3001  
# scratch: http://localhost:3002
```

## Deployment

Merging to `main` automatically deploys to staging. Production deployments only happen when the version in `package.json` changes.

To ship to production:
1. `yarn ship` - creates a release branch with version bump
2. Create PR using the provided link
3. Merge the PR - this triggers production deployment

# Copyright & License 

Copyright (c) 2013-2025 Ghost Foundation - Released under the [MIT license](LICENSE).