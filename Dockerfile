ARG NODE_VERSION=22

# Base stage with common Node.js setup
FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Dependencies stage - install all dependencies (dev + prod)
FROM base AS dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Build stage - compile TypeScript
FROM dependencies AS build
COPY . .
RUN yarn build

# Development target - includes all dependencies for testing/linting
FROM dependencies AS development
COPY . .
RUN yarn build
CMD ["yarn", "dev"]

# Production target - only runtime dependencies and built code
FROM base AS production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=build /app/dist ./dist
USER node
CMD ["yarn", "start"]