"""
Backend API tests for DJ Skill Tracker
Tests: auth, sessions, challenges, stats, leaderboard, premium, rank progression
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)

# Test user credentials
TEST_EMAIL = f"test_dj_{int(time.time())}@test.com"
TEST_PASSWORD = "test1234"
TEST_DJ_NAME = "DJ Test Flame"

# Admin credentials
ADMIN_EMAIL = "admin@djtracker.com"
ADMIN_PASSWORD = "admin123"


class TestAPIRoot:
    """Test API root endpoint"""

    def test_api_root_online(self):
        """Backend /api/ root returns online status"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "online"
        assert "DJ Skill Tracker" in data["message"]
        print("✓ API root returns online status")


class TestAuth:
    """Authentication flow tests"""

    def test_register_creates_user_with_rank_info(self):
        """POST /api/auth/register creates user, returns JWT + user with rank_info"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "dj_name": TEST_DJ_NAME,
            },
        )
        assert response.status_code == 200, f"Registration failed: {response.text}"

        data = response.json()
        assert "token" in data, "Token missing in response"
        assert "user" in data, "User missing in response"

        user = data["user"]
        assert user["email"] == TEST_EMAIL.lower()
        assert user["dj_name"] == TEST_DJ_NAME
        assert user["total_xp"] == 0
        assert user["total_minutes"] == 0
        assert user["sessions_count"] == 0

        # Verify rank_info structure
        rank_info = user["rank_info"]
        assert rank_info["rank"] == "Cuivre"
        assert rank_info["division"] == "V"
        assert rank_info["rank_label"] == "Cuivre V"
        assert rank_info["level"] == 0
        assert rank_info["total_xp"] == 0
        assert rank_info["xp_for_next_division"] == 500
        assert rank_info["xp_in_division"] == 0

        print(f"✓ Registration successful: {user['dj_name']} at {rank_info['rank_label']}")

    def test_login_with_same_credentials(self):
        """POST /api/auth/login with same credentials works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        assert response.status_code == 200, f"Login failed: {response.text}"

        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL.lower()
        print("✓ Login successful with registered credentials")

    def test_get_me_with_bearer_token(self):
        """GET /api/auth/me with Bearer token returns user"""
        # Login first to get token
        login_resp = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        token = login_resp.json()["token"]

        # Test /auth/me
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        user = response.json()
        assert user["email"] == TEST_EMAIL.lower()
        assert "rank_info" in user
        print("✓ GET /auth/me returns user with Bearer token")

    def test_login_invalid_credentials(self):
        """Login with invalid credentials returns 401"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpassword"},
        )
        assert response.status_code == 401
        print("✓ Invalid credentials rejected")


class TestSessions:
    """Session CRUD and XP calculation tests"""

    @pytest.fixture
    def auth_token(self):
        """Get auth token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        return response.json()["token"]

    def test_create_session_freestyle_60min(self, auth_token):
        """POST /api/sessions with freestyle 60min returns session with XP=90"""
        response = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"duration_minutes": 60, "session_type": "freestyle", "notes": "Test session"},
        )
        assert response.status_code == 200, f"Session creation failed: {response.text}"

        data = response.json()
        assert "session" in data
        assert "user" in data

        session = data["session"]
        assert session["duration_minutes"] == 60
        assert session["session_type"] == "freestyle"
        assert session["xp_earned"] == 90, f"Expected 90 XP (60*1.5), got {session['xp_earned']}"

        user = data["user"]
        assert user["total_xp"] >= 90
        assert user["total_minutes"] >= 60
        assert user["sessions_count"] >= 1

        print(f"✓ Session created: 60min freestyle → {session['xp_earned']} XP")

    def test_get_sessions_list(self, auth_token):
        """GET /api/sessions returns session list ordered desc"""
        response = requests.get(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        sessions = response.json()
        assert isinstance(sessions, list)
        assert len(sessions) > 0, "No sessions found"

        # Verify descending order by created_at
        if len(sessions) > 1:
            for i in range(len(sessions) - 1):
                assert sessions[i]["created_at"] >= sessions[i + 1]["created_at"]

        print(f"✓ GET /sessions returned {len(sessions)} sessions in desc order")

    def test_delete_session_decrements_xp(self, auth_token):
        """DELETE /api/sessions/{id} removes session and decrements user XP/minutes"""
        # Get current user state
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        user_before = me_resp.json()

        # Create a session to delete
        create_resp = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"duration_minutes": 30, "session_type": "mix"},
        )
        session = create_resp.json()["session"]
        session_id = session["id"]
        xp_earned = session["xp_earned"]

        # Delete the session
        delete_resp = requests.delete(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert delete_resp.status_code == 200

        data = delete_resp.json()
        assert data["ok"] is True
        user_after = data["user"]

        # Verify XP and minutes decremented
        assert user_after["total_xp"] == user_before["total_xp"]
        assert user_after["total_minutes"] == user_before["total_minutes"]
        assert user_after["sessions_count"] == user_before["sessions_count"]

        print(f"✓ Session deleted, XP decremented by {xp_earned}")


class TestChallenges:
    """Challenge completion tests"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        return response.json()["token"]

    def test_get_challenges_returns_5_default(self, auth_token):
        """GET /api/challenges returns 5 default challenges with 'completed' boolean"""
        response = requests.get(
            f"{BASE_URL}/api/challenges",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200
        challenges = response.json()
        assert len(challenges) == 5, f"Expected 5 challenges, got {len(challenges)}"

        for ch in challenges:
            assert "id" in ch
            assert "title" in ch
            assert "xp_reward" in ch
            assert "completed" in ch
            assert isinstance(ch["completed"], bool)

        print(f"✓ GET /challenges returned {len(challenges)} challenges")

    def test_complete_challenge_adds_xp(self, auth_token):
        """POST /api/challenges/complete adds XP and marks completed"""
        # Get user XP before
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        xp_before = me_resp.json()["total_xp"]

        # Get a challenge that's not completed
        challenges_resp = requests.get(
            f"{BASE_URL}/api/challenges",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        challenges = challenges_resp.json()
        uncompleted = [c for c in challenges if not c["completed"]]

        if not uncompleted:
            pytest.skip("All challenges already completed")

        challenge = uncompleted[0]
        challenge_id = challenge["id"]
        xp_reward = challenge["xp_reward"]

        # Complete the challenge
        response = requests.post(
            f"{BASE_URL}/api/challenges/complete",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"challenge_id": challenge_id},
        )
        assert response.status_code == 200

        data = response.json()
        assert data["ok"] is True
        assert data["xp_earned"] == xp_reward

        user = data["user"]
        assert user["total_xp"] == xp_before + xp_reward
        assert challenge_id in user["completed_challenges"]

        print(f"✓ Challenge '{challenge['title']}' completed, +{xp_reward} XP")

    def test_complete_challenge_twice_returns_400(self, auth_token):
        """Second call to complete same challenge returns 400 error"""
        # Get a completed challenge
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        completed = me_resp.json()["completed_challenges"]

        if not completed:
            pytest.skip("No completed challenges to test")

        challenge_id = completed[0]

        # Try to complete again
        response = requests.post(
            f"{BASE_URL}/api/challenges/complete",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"challenge_id": challenge_id},
        )
        assert response.status_code == 400
        assert "déjà complété" in response.json()["detail"].lower()
        print("✓ Duplicate challenge completion rejected with 400")


class TestStats:
    """Stats endpoint tests"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        return response.json()["token"]

    def test_get_stats_structure(self, auth_token):
        """GET /api/stats returns by_day (7 days), by_type, streak_days, rank_info"""
        response = requests.get(
            f"{BASE_URL}/api/stats",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200

        stats = response.json()
        assert "by_day" in stats
        assert "by_type" in stats
        assert "streak_days" in stats
        assert "rank_info" in stats

        # Verify by_day has 7 entries
        assert len(stats["by_day"]) == 7, f"Expected 7 days, got {len(stats['by_day'])}"
        for day in stats["by_day"]:
            assert "date" in day
            assert "minutes" in day

        # Verify by_type has all session types
        by_type = stats["by_type"]
        assert "mix" in by_type
        assert "transitions" in by_type
        assert "freestyle" in by_type

        # Verify rank_info
        rank_info = stats["rank_info"]
        assert "rank" in rank_info
        assert "division" in rank_info
        assert "total_xp" in rank_info

        print(f"✓ GET /stats returned complete structure with {len(stats['by_day'])} days")


class TestLeaderboard:
    """Leaderboard tests"""

    def test_get_leaderboard_sorted_by_xp(self):
        """GET /api/leaderboard returns users sorted by total_xp desc"""
        response = requests.get(f"{BASE_URL}/api/leaderboard")
        assert response.status_code == 200

        leaderboard = response.json()
        assert isinstance(leaderboard, list)
        assert len(leaderboard) > 0, "Leaderboard is empty"

        # Verify descending order by total_xp
        for i in range(len(leaderboard) - 1):
            assert leaderboard[i]["total_xp"] >= leaderboard[i + 1]["total_xp"]

        # Verify structure
        for entry in leaderboard:
            assert "rank_position" in entry
            assert "dj_name" in entry
            assert "total_xp" in entry
            assert "rank_info" in entry

        print(f"✓ Leaderboard returned {len(leaderboard)} users sorted by XP")


class TestPremium:
    """Premium toggle tests (mocked)"""

    @pytest.fixture
    def auth_token(self):
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        return response.json()["token"]

    def test_premium_toggle(self, auth_token):
        """POST /api/premium/toggle toggles is_premium flag"""
        # Get current premium status
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        is_premium_before = me_resp.json()["is_premium"]

        # Toggle premium
        response = requests.post(
            f"{BASE_URL}/api/premium/toggle",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert response.status_code == 200

        data = response.json()
        assert data["is_premium"] == (not is_premium_before)
        assert data["user"]["is_premium"] == (not is_premium_before)

        print(f"✓ Premium toggled: {is_premium_before} → {not is_premium_before}")


class TestRankProgression:
    """Rank progression logic tests"""

    @pytest.fixture
    def fresh_user_token(self):
        """Create a fresh user for rank testing"""
        email = f"rank_test_{int(time.time())}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "test1234", "dj_name": "DJ Rank Test"},
        )
        return response.json()["token"]

    def test_rank_progression_500xp_to_cuivre_iv(self, fresh_user_token):
        """Give user 500 XP via sessions, verify rank becomes Cuivre IV"""
        # User starts at Cuivre V (level 0)
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {fresh_user_token}"},
        )
        user_before = me_resp.json()
        assert user_before["rank_info"]["rank_label"] == "Cuivre V"
        assert user_before["rank_info"]["level"] == 0

        # Add 500 XP via sessions (500 XP = 500 minutes of mix sessions)
        # Let's do 5 sessions of 100 minutes each (mix type, multiplier 1.0)
        for i in range(5):
            requests.post(
                f"{BASE_URL}/api/sessions",
                headers={"Authorization": f"Bearer {fresh_user_token}"},
                json={"duration_minutes": 100, "session_type": "mix"},
            )

        # Verify rank progression
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {fresh_user_token}"},
        )
        user_after = me_resp.json()
        rank_info = user_after["rank_info"]

        assert user_after["total_xp"] == 500, f"Expected 500 XP, got {user_after['total_xp']}"
        assert rank_info["rank"] == "Cuivre"
        assert rank_info["division"] == "IV"
        assert rank_info["rank_label"] == "Cuivre IV"
        assert rank_info["level"] == 1

        print(f"✓ Rank progression: Cuivre V → Cuivre IV after 500 XP")


class TestAdminAuth:
    """Admin authentication tests"""

    def test_admin_login(self):
        """Admin can login with seeded credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        )
        assert response.status_code == 200

        data = response.json()
        assert "token" in data
        user = data["user"]
        assert user["email"] == ADMIN_EMAIL
        assert user["role"] == "admin"
        assert user["is_premium"] is True

        print(f"✓ Admin login successful: {user['dj_name']}")
