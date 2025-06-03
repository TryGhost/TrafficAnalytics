ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

CMD ["yarn", "start"]