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

USER nextjs
EXPOSE 3000

# Padrão: servidor Next.js. No compose o worker sobrescreve com command.
CMD ["node", "server.js"]
