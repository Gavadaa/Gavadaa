# DJ Skill Tracker — PRD

## Vision
Application mobile cross-plateforme (iOS/Android/Web via Expo) type "fitness tracker" mais pour DJs. Gamification de la pratique avec un vrai système de rangs compétitif (Cuivre → Maître).

## Stack
- Frontend: Expo (React Native) + expo-router, AsyncStorage, axios, expo-linear-gradient, expo-blur, expo-document-picker
- Backend: FastAPI + MongoDB (motor), JWT Bearer auth, bcrypt
- Audio analysis: librosa (BPM, stabilité, transitions brusques)

## Features (MVP)
1. **Auth Email/Password** (JWT Bearer, AsyncStorage) — register/login/logout/me
2. **Dashboard** — rang actuel, badge métallique, barre XP néon, 4 stats (temps, sessions, streak, défis), graphique 7 jours, échelle des rangs
3. **Log Sessions** — type (mix x1.0 / transitions x1.2 / freestyle x1.5), durée, notes, XP automatique, update streak
4. **Défis** — 5 défis par défaut (Beatmatch sans sync, Transition propre, etc.) avec XP reward
5. **Stats** — répartition par type, analyse audio (import mp3/wav → BPM, stabilité, transitions brusques, score), stats avancées premium blurrées
6. **Profil** — toggle Premium (mock), classement mondial, déconnexion

## Rank system
- **8 rangs**: Cuivre, Bronze, Argent, Or, Platine, Diamant, Champion, Maître
- **5 divisions par rang**: V → IV → III → II → I (40 niveaux total)
- **500 XP** par division (20 000 XP total au max)
- XP = durée × multiplicateur du type

## Business — MOCKED
Toggle Premium côté profil → débloque la section "Stats avancées" (blur + lock sinon).

## Design
Dark mode tactique / club, accents néon (#00E5FF cyan, #FF007F magenta, #39FF14 vert acide), badges métalliques par rang.

## Endpoints
- `/api/auth/*` — register, login, me, logout
- `/api/sessions` — CRUD (GET list, POST create, DELETE by id)
- `/api/challenges` — GET list, POST complete
- `/api/stats` — by_day, by_type, streak, rank_info
- `/api/leaderboard` — top 50 par XP
- `/api/premium/toggle` — toggle mock
- `/api/audio/analyze` — multipart upload → BPM/stabilité/transitions
- `/api/ranks` — rank table
