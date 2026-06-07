# Project State — Wilma Bot Manager
> Fichier de reprise de session pour Claude Code.
> À lire EN PREMIER à chaque nouvelle session.
> Mettre à jour après chaque étape complétée.
> Dernière mise à jour : 2026-05-23 — SESSION 2 ✅ APIs Wildix opérationnelles

---

## Contexte rapide

Application web full-stack de gestion de bots Wildix (VoiceBots WILMA + ChatBots X-Bees).
Utilisateurs cibles : techniciens et ingénieurs avant-vente Wildix.
Dépôt destiné à être public sur GitHub (portabilité `docker-compose up` obligatoire).

---

## Infrastructure UNRAID

| Service     | URL                               | Ports effectifs       | Status  |
|-------------|-----------------------------------|-----------------------|---------|
| UNRAID UI   | http://192.168.1.76               | 80, 443 (nginx natif) | OK      |
| Pocketbase  | http://192.168.1.76:8090/_/       | 8090                  | OK      |
| Ollama      | http://192.168.1.76:11434         | 11434                 | OK      |
| NPM Admin   | http://192.168.1.76:81            | 81 / 8880 / 8443      | OK      |
| Backend app | http://192.168.1.76:3002          | 3002 (→ 3000 interne) | OK ✅   |
| Frontend app| http://192.168.1.76:8180          | 8180 (→ 80 interne)   | OK ✅   |

**Chemins UNRAID :**
- Projet : `/mnt/user/Projets/wildix-bot-manager/`
- Pocketbase data : `/mnt/user/appdata/pocketbase/` (monté sur `/pb_data`)
- Ollama data : `/mnt/user/appdata/ollama/`

**Accès SSH :**
- Host : 192.168.1.76 | User : root | Clé : `~/.ssh/id_unraid` (Windows)
- Password root UNRAID : `Is@belleunraid90b`

**Share SMB :**
- `P:\wildix-bot-manager\` = `/mnt/user/Projets/wildix-bot-manager/`

**⚠️ Commandes de déploiement critiques :**
```bash
# Build
docker compose build backend        # ou frontend, ou les deux
# Déployer SANS toucher pocketbase (port 8090 déjà pris par container UNRAID)
docker compose up -d --no-deps backend
docker compose up -d --no-deps frontend
# NE PAS utiliser : docker restart (ne recharge pas la nouvelle image)
# NE PAS utiliser : docker compose up -d backend (démarre pocketbase → conflit port 8090)
```

---

## Pocketbase — Collections créées

| Collection       | Type | Champs principaux                                            |
|------------------|------|--------------------------------------------------------------|
| `users`          | auth | email, name, role (select: admin/user) + champs PB natifs   |
| `pbx_credentials`| base | user (rel), name, api_token, pbx_serial, pbx_host, pbx_local_token |
| `audit_logs`     | base | user (rel), action (text), details (json)                   |

**Note :** Le champ `pbx_key` existe toujours en base PB (non supprimé du schéma) mais
n'est plus utilisé par le code ni affiché dans le formulaire.

**Compte app PB :** jerome.guieze@gmail.com / `Is@bellepocketbase90b` / role=admin
**Superuser PB :** jerome.guieze@gmail.com / `Is@bellepocketbase90b`

**PBX configuré :**
- id : `e87q6fzwftd1yjr`
- name : jeromeg.wildixin.com
- pbx_serial : 22110001af85
- api_token : Company API Key Wildix (wsk-v1-rMuy...) — scopes : voicebots + tools + X-Bees

---

## Stack technique

| Couche    | Technologie                                    |
|-----------|------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend   | Hono (Node.js/TypeScript) + @hono/node-server  |
| Auth + DB | Pocketbase 0.38.2                              |
| LLM       | Ollama (qwen2.5:3b) — switchable openai/groq   |
| TTS       | Google Cloud TTS + ElevenLabs (V2)             |
| Deploy    | Docker Compose + NGINX                         |

---

## APIs Wildix — Endpoints réels (découverts en session 2)

### VoiceBots WILMA — `https://wim.wildix.com/v2`
| Méthode | Endpoint | Réponse |
|---------|----------|---------|
| GET | `/voicebots/bots` | `{ bots: VoiceBot[] }` |
| GET | `/voicebots/bots/{id}` | `{ bot: VoiceBot }` |
| POST | `/voicebots/bots` | `{ bot: VoiceBot }` |
| PUT | `/voicebots/bots/{id}` | `{ bot: VoiceBot }` |
| DELETE | `/voicebots/bots/{id}` | 200 vide |

Auth : `Authorization: Bearer <api_token>`

**Schéma VoiceBot réel :**
```json
{ "id", "name", "message" (accueil), "category", "endpoint": { "llm": { "prompt", "model" } },
  "pipeline": { "interuptionsEnabled" (typo Wildix!), "maximumDuration", "silenceTimeout" },
  "createdAt", "updatedAt" }
```
Pas de champ `enabled` ni `description` dans l'API.

### ChatBots X-Bees — `https://api.x-bees.com/v2`
| Méthode | Endpoint | Réponse |
|---------|----------|---------|
| GET | `/users/bots?userId={pbx_serial}` | `{ bots: ChatBot[] }` |
| GET | `/users/bots/{id}?userId={pbx_serial}` | ChatBot |
| POST | `/users/bots?userId={pbx_serial}` | ChatBot |
| PUT | `/users/bots/{id}?userId={pbx_serial}` | ChatBot |
| DELETE | `/users/bots/{id}?userId={pbx_serial}` | 200 vide |

