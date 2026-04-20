# DJ Skill Tracker — PRD

## Vision
App mobile cross-plateforme (iOS/Android/Web Expo) type "fitness tracker" pour DJs. Gamification de la pratique avec système de rangs compétitif (Cuivre → Maître), profils sociaux enrichis, défis auto-générés qui scalent avec le niveau, et système d'amis.

## Stack
- Frontend: Expo (React Native) + expo-router, AsyncStorage, axios, expo-linear-gradient, expo-document-picker, expo-image-picker, expo-clipboard
- Backend: FastAPI + MongoDB (motor), JWT Bearer auth, bcrypt
- Audio: librosa (BPM, stabilité, transitions)

## Features
1. **Auth Email/Password** (JWT Bearer, AsyncStorage)
2. **Dashboard** — rang actuel, badge métallique, barre XP, 4 stats, graph 7 jours, échelle des rangs
3. **Log Sessions** — type (mix x1.0 / transitions x1.2 / freestyle x1.5), durée, notes, XP auto, streak
4. **Défis multi-catégories** :
   - **JOUR** : 3 défis/jour auto-sélectionnés (reset minuit UTC), difficulté qui scale avec le niveau
   - **SEMAINE** : 2 défis/semaine (reset lundi)
   - **LÉGENDES** : 5 défis permanents "one-shot" (Beatmatch sans sync, Marathon 2h, etc.)
   - Tous vérifiés automatiquement (streak, sessions, analyse audio) — bouton VERROUILLÉ si non rempli
5. **Stats** — répartition par type, analyse audio (mp3/wav → BPM, stabilité), stats avancées (toutes débloquées, pas de paywall)
6. **Profil enrichi** : avatar photo, bio (300 car.), âge, ville, styles musicaux (18 choix, max 10), 7 réseaux sociaux (Instagram, TikTok, Facebook, Twitter/X, YouTube, Spotify, SoundCloud) — tous optionnels et publics
7. **Profil public** des amis cliquable avec liens sociaux cliquables
8. **Système d'amis** — code d'invitation 6 caractères + **copie automatique au clic**, ajout bidirectionnel
9. **Classement** — toggle AMIS / MONDIAL avec avatars

## Rank system
- 8 rangs × 5 divisions (V → IV → III → II → I) = 40 niveaux
- 500 XP / division (20 000 XP max)
- Cuivre → Bronze → Argent → Or → Platine → Diamant → Champion → Maître

## Difficulty scaling
- XP reward = base_xp × (1 + level/25) → jusqu'à ~2.6× au max
- min_duration / min_minutes / min_sessions scalent aussi avec le niveau

## Business
**Full access gratuit pour tous** (is_premium=true pour tous les users).

## Endpoints
- `/api/auth/*` — register, login, me, logout
- `/api/sessions` — CRUD
- `/api/challenges` — GET retourne `{daily, weekly, permanent}`
- `/api/challenges/complete` — POST `{challenge_id, category}`
- `/api/stats` — by_day, by_type, streak, rank_info
- `/api/leaderboard` — top 50
- `/api/profile` — PUT (bio, avatar_base64, music_styles, age, city, socials)
- `/api/users/{id}` — GET profil public
- `/api/friends/me` / `/api/friends` / `/api/friends/add` / `/api/friends/{id}`
- `/api/audio/analyze` — upload audio
- `/api/ranks` — rank table

## Tests
- Iteration 1: 16/16 backend + frontend e2e ✓
- Iteration 2: 12/12 (défis vérification, amis, premium removed) ✓
- Iteration 3: 17/17 backend (profil, profil public, daily/weekly) ✓
