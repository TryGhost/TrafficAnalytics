# Traffic Analytics

Traffic Analytics Service


## Usage


## Develop

1. `git clone` this repo & `cd` into it as usual
2. Run `yarn` to install top-level dependencies.

## Build
- `yarn build` to transpile Typescript to JS
- `docker compose build` or `yarn docker:build` to build docker image

## Run

- `yarn dev` start development server locally
- `docker compose up` or `yarn docker:dev` start development server in docker compose
- View: [http://localhost:3000](http://localhost:3000)

## Test

- `yarn test` run all tests locally
- `docker compose run --rm test` or `yarn docker:test` run all tests in docker compose

## Lint
- `yarn lint` run eslint locally
- `docker compose run --rm lint` or `yarn docker:lint` run eslint in docker compose

# Copyright & License 

Copyright (c) 2013-2025 Ghost Foundation - Released under the [MIT license](LICENSE).