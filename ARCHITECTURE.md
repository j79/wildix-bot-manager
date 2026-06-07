# Architecture — Wilma Bot Manager
> Document destiné à un lecteur non développeur. Dernière mise à jour : 2026-05-23.

---

## C'est quoi cette application ?

**Wilma Bot Manager** est un outil web de gestion de bots vocaux et chatbots pour la
plateforme de téléphonie **Wildix**. Il s'adresse aux techniciens et ingénieurs avant-vente
qui administrent des systèmes Wildix (PBX) pour leurs clients.

Il permet de :
- Connecter plusieurs PBX Wildix via leurs clés API
- Voir, créer, modifier et cloner les bots vocaux (WILMA) et chatbots (X-Bees) de chaque PBX
- Générer automatiquement le "cerveau" d'un bot (son prompt système) grâce à l'IA
- Gérer les WIM Tools (les intégrations que les bots peuvent appeler)

---

## Les grandes briques

```
                        ┌─────────────────────────────────────────┐
                        │            Navigateur de l'utilisateur   │
                        │         (React — interface graphique)    │
                        └──────────────────┬──────────────────────┘
                                           │ HTTPS
                        ┌──────────────────▼──────────────────────┐
                        │         NGINX (reverse proxy)            │
                        │  Sert l'interface + route /api → backend │
                        └────────────┬─────────────────────────────┘
                                     │
               ┌─────────────────────▼──────────────────────┐
               │           Backend Hono (Node.js)             │
               │  Le "chef d'orchestre" : vérifie les droits, │
               │  lit les clés API, appelle les services ext. │
               └──┬──────────────────┬────────────────────┬──┘
                  │                  │                    │
     ┌────────────▼──────┐  ┌────────▼────────┐  ┌───────▼──────────────┐
     │   Pocketbase       │  │   Ollama         │  │  APIs Wildix (cloud) │
     │  Base de données   │  │  IA locale       │  │  WILMA / X-Bees      │
     │  + Auth utilisateurs│  │  Génère les bots │  │  WIM Tools           │
     └───────────────────┘  └─────────────────┘  └──────────────────────┘
```

---

## À quoi sert chaque brique ?

### Le Frontend (React)
L'interface que tu vois dans le navigateur. Construit avec **React** (le framework
d'interface le plus populaire au monde). Il ne contient **aucune clé API** — il ne
fait que demander au backend de faire les choses à sa place.

### Le Backend (Hono / Node.js)
C'est le serveur intermédiaire. Son rôle :
- Vérifier que tu es bien connecté avant de t'autoriser à faire quoi que ce soit
- Lire les clés API Wildix depuis la base de données (tu ne les vois jamais en clair)
- Faire le relai entre le frontend et les APIs Wildix / Ollama / Google TTS

### Pocketbase
La base de données + système d'authentification. C'est un logiciel open-source en
un seul fichier qui remplace à lui seul une base de données classique + un système
de gestion des utilisateurs + une API REST automatique. Il a sa propre interface
d'administration accessible via le navigateur.

Stocke :
- Les comptes utilisateurs (email, mot de passe, rôle admin/user)
- Les credentials des PBX Wildix de chaque utilisateur
- Les logs d'audit (qui a fait quoi)

### Ollama
Un moteur d'IA qui tourne **localement sur ton serveur UNRAID**. Il exécute le
modèle de langage `qwen2.5:3b` pour générer les prompts systèmes des bots.
Avantage : aucune donnée ne sort de ton réseau, aucun coût d'API externe.
On peut aussi le remplacer par OpenAI ou Groq si on veut plus de puissance.

### NGINX
Un serveur web qui joue deux rôles :
1. Servir les fichiers de l'interface (comme ouvrir un fichier HTML)
2. Rediriger les requêtes `/api/…` vers le backend

---

## Comment les données circulent

