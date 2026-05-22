# -----------------------------------------------------------------------------
# Stack: Next.js (standalone) + Worker (tsx). Uma imagem, dois comandos.
# Build: docker build -t observabilidade-saas .
# App:   docker run -p 3000:3000 --env-file .env observabilidade-saas
# Worker: docker run --env-file .env observabilidade-saas npx tsx src/workers/runner.ts
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Dependências (apenas produção para imagem final)
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Builder: Next.js standalone (precisa de devDependencies para compilar)
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
# Placeholders para "Collecting page data" (Next.js avalia rotas no build; valores reais no runtime)
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV REDIS_URL=redis://localhost:6379
ENV SESSION_SECRET=build-time-placeholder
RUN npm run build

# Runner: app (standalone) + arquivos necessários para o worker
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Output standalone do Next
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Worker: precisa de src + node_modules (tsx + deps de fila/DB)
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY drizzle.config.ts tsconfig.json ./

# Entrypoint que carrega /run/secrets/* como env vars (Docker Swarm / K8s).
# Compatível com dev: sem /run/secrets, passa direto.
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3000

# Healthcheck: usa o endpoint público minimal /api/health (verifica só DB).
# Swarm/Traefik usa para decidir rotear tráfego. Worker stale NÃO marca unhealthy
# (detalhes ficam em /api/health/details).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --quiet --spider --tries=1 http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
# Padrão: servidor Next.js. No compose o worker sobrescreve com command.
CMD ["node", "server.js"]
