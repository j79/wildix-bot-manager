# Wilma Bot Manager

Interface web de gestion des bots Wildix — VoiceBots WILMA et ChatBots X-Bees.

Destinée aux techniciens et ingénieurs avant-vente Wildix pour créer, configurer et déployer des bots avec l'aide de l'IA.

---

## Fonctionnalités

- **Gestion multi-PBX** — Gérez vos credentials sur autant de PBX Wildix que nécessaire
- **VoiceBots WILMA** — Liste, création, édition, clonage intra et inter-PBX
- **ChatBots X-Bees** — Même interface pour les bots de messagerie
- **WIM Tools** — Configuration des intégrations webhook appelables par les bots
- **Génération IA** — Prompt système en 8 sections généré par un LLM local ou CLoud
- **Wizard de création** — 4 étapes guidées pour créer un bot complet
- **Interface admin** — Gestion des utilisateurs et rôles

---

## Stack technique

| Couche    | Technologie                                    |
|-----------|------------------------------------------------|
| Frontend  | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend   | Hono (Node.js/TypeScript)                      |
| Auth + DB | PocketBase 0.38                                |
| LLM local | Ollama (`qwen2.5:3b` par défaut)               |
| LLM cloud | OpenAI (`gpt-4o-mini`) ou Groq (`llama-3.1-8b-instant`) |
| Deploy    | Docker Compose + nginx                         |

