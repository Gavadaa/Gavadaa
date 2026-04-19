from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import tempfile
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="DJ Skill Tracker API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

JWT_ALGORITHM = "HS256"

# ---------------- Rank system ----------------
RANKS = ["Cuivre", "Bronze", "Argent", "Or", "Platine", "Diamant", "Champion", "Maître"]
DIVISIONS_PER_RANK = 5  # V, IV, III, II, I
XP_PER_DIVISION = 500   # XP needed to move up one division
# Total levels: 8 * 5 = 40. Max XP = 40 * 500 = 20 000

def calc_rank_info(total_xp: int) -> dict:
    total_xp = max(0, int(total_xp))
    max_level = len(RANKS) * DIVISIONS_PER_RANK - 1
    level = min(total_xp // XP_PER_DIVISION, max_level)
    rank_idx = level // DIVISIONS_PER_RANK
    division_idx = level % DIVISIONS_PER_RANK  # 0 = V (lowest), 4 = I (highest)
    division_roman = ["V", "IV", "III", "II", "I"][division_idx]
    # XP progress within current division
    xp_in_division = total_xp - level * XP_PER_DIVISION
    xp_for_next = XP_PER_DIVISION
    at_max = level >= max_level
    if at_max:
        xp_in_division = XP_PER_DIVISION
        xp_for_next = XP_PER_DIVISION
    return {
        "total_xp": total_xp,
        "level": level,
        "rank": RANKS[rank_idx],
        "division": division_roman,
        "rank_label": f"{RANKS[rank_idx]} {division_roman}",
        "xp_in_division": xp_in_division,
        "xp_for_next_division": xp_for_next,
        "progress_pct": round((xp_in_division / xp_for_next) * 100, 1),
        "at_max_rank": at_max,
    }

def xp_for_session(duration_minutes: int, session_type: str) -> int:
    mult = {"mix": 1.0, "transitions": 1.2, "freestyle": 1.5}.get(session_type, 1.0)
    return int(duration_minutes * mult)

# ---------------- Auth helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = payload.get("sub")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    dj_name: str = Field(min_length=2, max_length=30)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class SessionIn(BaseModel):
    duration_minutes: int = Field(ge=1, le=600)
    session_type: str  # mix | transitions | freestyle
    notes: Optional[str] = None

class ChallengeCompleteIn(BaseModel):
    challenge_id: str

class AudioAnalysisOut(BaseModel):
    filename: str
    bpm: float
    bpm_stability: float
    duration_sec: float
    transitions_detected: int
    rough_transitions: int
    score: int
    feedback: List[str]

# ---------------- User helpers ----------------
def serialize_user(user: dict) -> dict:
    u = {k: v for k, v in user.items() if k not in ("_id", "password_hash")}
    u["rank_info"] = calc_rank_info(u.get("total_xp", 0))
    return u

import secrets
def _gen_friend_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))

# ---------------- Default challenges ----------------
DEFAULT_CHALLENGES = [
    {
        "id": "beatmatch-no-sync",
        "title": "Beatmatch sans sync",
        "description": "Réalise un beatmatch manuel sans SYNC pendant une session de transitions d'au moins 20 min (auto-déclaré + session requise).",
        "xp_reward": 300,
        "difficulty": "hard",
        "icon": "sliders",
        "verification": "self_declare_with_session",
        "requirements": {"session_type": "transitions", "min_duration": 20},
    },
    {
        "id": "clean-transition",
        "title": "Transition propre",
        "description": "Analyse un mix avec moins de 5 transitions brusques (vérifié via l'analyse audio).",
        "xp_reward": 200,
        "difficulty": "medium",
        "icon": "git-merge",
        "verification": "audio_analysis",
        "requirements": {"max_rough_transitions": 5, "min_score": 60},
    },
    {
        "id": "daily-grind",
        "title": "Routine quotidienne",
        "description": "Pratique pendant 7 jours consécutifs.",
        "xp_reward": 500,
        "difficulty": "medium",
        "icon": "flame",
        "verification": "auto_streak",
        "requirements": {"min_streak": 7},
    },
    {
        "id": "freestyle-30",
        "title": "Freestyle 30 min",
        "description": "Réalise une session freestyle de minimum 30 minutes.",
        "xp_reward": 250,
        "difficulty": "easy",
        "icon": "zap",
        "verification": "auto_session",
        "requirements": {"session_type": "freestyle", "min_duration": 30},
    },
    {
        "id": "marathon-2h",
        "title": "Marathon 2h",
        "description": "Enchaîne une session de mix de 2 heures sans pause.",
        "xp_reward": 400,
        "difficulty": "hard",
        "icon": "clock",
        "verification": "auto_session",
        "requirements": {"session_type": "mix", "min_duration": 120},
    },
]

