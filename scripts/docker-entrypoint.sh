#!/bin/sh
# Entrypoint que carrega segredos montados em /run/secrets/* como variáveis de
# ambiente antes de iniciar o processo. Usado em Docker Swarm e Kubernetes onde
# secrets são entregues como arquivos.
#
# - Em dev local (sem /run/secrets), passa direto — compatível com docker-compose.
# - Se a variável já estiver no ambiente, NÃO sobrescreve (env do compose > secret).
# - Suporta template de DATABASE_URL via DATABASE_URL_TEMPLATE com placeholder
#   `@PASSWORD@` substituído por POSTGRES_PASSWORD (que veio do secret).
set -eu

# 1) Cada arquivo em /run/secrets/<name> exporta como env var <NAME> em uppercase.
if [ -d /run/secrets ]; then
  for secret_file in /run/secrets/*; do
    [ -f "$secret_file" ] || continue
    name=$(basename "$secret_file")
    case "$name" in
      .*) continue ;;
    esac
    var_name=$(echo "$name" | tr '[:lower:]' '[:upper:]')
    if ! printenv "$var_name" >/dev/null 2>&1; then
      # shellcheck disable=SC2163
      export "$var_name=$(cat "$secret_file")"
    fi
  done
fi

# 2) Templating opcional: se DATABASE_URL_TEMPLATE estiver setado e DATABASE_URL
#    não estiver, substitui `@PASSWORD@` por POSTGRES_PASSWORD.
if [ -n "${DATABASE_URL_TEMPLATE:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    # Escape de & / | \ no password para o sed não reinterpretar.
    pass_escaped=$(printf '%s' "$POSTGRES_PASSWORD" | sed -e 's/[\\&|]/\\&/g')
    DATABASE_URL=$(printf '%s' "$DATABASE_URL_TEMPLATE" | sed "s|@PASSWORD@|$pass_escaped|")
    export DATABASE_URL
  fi
fi

exec "$@"