---

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) ≥ 24
- [Docker Compose](https://docs.docker.com/compose/) ≥ 2.20 (plugin intégré à Docker Desktop)
- 4 Go RAM minimum (8 Go recommandés pour Ollama)
- Ports 80, 3000, 8090, 11434 disponibles (configurables)

---

## Déploiement rapide

### 1. Cloner le dépôt

```bash
git clone https://github.com/your-org/wildix-bot-manager.git
cd wildix-bot-manager
```

### 2. Configurer l'environnement

```bash
cp .env.example .env
```

Editez `.env` avec vos valeurs :

```env
# Credentials PocketBase (admin de l'interface /_/)
POCKETBASE_ADMIN_EMAIL=admin@votre-domaine.com
POCKETBASE_ADMIN_PASSWORD=mot_de_passe_fort

# LLM — choisir un provider
LLM_PROVIDER=ollama          # ollama | openai | groq
OLLAMA_MODEL=qwen2.5:3b

# Si LLM_PROVIDER=openai
# OPENAI_API_KEY=sk-...

# Si LLM_PROVIDER=groq
# GROQ_API_KEY=gsk_...
```

### 3. Démarrer les containers

```bash
docker compose up -d --build
```

### 4. Initialisation (première fois uniquement)

```bash
chmod +x scripts/setup.sh
PB_ADMIN_EMAIL=admin@votre-domaine.com \
PB_ADMIN_PASSWORD=mot_de_passe_fort \
APP_USER_EMAIL=utilisateur@votre-domaine.com \
APP_USER_PASSWORD=mot_de_passe_utilisateur \
./scripts/setup.sh
```

Ce script :
- Crée le superuser PocketBase (accès à `/_/`)
- Crée les collections (`users`, `pbx_credentials`, `audit_logs`)
- Crée le premier utilisateur applicatif (rôle admin)
- Télécharge le modèle Ollama

### 5. Accéder à l'application

| Interface           | URL                          |
|---------------------|------------------------------|
| Application web     | http://localhost             |
| Admin PocketBase    | http://localhost:8090/_/     |
| API backend         | http://localhost:3000/health |

Connectez-vous avec les credentials `APP_USER_EMAIL` / `APP_USER_PASSWORD` définis à l'étape 4.

---

## Configuration avancée

### Ports personnalisés

Si des ports sont déjà utilisés sur votre hôte, surchargez-les dans `.env` :

```env
FRONTEND_PORT=8080
BACKEND_PORT=3001
PB_PORT=8091
OLLAMA_PORT=11435
```

### Utiliser OpenAI à la place d'Ollama

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Le modèle utilisé sera automatiquement `gpt-4o-mini`.

### Utiliser Groq (LLM cloud rapide et gratuit)

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
```

Le modèle utilisé sera `llama-3.1-8b-instant`.

### Changer de modèle Ollama

```env
OLLAMA_MODEL=llama3.2:3b
```

Puis tirer le nouveau modèle :

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

---

## Développement local

### Prérequis supplémentaires

- Node.js ≥ 22
- Un fichier `.env` configuré avec `POCKETBASE_URL=http://localhost:8090`

### Lancer PocketBase et Ollama seulement

```bash
docker compose up -d pocketbase ollama
```

### Lancer le backend en mode dev

```bash
cd backend
npm install
npm run dev    # tsx watch — rechargement à chaud
```

### Lancer le frontend en mode dev

```bash
cd frontend
npm install
npm run dev    # Vite — http://localhost:5173
```

Le proxy Vite redirige `/api` → `http://localhost:3000`.

---

## Structure du projet

```
wildix-bot-manager/
├── docker-compose.yml
├── .env.example
├── scripts/
│   └── setup.sh              # Initialisation première installation
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── index.ts           # Point d'entrée Hono
│       ├── lib/
│       │   ├── env.ts         # Validation variables d'env (Zod)
│       │   └── errors.ts      # AppError + errorHandler
│       ├── middleware/
│       │   └── auth.ts        # requireAuth + requireAdmin
│       ├── routes/
│       │   ├── auth.ts        # POST /auth/login|logout, GET /auth/me
│       │   ├── pbx.ts         # CRUD /pbx
│       │   ├── bots.ts        # CRUD /bots + clone
│       │   ├── tools.ts       # CRUD /tools
│       │   ├── ai.ts          # POST /ai/generate-prompt (SSE), /ai/suggest-tools
│       │   └── users.ts       # CRUD /users (admin only)
│       └── services/
│           ├── pocketbase.ts  # Singleton PB + auth helpers
│           ├── wildix.ts      # wilmaApi + xBeesApi + wimToolsApi
│           └── llm.ts         # Abstraction Ollama/OpenAI/Groq streaming
└── frontend/
    ├── Dockerfile
    ├── nginx.conf             # SPA fallback + proxy /api + support SSE
    └── src/
        ├── api/               # Clients HTTP (auth, pbx, bots, ai, users)
        ├── components/
        │   ├── ui/            # Button, Input, Badge, Dialog
        │   └── PromptGenerator.tsx  # Formulaire génération IA + streaming
        ├── pages/
        │   ├── Login.tsx
        │   ├── Dashboard.tsx  # Layout sidebar + routing
        │   ├── PBX.tsx        # Gestion credentials PBX
        │   ├── Bots.tsx       # Liste + clone + navigation
        │   ├── BotCreate.tsx  # Wizard création (4 étapes)
        │   ├── BotEdit.tsx    # Édition bot existant
        │   ├── Tools.tsx      # WIM Tools CRUD
        │   └── Settings.tsx   # Compte + gestion utilisateurs (admin)
        ├── stores/
        │   └── auth.ts        # Zustand (token persisté localStorage)
        └── types/
            ├── app.ts         # AppUser, PbxCredential, AuditLog
            └── wildix.ts      # VoiceBot, ChatBot, WimTool
```

---

## Commandes utiles

```bash
# Voir les logs en temps réel
docker compose logs -f

# Logs d'un service spécifique
docker compose logs -f backend

# Redémarrer un service
docker compose restart backend

# Mettre à jour après modification du code
docker compose up -d --build backend

# Accéder au shell d'un container
docker compose exec backend sh
docker compose exec pocketbase sh

# Lister les modèles Ollama disponibles
docker compose exec ollama ollama list

# Sauvegarder les données PocketBase
cp -r ./data/pocketbase ./data/pocketbase.backup.$(date +%Y%m%d)
```

---

## Sécurité

- Les tokens API Wildix sont stockés en base PocketBase avec accès restreint au propriétaire
- Le backend valide le token PocketBase sur chaque requête protégée
- Les routes `/users` sont réservées aux utilisateurs avec le rôle `admin`
- En production, restreignez le CORS dans `backend/src/index.ts` (actuellement `origin: '*'`)
- Activez HTTPS via un reverse proxy (nginx, Traefik, Caddy) devant le frontend

---

## Dépannage

### Le backend ne démarre pas
```bash
docker compose logs backend
# Vérifiez que POCKETBASE_URL est accessible depuis le container
docker compose exec backend wget -qO- http://pocketbase:8090/api/health
```

### PocketBase inaccessible
```bash
docker compose logs pocketbase
# Vérifiez le volume
ls -la ./data/pocketbase/
```

### Ollama : modèle non trouvé
```bash
docker compose exec ollama ollama list
docker compose exec ollama ollama pull qwen2.5:3b
```

### Génération IA très lente
Ollama tourne en CPU par défaut. Pour activer le GPU NVIDIA :
```yaml
# docker-compose.yml — service ollama
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

---

## Licence

MIT — Voir [LICENSE](LICENSE)
