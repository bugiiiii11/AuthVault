FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json ./packages/types/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile --prod=false

# Build
FROM deps AS build
COPY packages/types/ ./packages/types/
COPY apps/backend/ ./apps/backend/
COPY tsconfig.base.json ./
RUN pnpm --filter @authvault/types build
RUN pnpm --filter @authvault/backend build

# Production
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/node_modules ./node_modules

EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/index.js"]
