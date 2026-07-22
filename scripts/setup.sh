#!/usr/bin/env bash
# setup.sh — Initialisation première installation de Wilma Bot Manager
# À lancer UNE SEULE FOIS après `docker compose up -d`
set -e

COMPOSE="docker compose"

# ── Couleurs ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }
section() { echo; echo -e "${YELLOW}── $* ──${NC}"; }

# ── Vérifier que les containers tournent ─────────────────────────────────────
section "Vérification des containers"
for svc in pocketbase backend ollama; do
  status=$($COMPOSE ps -q $svc 2>/dev/null)
  if [ -z "$status" ]; then
    fail "Container '$svc' introuvable. Lancez d'abord : docker compose up -d"
  fi
  ok "$svc en cours d'exécution"
done

# ── PocketBase : créer le superuser ──────────────────────────────────────────
section "PocketBase — Superuser admin"
if [ -z "$PB_ADMIN_EMAIL" ] || [ -z "$PB_ADMIN_PASSWORD" ]; then
  echo "Email admin PocketBase (/_/ admin) :"
  read -r PB_ADMIN_EMAIL
  echo "Mot de passe admin PocketBase :"
  read -rs PB_ADMIN_PASSWORD
  echo
fi

$COMPOSE exec pocketbase /pocketbase superuser upsert "$PB_ADMIN_EMAIL" "$PB_ADMIN_PASSWORD" \
  && ok "Superuser PocketBase créé/mis à jour : $PB_ADMIN_EMAIL" \
  || warn "Impossible de créer le superuser (peut-être déjà existant)"

# ── PocketBase : créer les collections via API ───────────────────────────────
section "PocketBase — Collections"
PB_URL="${PB_URL:-http://localhost:8090}"

# Authentification
TOKEN=$(curl -sf -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  fail "Impossible de s'authentifier sur PocketBase. Vérifiez les credentials."
fi
ok "Authentification PocketBase OK"

create_collection() {
  local name=$1
  local payload=$2
  local existing
  existing=$(curl -sf -H "Authorization: $TOKEN" "$PB_URL/api/collections/$name" 2>/dev/null)
  if [ -n "$existing" ]; then
    warn "Collection '$name' existe déjà — ignorée"
    return
  fi
  curl -sf -X POST "$PB_URL/api/collections" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" > /dev/null \
    && ok "Collection '$name' créée" \
    || warn "Erreur création collection '$name'"
}

# Collection users (auth)
create_collection "users" '{
  "name": "users",
  "type": "auth",
  "fields": [
    {"name":"name","type":"text","required":false},
    {"name":"role","type":"select","required":true,"values":["admin","user"],"maxSelect":1}
  ],
  "deleteRule": null,
  "createRule": "",
  "updateRule": "@request.auth.id = id",
  "listRule": "@request.auth.role = \"admin\"",
  "viewRule": "@request.auth.id = id || @request.auth.role = \"admin\""
}'

# Collection pbx_credentials
create_collection "pbx_credentials" '{
  "name": "pbx_credentials",
  "type": "base",
  "fields": [
    {"name":"user","type":"relation","required":true,"collectionId":"_pb_users_auth_","cascadeDelete":true},
    {"name":"name","type":"text","required":true},
    {"name":"api_token","type":"text","required":true},
    {"name":"pbx_serial","type":"text"},
    {"name":"pbx_key","type":"text"},
    {"name":"pbx_host","type":"url","required":true},
    {"name":"pbx_local_token","type":"text"}
  ],
  "listRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
  "viewRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
  "deleteRule": "@request.auth.id = user || @request.auth.role = \"admin\""
}'

# Collection audit_logs
create_collection "audit_logs" '{
  "name": "audit_logs",
  "type": "base",
  "fields": [
    {"name":"user","type":"relation","required":false,"collectionId":"_pb_users_auth_"},
    {"name":"action","type":"text","required":true},
    {"name":"details","type":"json"}
  ],
  "listRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
  "viewRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
  "createRule": "@request.auth.id != \"\"",
  "updateRule": null,
  "deleteRule": "@request.auth.role = \"admin\""
}'

# ── PocketBase : créer le premier utilisateur app ────────────────────────────
section "PocketBase — Premier utilisateur applicatif"

if [ -z "$APP_USER_EMAIL" ] || [ -z "$APP_USER_PASSWORD" ]; then
  warn "Ignoré — définissez APP_USER_EMAIL et APP_USER_PASSWORD pour créer automatiquement."
else
  curl -sf -X POST "$PB_URL/api/collections/users/records" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$APP_USER_EMAIL\",\"password\":\"$APP_USER_PASSWORD\",\"passwordConfirm\":\"$APP_USER_PASSWORD\",\"name\":\"Admin\",\"role\":\"admin\",\"emailVisibility\":true}" \
    > /dev/null \
    && ok "Utilisateur applicatif créé : $APP_USER_EMAIL" \
    || warn "Utilisateur peut-être déjà existant"
fi

# ── Ollama : tirer le modèle ──────────────────────────────────────────────────
section "Ollama — Téléchargement du modèle LLM"
MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
echo "Téléchargement de $MODEL (peut prendre plusieurs minutes)…"
$COMPOSE exec ollama ollama pull "$MODEL" \
  && ok "Modèle '$MODEL' disponible" \
  || warn "Erreur lors du téléchargement du modèle"

# ── Résumé ────────────────────────────────────────────────────────────────────
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Initialisation terminée !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo "  Frontend      : http://localhost:${FRONTEND_PORT:-80}"
echo "  PocketBase UI : http://localhost:${PB_PORT:-8090}/_/"
echo "  API backend   : http://localhost:${BACKEND_PORT:-3000}/health"
echo
