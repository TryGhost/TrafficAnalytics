ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base

# Install curl for healthcheck
RUN apk add --no-cache curl

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

CMD ["node", "--enable-source-maps", "dist/server.js"]

# ----------------------------------------------------

FROM node:${NODE_VERSION}-alpine AS production

WORKDIR /app

COPY --from=base /app/dist /app/dist

CMD ["node", "--enable-source-maps", "dist/server.js"]