async def verify_challenge(user_id: str, challenge: dict) -> tuple[bool, str]:
    v = challenge.get("verification")
    req = challenge.get("requirements", {})
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if v == "auto_streak":
        if user.get("streak_days", 0) >= req.get("min_streak", 7):
            return True, "OK"
        return False, f"Streak actuel : {user.get('streak_days',0)}j, requis : {req['min_streak']}j"
    if v == "auto_session":
        st = req["session_type"]; md = req["min_duration"]
        cnt = await db.sessions.count_documents({"user_id": user_id, "session_type": st, "duration_minutes": {"$gte": md}})
        if cnt > 0:
            return True, "OK"
        return False, f"Aucune session {st} de {md}+ min trouvée"
    if v == "self_declare_with_session":
        st = req["session_type"]; md = req["min_duration"]
        cnt = await db.sessions.count_documents({"user_id": user_id, "session_type": st, "duration_minutes": {"$gte": md}})
        if cnt > 0:
            return True, "OK"
        return False, f"Tu dois d'abord logger une session {st} de {md}+ min"
    if v == "audio_analysis":
        last = await db.audio_analyses.find_one({"user_id": user_id}, sort=[("created_at", -1)])
        if not last:
            return False, "Importe d'abord un fichier audio dans l'onglet Stats"
        if last["rough_transitions"] <= req.get("max_rough_transitions", 5) and last["score"] >= req.get("min_score", 60):
            return True, "OK"
        return False, f"Dernier mix : {last['rough_transitions']} transitions brusques, score {last['score']}/100"
    return True, "OK"

# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "DJ Skill Tracker API", "status": "online"}

# ---- Auth ----
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "dj_name": body.dj_name,
        "total_xp": 0,
        "total_minutes": 0,
        "sessions_count": 0,
        "streak_days": 0,
        "last_session_date": None,
        "completed_challenges": [],
        "is_premium": True,
        "role": "user",
        "friend_code": _gen_friend_code(),
        "friends": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return {"token": token, "user": serialize_user(user_doc)}

@api_router.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_access_token(user["id"], user["email"])
    return {"token": token, "user": serialize_user(user)}

@api_router.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return serialize_user(current)

@api_router.post("/auth/logout")
async def logout(current=Depends(get_current_user)):
    return {"ok": True}

# ---- Sessions ----
@api_router.post("/sessions")
async def create_session(body: SessionIn, current=Depends(get_current_user)):
    if body.session_type not in ("mix", "transitions", "freestyle"):
        raise HTTPException(status_code=400, detail="Type de session invalide")
    xp = xp_for_session(body.duration_minutes, body.session_type)
    session_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    session_doc = {
        "id": session_id,
        "user_id": current["id"],
        "duration_minutes": body.duration_minutes,
        "session_type": body.session_type,
        "notes": body.notes or "",
        "xp_earned": xp,
        "created_at": now.isoformat(),
        "date": now.date().isoformat(),
    }
    await db.sessions.insert_one(session_doc)

    # Update streak
    user = await db.users.find_one({"id": current["id"]})
    today = now.date().isoformat()
    last = user.get("last_session_date")
    streak = user.get("streak_days", 0)
    if last == today:
        pass  # same day, no change
    elif last is None:
        streak = 1
    else:
        last_date = datetime.fromisoformat(last).date() if "T" not in last else datetime.fromisoformat(last).date()
        delta = (now.date() - last_date).days
        if delta == 1:
            streak += 1
        elif delta > 1:
            streak = 1

    await db.users.update_one(
        {"id": current["id"]},
        {"$inc": {"total_xp": xp, "total_minutes": body.duration_minutes, "sessions_count": 1},
         "$set": {"last_session_date": today, "streak_days": streak}},
    )
    session_doc.pop("_id", None)
    updated = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return {"session": session_doc, "user": serialize_user(updated)}

