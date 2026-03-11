# syntax = docker/dockerfile:1

ARG NODE_VERSION=20
FROM node:${NODE_VERSION}-slim as base

WORKDIR /app

ENV NODE_ENV="production"
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN apt-get update -qq && \
    apt-get install -y build-essential pkg-config python-is-python3

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

FROM node:${NODE_VERSION}-slim

RUN apt-get update -qq && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything needed for the TypeScript server
COPY --from=base /app/public ./public
COPY --from=base /app/.next ./.next
COPY --from=base /app/src ./src
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/server.ts ./server.ts
COPY --from=base /app/tsconfig.json ./tsconfig.json

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV="production"

# Use tsx to run TypeScript server
CMD ["./node_modules/.bin/tsx", "server.ts"]
