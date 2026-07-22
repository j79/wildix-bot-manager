#!/usr/bin/env bash
# migrate-v0.2.0.sh — Migration vers la version multi-utilisateurs
# À lancer après `git pull` et avant `docker compose up -d --build`
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
fail() { echo -e "${RED}✗${NC} $*"; exit 1; }
section() { echo; echo -e "${YELLOW}── $* ──${NC}"; }

section "Migration v0.2.0 — Multi-utilisateurs"

PB_URL="${PB_URL:-http://localhost:8090}"

if [ -z "$PB_ADMIN_EMAIL" ] || [ -z "$PB_ADMIN_PASSWORD" ]; then
  echo "Email admin PocketBase :"
  read -r PB_ADMIN_EMAIL
  echo "Mot de passe admin PocketBase :"
  read -rs PB_ADMIN_PASSWORD
  echo
fi

TOKEN=$(curl -sf -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$PB_ADMIN_EMAIL\",\"password\":\"$PB_ADMIN_PASSWORD\"}" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  fail "Impossible de s'authentifier sur PocketBase."
fi
ok "Authentification PocketBase OK"

# ── 1. Ajouter le champ 'shared' à pbx_credentials ───────────────────────────
section "Ajout du champ 'shared' sur pbx_credentials"

PBX_SCHEMA=$(curl -sf -H "Authorization: $TOKEN" "$PB_URL/api/collections/pbx_credentials")
if echo "$PBX_SCHEMA" | grep -q '"shared"'; then
  warn "Champ 'shared' déjà présent — ignoré"
else
  # Récupérer les champs existants et ajouter 'shared'
  CURRENT_FIELDS=$(echo "$PBX_SCHEMA" | grep -o '"fields":\[.*\]' | head -1)
  curl -sf -X PATCH "$PB_URL/api/collections/pbx_credentials" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "fields": [
        {"name":"user","type":"relation","required":true,"collectionId":"_pb_users_auth_","cascadeDelete":true},
        {"name":"name","type":"text","required":true},
        {"name":"api_token","type":"text","required":true},
        {"name":"pbx_serial","type":"text"},
        {"name":"pbx_key","type":"text"},
        {"name":"pbx_host","type":"url","required":true},
        {"name":"pbx_local_token","type":"text"},
        {"name":"shared","type":"bool"}
      ]
    }' > /dev/null && ok "Champ 'shared' ajouté à pbx_credentials" || warn "Erreur ajout champ 'shared'"
fi

# ── 2. Créer la collection user_ai_config ────────────────────────────────────
section "Création de user_ai_config"

if curl -sf -H "Authorization: $TOKEN" "$PB_URL/api/collections/user_ai_config" > /dev/null 2>&1; then
  warn "Collection 'user_ai_config' existe déjà — ignorée"
else
  curl -sf -X POST "$PB_URL/api/collections" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "user_ai_config",
      "type": "base",
      "fields": [
        {"name":"user","type":"relation","required":true,"collectionId":"_pb_users_auth_","cascadeDelete":true},
        {"name":"provider","type":"text","required":true},
        {"name":"api_key","type":"text"},
        {"name":"model","type":"text"},
        {"name":"ollama_url","type":"text"}
      ],
      "listRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
      "viewRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
      "deleteRule": "@request.auth.id = user || @request.auth.role = \"admin\""
    }' > /dev/null && ok "Collection 'user_ai_config' créée" || warn "Erreur création 'user_ai_config'"
fi

# ── 3. Créer la collection user_template_overrides ───────────────────────────
section "Création de user_template_overrides"

if curl -sf -H "Authorization: $TOKEN" "$PB_URL/api/collections/user_template_overrides" > /dev/null 2>&1; then
  warn "Collection 'user_template_overrides' existe déjà — ignorée"
else
  curl -sf -X POST "$PB_URL/api/collections" \
    -H "Authorization: $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "user_template_overrides",
      "type": "base",
      "fields": [
        {"name":"user","type":"relation","required":true,"collectionId":"_pb_users_auth_","cascadeDelete":true},
        {"name":"template","type":"relation","required":true,"collectionId":"bot_templates","cascadeDelete":true},
        {"name":"name","type":"text"},
        {"name":"icon","type":"text"},
        {"name":"sector","type":"text"},
        {"name":"useCase","type":"text"},
        {"name":"sections","type":"json"},
        {"name":"translations","type":"json"}
      ],
      "listRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
      "viewRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id = user || @request.auth.role = \"admin\"",
      "deleteRule": "@request.auth.id = user || @request.auth.role = \"admin\""
    }' > /dev/null && ok "Collection 'user_template_overrides' créée" || warn "Erreur création 'user_template_overrides'"
fi

echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Migration v0.2.0 terminée !${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo "  Prochaine étape :"
echo "  docker compose build backend && docker compose up -d --no-deps backend"
echo "  docker compose build frontend && docker compose up -d --no-deps frontend"
echo