@api_router.get("/sessions")
async def list_sessions(current=Depends(get_current_user), limit: int = 50):
    cursor = db.sessions.find({"user_id": current["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)

@api_router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current=Depends(get_current_user)):
    session = await db.sessions.find_one({"id": session_id, "user_id": current["id"]})
    if not session:
        raise HTTPException(status_code=404, detail="Session non trouvée")
    await db.sessions.delete_one({"id": session_id})
    await db.users.update_one(
        {"id": current["id"]},
        {"$inc": {"total_xp": -int(session["xp_earned"]),
                  "total_minutes": -int(session["duration_minutes"]),
                  "sessions_count": -1}},
    )
    updated = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "user": serialize_user(updated)}

# ---- Stats ----
@api_router.get("/stats")
async def get_stats(current=Depends(get_current_user)):
    user_id = current["id"]
    # Last 30 days
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    sessions = await db.sessions.find(
        {"user_id": user_id, "created_at": {"$gte": since}}, {"_id": 0}
    ).sort("created_at", 1).to_list(500)

    # By day (last 7 days)
    by_day = {}
    for i in range(7):
        d = (datetime.now(timezone.utc).date() - timedelta(days=i)).isoformat()
        by_day[d] = 0
    for s in sessions:
        d = s.get("date") or s["created_at"][:10]
        if d in by_day:
            by_day[d] += s["duration_minutes"]

    # By type
    by_type = {"mix": 0, "transitions": 0, "freestyle": 0}
    for s in sessions:
        t = s["session_type"]
        if t in by_type:
            by_type[t] += s["duration_minutes"]

    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return {
        "by_day": [{"date": d, "minutes": by_day[d]} for d in sorted(by_day.keys())],
        "by_type": by_type,
        "total_sessions_30d": len(sessions),
        "total_minutes_30d": sum(s["duration_minutes"] for s in sessions),
        "streak_days": user.get("streak_days", 0),
        "rank_info": calc_rank_info(user.get("total_xp", 0)),
    }

# ---- Challenges ----
@api_router.get("/challenges")
async def list_challenges(current=Depends(get_current_user)):
    completed = set(current.get("completed_challenges", []))
    out = []
    for c in DEFAULT_CHALLENGES:
        done = c["id"] in completed
        if done:
            progress_txt = "Complété"
            meets = True
        else:
            meets, progress_txt = await verify_challenge(current["id"], c)
        out.append({**c, "completed": done, "meets_requirements": meets, "progress": progress_txt})
    return out

@api_router.post("/challenges/complete")
async def complete_challenge(body: ChallengeCompleteIn, current=Depends(get_current_user)):
    challenge = next((c for c in DEFAULT_CHALLENGES if c["id"] == body.challenge_id), None)
    if not challenge:
        raise HTTPException(status_code=404, detail="Défi introuvable")
    if body.challenge_id in current.get("completed_challenges", []):
        raise HTTPException(status_code=400, detail="Défi déjà complété")
    ok, msg = await verify_challenge(current["id"], challenge)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Critères non remplis : {msg}")
    await db.users.update_one(
        {"id": current["id"]},
        {"$push": {"completed_challenges": body.challenge_id},
         "$inc": {"total_xp": challenge["xp_reward"]}},
    )
    updated = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return {"ok": True, "user": serialize_user(updated), "xp_earned": challenge["xp_reward"]}

# ---- Leaderboard ----
@api_router.get("/leaderboard")
async def leaderboard(limit: int = 50):
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0, "email": 0}).sort("total_xp", -1).limit(limit)
    users = await cursor.to_list(length=limit)
    out = []
    for idx, u in enumerate(users):
        out.append({
            "rank_position": idx + 1,
            "dj_name": u.get("dj_name", "DJ"),
            "total_xp": u.get("total_xp", 0),
            "total_minutes": u.get("total_minutes", 0),
            "sessions_count": u.get("sessions_count", 0),
            "rank_info": calc_rank_info(u.get("total_xp", 0)),
        })
    return out

