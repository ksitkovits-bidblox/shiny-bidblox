#syntax=docker/dockerfile:1.4
FROM --platform=linux/amd64 node:20.1.0 AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
#RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./

RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps --link /app/node_modules ./node_modules
COPY --link  . .

COPY prisma/ .
RUN npx prisma generate

RUN npm run build

# Production image, copy all the files and run node
FROM --platform=linux/amd64 node:20-alpine AS runner-base

# build a clean runner image with only production deps
FROM runner-base AS runner-deps

RUN apk add --no-cache g++ make py3-pip
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit dev

FROM runner-base AS runner

WORKDIR /usr/src/app
ENV NODE_ENV production

RUN apk add --no-cache libc6-compat # openssl1.1-compat

RUN \
  addgroup --system --gid 1001 nodejs; \
  adduser --system --uid 1001 nodejs

COPY --from=builder --link --chown=1001:1001 /app/dist ./
COPY --from=builder --link --chown=1001:1001 /app/tsconfig.json ./

# copy only the prod dependencies
COPY --from=runner-deps --link --chown=1001:1001 /app/node_modules ./node_modules

# copy the generated prisma client from builder
COPY --from=builder --link --chown=1001:1001 /app/node_modules/.prisma ./node_modules/.prisma

USER nodejs

EXPOSE 3001

ENV PORT 3001
ENV HOSTNAME localhost

CMD ["node", "app.js"]