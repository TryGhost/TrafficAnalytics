ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Enable pnpm via corepack, pinned by the "packageManager" field in package.json
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --ignore-scripts --frozen-lockfile

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