# ---- Premium toggle (mock) ----
@api_router.post("/premium/toggle")
async def toggle_premium(current=Depends(get_current_user)):
    new_val = not bool(current.get("is_premium", False))
    await db.users.update_one({"id": current["id"]}, {"$set": {"is_premium": new_val}})
    updated = await db.users.find_one({"id": current["id"]}, {"_id": 0, "password_hash": 0})
    return {"is_premium": new_val, "user": serialize_user(updated)}

# ---- Audio analysis ----
@api_router.post("/audio/analyze", response_model=AudioAnalysisOut)
async def analyze_audio(file: UploadFile = File(...), current=Depends(get_current_user)):
    import librosa
    import numpy as np
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(status_code=400, detail="Fichier vide")
    suffix = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        tmp.write(contents)
        tmp.close()
        y, sr = librosa.load(tmp.name, sr=22050, mono=True, duration=300)  # cap at 5 min
        duration = float(librosa.get_duration(y=y, sr=sr))
        tempo_arr, beats = librosa.beat.beat_track(y=y, sr=sr)
        tempo_val = tempo_arr.item() if hasattr(tempo_arr, "item") else float(tempo_arr)
        # Stability via onset strength variance
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        tempogram = librosa.feature.tempogram(onset_envelope=onset_env, sr=sr)
        stability = float(1.0 / (1.0 + np.std(np.mean(tempogram, axis=1))))
        stability = max(0.0, min(1.0, stability))
        # Transitions via spectral flux peaks
        onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        # Rough = big energy jumps
        rms = librosa.feature.rms(y=y)[0]
        diffs = np.abs(np.diff(rms))
        threshold = float(np.mean(diffs) + 2 * np.std(diffs))
        rough = int(np.sum(diffs > threshold))
        transitions = int(max(1, len(onset_frames) // 50))
        score = int(min(100, max(0, stability * 70 + (30 if rough < 5 else 10))))
        feedback = []
        if rough > 10:
            feedback.append(f"{rough} transitions brusques détectées, travaille les fondus.")
        if stability < 0.4:
            feedback.append("BPM instable, entraîne-toi au beatmatch manuel.")
        if score >= 75:
            feedback.append("Excellent mix, très bonne stabilité BPM.")
        if not feedback:
            feedback.append("Mix correct, continue à pratiquer la régularité.")
        result = AudioAnalysisOut(
            filename=file.filename or "audio",
            bpm=round(tempo_val, 1),
            bpm_stability=round(stability, 2),
            duration_sec=round(duration, 1),
            transitions_detected=transitions,
            rough_transitions=rough,
            score=score,
            feedback=feedback,
        )
        await db.audio_analyses.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": current["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            **result.dict(),
        })
        return result
    except HTTPException:
        raise
    except Exception as e:
        logging.exception("audio analysis failed")
        raise HTTPException(status_code=500, detail=f"Analyse échouée: {str(e)[:120]}")
    finally:
        try:
            os.unlink(tmp.name)
        except Exception:
            pass

# ---- Friends ----
class AddFriendIn(BaseModel):
    friend_code: str = Field(min_length=6, max_length=6)

@api_router.get("/friends/me")
async def my_friend_code(current=Depends(get_current_user)):
    code = current.get("friend_code")
    if not code:
        code = _gen_friend_code()
        await db.users.update_one({"id": current["id"]}, {"$set": {"friend_code": code}})
    return {"friend_code": code, "dj_name": current["dj_name"]}

