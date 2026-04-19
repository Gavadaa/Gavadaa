# DJ Skill Tracker — PRD

## Vision
App mobile cross-plateforme (iOS/Android/Web Expo) type "fitness tracker" pour DJs. Gamification de la pratique avec un vrai système de rangs compétitif (Cuivre → Maître) + invitations d'amis + accès complet gratuit.

## Stack
- Frontend: Expo (React Native) + expo-router, AsyncStorage, axios, expo-linear-gradient, expo-document-picker
- Backend: FastAPI + MongoDB (motor), JWT Bearer auth, bcrypt
- Audio: librosa (BPM, stabilité, transitions brusques)

## Features
1. **Auth Email/Password** — register/login/me/logout (JWT Bearer, AsyncStorage)
2. **Dashboard** — rang actuel, badge métallique, barre XP, 4 stats (temps, sessions, streak, défis), graph 7 jours, échelle des rangs
3. **Log Sessions** — type (mix x1.0 / transitions x1.2 / freestyle x1.5), durée, notes, XP auto, update streak
4. **Défis avec vérification auto** — 5 défis, auto-check (streak, durée de session, analyse audio) — bouton VERROUILLÉ si critères non remplis
5. **Stats** — répartition par type, analyse audio (mp3/wav → BPM, stabilité, score), stats avancées (toutes débloquées)
6. **Système d'amis** — code d'invitation 6 caractères (ex: `GUGVH9`), ajout via code, partage, liste avec progression de chaque ami
7. **Classement** — toggle AMIS / MONDIAL dans le profil

## Rank system
- 8 rangs × 5 divisions (V → IV → III → II → I) = 40 niveaux
- 500 XP / division (20 000 XP max)
- Cuivre → Bronze → Argent → Or → Platine → Diamant → Champion → Maître

## Business
**Full access gratuit** — pas de paywall, toutes les fonctionnalités débloquées pour tous.

## Endpoints
- `/api/auth/*` — register, login, me, logout
- `/api/sessions` — CRUD
- `/api/challenges` — list (avec meets_requirements + progress), complete (vérifie auto)
- `/api/stats` — by_day, by_type, streak, rank_info
- `/api/leaderboard` — top 50
- `/api/friends/me` — GET mon code
- `/api/friends` — GET liste amis avec progression
- `/api/friends/add` — POST `{friend_code}` (bidirectionnel)
- `/api/friends/{id}` — DELETE
- `/api/audio/analyze` — upload audio → BPM/stabilité/transitions (stocké en DB)
- `/api/ranks` — rank table

## Tests
- Iteration 1: 16/16 backend + frontend e2e
- Iteration 2: 12/12 (défis vérification, amis, premium removed)
