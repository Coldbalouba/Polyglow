# TutConnect production image (Next.js standalone + Prisma).
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# Prisma CLI with its own dependencies, only for running migrations at startup
FROM base AS migrator
WORKDIR /migrate
RUN npm init -y >/dev/null && npm install --omit=dev prisma@6.19.3

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --system --uid 1001 app
# Next.js standalone server
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
# Prisma schema + migrations and the Prisma CLI, used at startup to apply migrations
COPY --from=build --chown=app /app/prisma ./prisma
COPY --from=migrator --chown=app /migrate/node_modules ./migrate/node_modules
USER app
EXPOSE 3000
CMD ["sh", "-c", "node migrate/node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma && node server.js"]