@api_router.get("/friends")
async def list_friends(current=Depends(get_current_user)):
    friend_ids = current.get("friends", [])
    if not friend_ids:
        return []
    friends = await db.users.find({"id": {"$in": friend_ids}}, {"_id": 0, "password_hash": 0, "email": 0}).to_list(100)
    out = []
    for f in friends:
        out.append({
            "id": f["id"],
            "dj_name": f["dj_name"],
            "total_xp": f.get("total_xp", 0),
            "total_minutes": f.get("total_minutes", 0),
            "sessions_count": f.get("sessions_count", 0),
            "streak_days": f.get("streak_days", 0),
            "completed_challenges": len(f.get("completed_challenges", [])),
            "rank_info": calc_rank_info(f.get("total_xp", 0)),
            "last_session_date": f.get("last_session_date"),
        })
    out.sort(key=lambda x: x["total_xp"], reverse=True)
    return out

@api_router.post("/friends/add")
async def add_friend(body: AddFriendIn, current=Depends(get_current_user)):
    code = body.friend_code.upper().strip()
    if code == current.get("friend_code"):
        raise HTTPException(status_code=400, detail="Tu ne peux pas t'ajouter toi-même")
    friend = await db.users.find_one({"friend_code": code})
    if not friend:
        raise HTTPException(status_code=404, detail="Code d'ami introuvable")
    fid = friend["id"]
    if fid in current.get("friends", []):
        raise HTTPException(status_code=400, detail="Vous êtes déjà amis")
    # bidirectional
    await db.users.update_one({"id": current["id"]}, {"$addToSet": {"friends": fid}})
    await db.users.update_one({"id": fid}, {"$addToSet": {"friends": current["id"]}})
    return {"ok": True, "friend": {"id": fid, "dj_name": friend["dj_name"]}}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(friend_id: str, current=Depends(get_current_user)):
    await db.users.update_one({"id": current["id"]}, {"$pull": {"friends": friend_id}})
    await db.users.update_one({"id": friend_id}, {"$pull": {"friends": current["id"]}})
    return {"ok": True}

# ---- Rank table (for UI) ----
@api_router.get("/ranks")
async def ranks_table():
    table = []
    for r_idx, r in enumerate(RANKS):
        for d_idx, d in enumerate(["V", "IV", "III", "II", "I"]):
            level = r_idx * DIVISIONS_PER_RANK + d_idx
            table.append({
                "level": level,
                "rank": r,
                "division": d,
                "label": f"{r} {d}",
                "min_xp": level * XP_PER_DIVISION,
            })
    return {"ranks": RANKS, "divisions_per_rank": DIVISIONS_PER_RANK, "xp_per_division": XP_PER_DIVISION, "table": table}

# ---------------- Startup ----------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("friend_code")
    await db.sessions.create_index("user_id")
    await db.audio_analyses.create_index([("user_id", 1), ("created_at", -1)])

    # Migrate existing users: give them friend_code + friends + premium=True if missing
    async for u in db.users.find({"$or": [
        {"friend_code": {"$exists": False}},
        {"friends": {"$exists": False}},
        {"is_premium": False},
    ]}, {"_id": 0, "id": 1, "friend_code": 1, "friends": 1}):
        updates = {}
        if not u.get("friend_code"):
            # ensure uniqueness
            for _ in range(5):
                code = _gen_friend_code()
                if not await db.users.find_one({"friend_code": code}):
                    updates["friend_code"] = code
                    break
        if "friends" not in u:
            updates["friends"] = []
        updates["is_premium"] = True
        if updates:
            await db.users.update_one({"id": u["id"]}, {"$set": updates})

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@djtracker.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "dj_name": "DJ Admin",
            "total_xp": 0,
            "total_minutes": 0,
            "sessions_count": 0,
            "streak_days": 0,
            "last_session_date": None,
            "completed_challenges": [],
            "is_premium": True,
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded admin user: {admin_email}")
    else:
        # keep hash in sync with env
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

@app.on_event("shutdown")
async def shutdown():
    client.close()
