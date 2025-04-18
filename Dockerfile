ARG NODE_VERSION=22
ARG BUILD_TYPE=production

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
COPY package.json yarn.lock ./

# Development
FROM base AS development-build
RUN yarn install --frozen-lockfile && \
    yarn add typescript@5.2.2 --dev --exact

# Production
FROM base AS production-build
RUN yarn install --production --frozen-lockfile && \
    rm -rf test

FROM ${BUILD_TYPE}-build AS final
COPY . .
CMD ["sh", "-c", "yarn build && node dist/server.js"]