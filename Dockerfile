ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .

RUN pnpm build

CMD ["node", "--enable-source-maps", "dist/server.js"]

# ----------------------------------------------------

FROM node:${NODE_VERSION}-alpine AS production

ARG BUILD_LABEL
ENV BUILD_LABEL=${BUILD_LABEL}

WORKDIR /app

COPY --from=base /app/dist /app/dist

CMD ["node", "--enable-source-maps", "dist/server.js"]
