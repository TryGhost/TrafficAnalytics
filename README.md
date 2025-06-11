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

```bash
# Salt Store Configuration
SALT_STORE_TYPE=memory  # Options: memory, firestore

# Firestore Configuration (when SALT_STORE_TYPE=firestore)
FIRESTORE_PROJECT_ID=traffic-analytics-dev
```

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

## Deployment

### Staging
- **Automatic**: Merging to `main` branch automatically deploys to staging environment
- **Manual**: Use "Run workflow" on the [Build & Deploy](../../actions/workflows/build.yml) action

### Production

#### Creating a Release
1. Go to [Actions > Create Release](../../actions/workflows/release.yml)
2. Click "Run workflow"
3. Select the bump type: `patch`, `minor`, or `major`
4. This will:
   - Calculate the new version based on current package.json
   - Create a release branch with the version bump
   - Tag the release and create GitHub release
   - Create PR to merge version bump back to main

#### Deploying to Production
1. Go to [Actions > Deploy to Production](../../actions/workflows/deploy-production.yml)
2. Click "Run workflow"
3. Enter the release version to deploy (e.g., `v1.2.3`)
4. This deploys the specified release to production

### Rollback
- Use the [Rollback](../../actions/workflows/rollback.yml) workflow to rollback to a previous version

# Copyright & License 

Copyright (c) 2013-2025 Ghost Foundation - Released under the [MIT license](LICENSE).