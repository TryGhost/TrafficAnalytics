ARG NODE_VERSION=26

FROM node:${NODE_VERSION}-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Node 26 does not bundle Corepack. pnpm is pinned by "packageManager" in package.json.
RUN npm install --global corepack@0.36.0 && corepack enable

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
