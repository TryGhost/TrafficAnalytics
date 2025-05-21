# Traffic Analytics

Traffic Analytics Service


## Usage


## Develop

You'll need Docker installed, i.e. via Orbstack, Docker Desktop

1. `git clone` this repo & `cd` into it as usual
2. Copy the example `.env` file: `cp .env.example .env`
3. Run `docker compose up` to build and run the docker container

The service will be exposed at `http://localhost:3000`.

## Develop locally with Ghost

Using Docker Compose, it's possible to run this Analytics Service and a development instance of Ghost together locally. You'll need to run Ghost itself using Docker, attach the Analytics Service to the `ghost_default` network, and modify Ghost's `tinybird:tracker:endpoint` configuration to point to the service.

1. If you haven't already, follow the instructions in [Getting started with Docker](https://www.notion.so/ghost/Getting-started-with-Docker-e804ee5a68d14cb78ba82b6237597f6c?pvs=4) to run Ghost in Docker Compose.
2. In your local Ghost clone, enable the `split` profile by setting `COMPOSE_PROFILES=split` in the `.env` file.
3. Change your `tinybird:tracker:endpoint` configuration in Ghost to `http://localhost/.ghost/analytics/tb/web_analytics`
4. Run `docker compose up` in your Ghost clone
5. In the `.env` file in this repo, set `COMPOSE_FILE=compose.yml:compose.ghost.yml`
6. Run `docker compose up` in this repo

Note: this will get simpler as we converge on standardizing this development environment setup.

## Test

- `yarn lint` run just eslint
- `yarn test` run lint and tests
- `yarn docker:test` run lint and tests in Docker

## Publish

- `yarn ship`


# Copyright & License 

Copyright (c) 2013-2025 Ghost Foundation - Released under the [MIT license](LICENSE).