Auth : `Authorization: Bearer <api_token>`

**Schéma ChatBot réel :**
```json
{ "id", "name", "access" ("EVERYBODY"|...), "integrationType" ("LLM"|"WEBHOOK"),
  "searchable", "createdAt" }
```
Pas de champ `enabled` ni `description` dans l'API.

### WIM Tools — `https://tools.wim.wildix.com/v1`
| Méthode | Endpoint | Réponse |
|---------|----------|---------|
| GET | `/tools` | `{ tools: WimTool[] }` |
| GET | `/tools/{id}` | `{ tool: WimTool }` |
| POST | `/tools` | `{ tool: WimTool }` |
| PUT | `/tools/{id}` | `{ tool: WimTool }` |
| DELETE | `/tools/{id}` | 204 |

Auth : `Authorization: Bearer <api_token>`
Nécessite un **Company API Key** avec scopes `tools:*` (distinct d'un token X-Bees simple).

---

## Avancement — Plan en 11 étapes

### ✅ Étapes 0–11 — Infrastructure, monorepo, backend, frontend, IA, wizard, clonage, admin, build
Voir historique des sessions précédentes.

### ✅ Session 2 — Corrections APIs Wildix + stabilisation (2026-05-23)

**Bugs corrigés :**

| # | Problème | Fichier(s) |
|---|----------|-----------|
| 1 | Mot de passe user app PB inconnu → reset via API admin | PocketBase |
| 2 | WILMA : URL `/v2/voicebots` → 404 | `backend/src/services/wildix.ts` |
| 3 | WILMA : réponse non unwrappée (`{bots:[...]}`) | idem |
| 4 | X-Bees : `Authorization` sans `Bearer` → 401 | idem |
| 5 | X-Bees : réponse non unwrappée (`{bots:[...]}`) | idem |
| 6 | WIM Tools : `x-api-key` → remplacé par `Bearer` | idem |
| 7 | WIM Tools : réponse non unwrappée (`{tools:[...]}`) | idem |
| 8 | wildixFetch : 401/403 upstream → logout frontend | idem |
| 9 | `wildixFetch` delete 200 vide → crash JSON.parse | idem |
| 10 | Types `VoiceBot`/`ChatBot` ne correspondent pas à l'API | `frontend/src/types/wildix.ts` |
| 11 | BotEdit/BotCreate : payloads au mauvais format | `frontend/src/pages/BotEdit.tsx`, `BotCreate.tsx` |
| 12 | `docker restart` ne recharge pas la nouvelle image | Process déploiement |
| 13 | Champ `pbx_key` doublon supprimé ; labels PBX form renommés | `frontend/src/pages/PBX.tsx`, `src/types/app.ts` |
| 14 | WIM Tools : erreur silencieuse → message explicite ajouté | `frontend/src/pages/Tools.tsx` |

**État validé :**
- `/health` → `{"status":"ok"}` ✅
- `/auth/login` + `/auth/me` ✅
- `/pbx` → 1 PBX ✅
- `/bots?pbxId=…` → 56 voicebots + 42 chatbots, 0 erreurs ✅
- `/tools?pbxId=…` → 10 tools ✅
- Frontend HTTP 200 ✅

---

## Champs formulaire PBX (labels actuels)

| Champ DB | Label affiché | Usage |
|----------|--------------|-------|
| `name` | Nom * | Nom d'affichage |
| `pbx_host` | Hôte PBX * | hostname PBX (ex: client.wildixin.com) |
| `api_token` | Company API Key * | Token wsk-v1-… pour WILMA + X-Bees + WIM Tools |
| `pbx_serial` | Serial PBX (X-Bees userId) | Serial du PBX, utilisé comme userId X-Bees |
| `pbx_local_token` | PBX Simple Token | Token local PBX (access_…), usage futur |

---

## Points d'attention critiques

1. **Volume Pocketbase** : path correct `/pb_data` (pas `/pb/pb_data`)

2. **Ports UNRAID** : 80/443 pris par nginx → NPM sur 8880/8443, backend sur 3002, frontend sur 8180

3. **Déploiement** : toujours `docker compose up -d --no-deps <service>`, jamais `docker restart`

4. **Typo API Wildix** : `interuptionsEnabled` (un seul 'r') — c'est une faute de Wildix, intentionnelle dans notre code

5. **CORS backend** : configuré en `origin: '*'` pour le dev — à restreindre en prod

6. **PB superuser auth** : utiliser `/api/collections/_superusers/auth-with-password` (v0.38+)

7. **`pbx_key` en base** : champ encore présent dans le schéma PB mais vide et inutilisé — ne pas le supprimer du schéma PB sans migration

8. **401/403 upstream → 502** : intentionnel dans `wildixFetch` pour éviter le logout frontend

---

## Commandes utiles (SSH UNRAID)

```bash
# Connexion SSH depuis Windows
ssh -i ~/.ssh/id_unraid root@192.168.1.76

# Status containers projet
docker ps | grep wildix-bot-manager

# Logs
docker logs -f wildix-bot-manager-backend-1
docker logs -f wildix-bot-manager-frontend-1

# Build + déploiement (depuis /mnt/user/Projets/wildix-bot-manager)
docker compose build backend
docker compose up -d --no-deps backend

# Test rapide des endpoints
curl http://localhost:3002/health
curl http://localhost:3002/bots?pbxId=e87q6fzwftd1yjr  # (avec token Bearer)
```
