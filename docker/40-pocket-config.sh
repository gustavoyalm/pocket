#!/bin/sh
# Gera /config.js a partir das variáveis de ambiente do container.
# Roda automaticamente na inicialização da imagem oficial do nginx.
set -eu

cat > /usr/share/nginx/html/config.js <<EOF
window.__POCKET_CONFIG__ = {
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_PUBLISHABLE_KEY: "${SUPABASE_PUBLISHABLE_KEY:-}"
};
EOF
