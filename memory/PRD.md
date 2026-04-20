# DJ Skill Tracker — PRD

## Vision
App mobile cross-plateforme (iOS/Android/Web Expo) type "fitness tracker" pour DJs. Gamification avec rangs compétitifs, vérification automatique des sessions par analyse audio, défis journaliers/hebdo qui scalent, système social complet.

## Stack
- Frontend: Expo (React Native) + expo-router, AsyncStorage, axios, expo-linear-gradient, expo-document-picker, expo-image-picker, expo-clipboard, expo-notifications, expo-device
- Backend: FastAPI + MongoDB (motor), JWT Bearer auth, bcrypt, librosa

## Features
1. **Auth Email/Password** (JWT Bearer, AsyncStorage)
2. **Dashboard** — rang, badge métallique, barre XP, 4 stats, graph 7 jours
3. **Sessions**
   - **Mode MANUEL** : type + durée + notes → XP auto
   - **Mode UPLOAD MIX** : upload audio → librosa détecte durée réelle + BPM + stabilité + transitions brusques → score qualité 0-100 → **bonus XP jusqu'à +50%** si mix propre
   - **Édition** : tap sur une session → modal avec modif type/durée/notes + bouton supprimer (XP recalculés, bonus qualité préservé)
4. **Défis** : JOUR (3/jour reset minuit UTC), SEMAINE (2/semaine reset lundi), LÉGENDES (5 permanents) — tous vérifiés automatiquement, difficulté scale avec niveau
5. **Stats** — répartition par type, analyse audio standalone, stats avancées
6. **Profil enrichi** : avatar photo, bio, âge, ville, 18 styles musicaux, 7 réseaux sociaux, tous publics et cliquables
7. **Profil public des amis** (tap → modal)
8. **Système d'amis** : code 6 caractères avec **copie automatique**
9. **Classement** : toggle AMIS/MONDIAL, avatars
10. **Notifications** : rappel quotidien à 19h00 (local) — toggle ON/OFF dans le profil

## Rank system
8 rangs × 5 divisions (V→I) = 40 niveaux. 500 XP / division.
Cuivre → Bronze → Argent → Or → Platine → Diamant → Champion → Maître

## Endpoints
- `/api/auth/*`
- `/api/sessions` (POST manuel, GET list, DELETE, PATCH)
- `/api/sessions/upload` (POST multipart → analyse librosa + création session avec score qualité)
- `/api/challenges` / `/api/challenges/complete`
- `/api/stats`
- `/api/leaderboard`
- `/api/profile` (PUT), `/api/users/{id}` (GET public)
- `/api/friends/*`
- `/api/audio/analyze` (standalone)
- `/api/ranks`

## Business — Full access gratuit pour tous

## Tests
- Iter 1: 16/16 ✓
- Iter 2: 12/12 ✓
- Iter 3: 17/17 ✓
- Iter 4: 14/14 backend ✓ (audio upload, PATCH, delete, notifications toggle)