### Connexion d'un utilisateur
```
1. Tu entres email + mot de passe dans le formulaire Login
2. Le frontend envoie ces infos au backend (/api/auth/login)
3. Le backend demande à Pocketbase de vérifier les credentials
4. Pocketbase retourne un "token" (une clé temporaire prouvant ton identité)
5. Ce token est stocké dans le navigateur
6. Toutes les requêtes suivantes incluent ce token
```

### Affichage des bots d'un PBX
```
1. Tu sélectionnes un PBX dans l'interface
2. Le frontend demande au backend la liste des bots (/api/bots?pbxId=xxx)
3. Le backend lit la clé API de ce PBX dans Pocketbase
4. Le backend appelle l'API Wildix avec cette clé
5. Il retourne la liste des bots au frontend
6. Le frontend les affiche
```

### Génération d'un prompt de bot par IA
```
1. Tu remplis un formulaire (nom du bot, entreprise, objectif…)
2. Le backend envoie ces infos à Ollama
3. Ollama génère le prompt en 8 sections (rôle, style, règles, etc.)
4. La réponse arrive en streaming (comme ChatGPT qui tape lettre par lettre)
5. Le frontend affiche les sections au fur et à mesure
```

---

## Les rôles utilisateurs

| Rôle  | Peut faire                                                   |
|-------|--------------------------------------------------------------|
| admin | Tout — y compris gérer les comptes utilisateurs              |
| user  | Gérer uniquement ses propres PBX et les bots associés        |

---

## Structure des fichiers sur le serveur

```
/mnt/user/Projets/wildix-bot-manager/   ← le projet (partagé via SMB sur P:\)
├── docker-compose.yml                  ← démarre tous les services en une commande
├── .env                                ← tes clés et configuration (jamais sur GitHub)
├── .env.example                        ← modèle de .env à copier
├── frontend/                           ← l'interface graphique (React)
│   ├── src/
│   │   ├── pages/                      ← les "écrans" de l'application
│   │   ├── components/                 ← morceaux d'interface réutilisables
│   │   ├── api/                        ← toutes les requêtes réseau
│   │   ├── stores/                     ← état global (ex: utilisateur connecté)
│   │   └── types/                      ← définitions des structures de données
│   └── Dockerfile
├── backend/
│   ├── src/
│   │   ├── routes/                     ← les endpoints de l'API (/auth, /bots, etc.)
│   │   ├── services/                   ← logique métier (Wildix, Pocketbase, Ollama)
│   │   └── lib/                        ← utilitaires (config, gestion d'erreurs)
│   └── Dockerfile
└── data/                               ← données persistantes (hors GitHub)
    ├── pocketbase/                     ← base de données
    └── ollama/                         ← modèles IA téléchargés
```

---

## Les URLs d'accès (sur UNRAID)

| Service              | URL                              | Quand l'utiliser                       |
|----------------------|----------------------------------|----------------------------------------|
| Application (future) | http://192.168.1.76:80           | Utiliser l'app au quotidien            |
| Backend API (future) | http://192.168.1.76:3000         | Tester les endpoints directement       |
| Pocketbase Admin     | http://192.168.1.76:8090/_/      | Gérer la base de données               |
| Ollama API           | http://192.168.1.76:11434        | Vérifier les modèles IA disponibles    |
| NPM Admin            | http://192.168.1.76:81           | Configurer les domaines / HTTPS        |

---

## Choix techniques — pourquoi ces outils ?

| Choix          | Raison principale                                             |
|----------------|---------------------------------------------------------------|
| React          | Standard de l'industrie, énorme écosystème                    |
| Hono           | Très léger, TypeScript natif, moderne                         |
| Pocketbase     | Un seul binaire = zéro infra DB à gérer, auth intégrée        |
| Ollama         | IA 100% locale, pas de coût d'API, données qui ne partent pas |
| Docker Compose | Un seul fichier pour tout démarrer, facile à redistribuer     |
| TypeScript     | Détecte les erreurs avant l'exécution, code plus fiable       |
| Tailwind CSS   | CSS sans écrire de CSS, résultat propre rapidement            |
