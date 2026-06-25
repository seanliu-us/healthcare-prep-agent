# syntax=docker/dockerfile:1

# PrepPilot — production image for a long-running Node host (Render, Railway, Fly, etc.)
# Multi-stage: build with full deps, then ship a runtime image that still contains
# the MCP server source + tsx (the MCP server is spawned at runtime via
# `node --import tsx mcp-server/index.ts`).

FROM node:22-bookworm-slim AS base
WORKDIR /app

# ---- dependencies (incl. dev, needed to build) ----
# better-sqlite3 ships prebuilt binaries for linux-x64/Node 22, so no compiler
# toolchain is required for a standard Render/Railway/Fly build.
FROM base AS deps
COPY package.json ./
RUN npm install --include=dev

# ---- build ----
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Office-memory SQLite location (mount a persistent disk here for durability).
ENV MEMORY_DB_PATH=/data/office-memory.db

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/mcp-server ./mcp-server

# Ensure the default DB directory exists and is writable even without a mounted disk.
RUN mkdir -p /data

EXPOSE 3000
CMD ["npm", "run", "start"]
