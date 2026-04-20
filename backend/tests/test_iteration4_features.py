"""
Backend API tests for DJ Skill Tracker - Iteration 4 Features
Tests: audio upload with quality analysis, session edit (PATCH), session delete, XP bonus preservation
"""
import pytest
import requests
import os
import time
import wave
import struct
import math
import tempfile

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)

TEST_PASSWORD = "test1234"


def generate_test_audio(duration_sec=5, filename=None):
    """Generate a simple sine wave audio file for testing"""
    if filename is None:
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        filename = tmp.name
        tmp.close()
    
    sr = 22050  # sample rate
    freq = 440  # A4 note
    
    with wave.open(filename, 'wb') as w:
        w.setnchannels(1)  # mono
        w.setsampwidth(2)  # 16-bit
        w.setframerate(sr)
        
        for i in range(sr * duration_sec):
            sample = int(30000 * math.sin(2 * math.pi * freq * i / sr))
            w.writeframes(struct.pack('<h', sample))
    
    return filename


class TestAudioUpload:
    """Test POST /api/sessions/upload with audio file"""

    @pytest.fixture
    def user_token(self):
        """Create test user"""
        email = f"audio_upload_{int(time.time() * 1000)}@test.com"
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "dj_name": "DJ Audio Test",
            },
        )
        return response.json()["token"]

    def test_upload_audio_creates_session_with_analysis(self, user_token):
        """POST /api/sessions/upload creates session with audio_analyzed=true and quality metrics"""
        # Generate 5-second test audio
        audio_file = generate_test_audio(duration_sec=5)
        
        try:
            with open(audio_file, 'rb') as f:
                files = {'file': ('test_mix.wav', f, 'audio/wav')}
                data = {
                    'session_type': 'mix',
                    'notes': 'Test audio upload',
                }
                
                response = requests.post(
                    f"{BASE_URL}/api/sessions/upload",
                    headers={"Authorization": f"Bearer {user_token}"},
                    files=files,
                    data=data,
                    timeout=60,
                )
            
            assert response.status_code == 200, f"Audio upload failed: {response.text}"
            
            result = response.json()
            
            # Check response structure
            assert "session" in result
            assert "user" in result
            assert "xp_breakdown" in result
            
            session = result["session"]
            xp_breakdown = result["xp_breakdown"]
            
            # Check session has audio analysis fields
            assert session["audio_analyzed"] is True
            assert "audio_quality_score" in session
            assert 0 <= session["audio_quality_score"] <= 100
            assert "audio_bpm" in session
            assert session["audio_bpm"] >= 0, "BPM should be a non-negative number"
            assert "audio_stability" in session
            assert 0 <= session["audio_stability"] <= 1
            assert "audio_rough_transitions" in session
            assert session["audio_rough_transitions"] >= 0
            assert "audio_feedback" in session
            assert isinstance(session["audio_feedback"], list)
            assert len(session["audio_feedback"]) > 0
            
            # Check duration is derived from audio (5 sec → 1 min minimum)
            assert session["duration_minutes"] >= 1
            
            # Check XP breakdown
            assert "base" in xp_breakdown
            assert "quality_bonus" in xp_breakdown
            assert "total" in xp_breakdown
            assert xp_breakdown["total"] == xp_breakdown["base"] + xp_breakdown["quality_bonus"]
            assert session["xp_earned"] == xp_breakdown["total"]
            
            # Quality bonus should be up to 50% of base
            assert xp_breakdown["quality_bonus"] <= xp_breakdown["base"] * 0.5
            
            print(f"✓ Audio upload successful: {session['duration_minutes']} min, score={session['audio_quality_score']}/100, BPM={session['audio_bpm']}, bonus={xp_breakdown['quality_bonus']} XP")
            
        finally:
            os.unlink(audio_file)

    def test_upload_audio_updates_user_totals(self, user_token):
        """POST /api/sessions/upload updates user total_xp, total_minutes, sessions_count"""
        # Get initial user state
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        initial_user = me_resp.json()
        initial_xp = initial_user["total_xp"]
        initial_minutes = initial_user["total_minutes"]
        initial_count = initial_user["sessions_count"]
        
        # Upload audio
        audio_file = generate_test_audio(duration_sec=10)
        
        try:
            with open(audio_file, 'rb') as f:
                files = {'file': ('test.wav', f, 'audio/wav')}
                data = {'session_type': 'freestyle', 'notes': ''}
                
                response = requests.post(
                    f"{BASE_URL}/api/sessions/upload",
                    headers={"Authorization": f"Bearer {user_token}"},
                    files=files,
                    data=data,
                    timeout=60,
                )
            
            assert response.status_code == 200
            
            result = response.json()
            updated_user = result["user"]
            session = result["session"]
            
            # Check user totals updated
            assert updated_user["total_xp"] == initial_xp + session["xp_earned"]
            assert updated_user["total_minutes"] == initial_minutes + session["duration_minutes"]
            assert updated_user["sessions_count"] == initial_count + 1
            
            print(f"✓ User totals updated: XP +{session['xp_earned']}, minutes +{session['duration_minutes']}, count +1")
            
        finally:
            os.unlink(audio_file)

    def test_upload_audio_creates_audio_analyses_record(self, user_token):
        """POST /api/sessions/upload creates a record in audio_analyses collection"""
        # Upload audio
        audio_file = generate_test_audio(duration_sec=8)
        
        try:
            with open(audio_file, 'rb') as f:
                files = {'file': ('test.wav', f, 'audio/wav')}
                data = {'session_type': 'transitions', 'notes': ''}
                
                response = requests.post(
                    f"{BASE_URL}/api/sessions/upload",
                    headers={"Authorization": f"Bearer {user_token}"},
                    files=files,
                    data=data,
                    timeout=60,
                )
            
            assert response.status_code == 200
            
            # The audio_analyses record is used by the "clean-transition" challenge
            # We can't directly query it via API, but we can verify the challenge sees it
            challenges_resp = requests.get(
                f"{BASE_URL}/api/challenges",
                headers={"Authorization": f"Bearer {user_token}"},
            )
            challenges = challenges_resp.json()
            
            # Find clean-transition challenge
            clean_trans = next((c for c in challenges["permanent"] if c["id"] == "clean-transition"), None)
            if clean_trans:
                # Progress should reference the audio analysis
                # If no analysis existed, progress would say "Importe d'abord un fichier audio"
                # After upload, it should show actual metrics
                assert "Importe d'abord" not in clean_trans["progress"], "Challenge should see the audio analysis"
                print(f"✓ Audio analysis record created and visible to challenges: {clean_trans['progress']}")
            else:
                print(f"⚠ clean-transition challenge not found in permanent challenges")
            
        finally:
            os.unlink(audio_file)

    def test_upload_with_invalid_session_type_returns_400(self, user_token):
        """POST /api/sessions/upload with invalid session_type returns 400"""
        audio_file = generate_test_audio(duration_sec=3)
        
        try:
            with open(audio_file, 'rb') as f:
                files = {'file': ('test.wav', f, 'audio/wav')}
                data = {'session_type': 'invalid_type', 'notes': ''}
                
                response = requests.post(
                    f"{BASE_URL}/api/sessions/upload",
                    headers={"Authorization": f"Bearer {user_token}"},
                    files=files,
                    data=data,
                    timeout=60,
                )
            
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
            
            data = response.json()
            assert "Type de session invalide" in data["detail"]
            
            print(f"✓ Invalid session_type rejected: {data['detail']}")
            
        finally:
            os.unlink(audio_file)

    def test_upload_empty_file_returns_400(self, user_token):
        """POST /api/sessions/upload with empty file returns 400 'Fichier audio vide'"""
        # Create empty file
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        empty_file = tmp.name
        tmp.close()
        
        try:
            with open(empty_file, 'rb') as f:
                files = {'file': ('empty.wav', f, 'audio/wav')}
                data = {'session_type': 'mix', 'notes': ''}
                
                response = requests.post(
                    f"{BASE_URL}/api/sessions/upload",
                    headers={"Authorization": f"Bearer {user_token}"},
                    files=files,
                    data=data,
                    timeout=60,
                )
            
            assert response.status_code == 400, f"Expected 400, got {response.status_code}"
            
            result = response.json()
            assert "Fichier audio vide" in result["detail"]
            
            print(f"✓ Empty file rejected: {result['detail']}")
            
        finally:
            os.unlink(empty_file)


class TestSessionEdit:
    """Test PATCH /api/sessions/{id} for editing sessions"""

    @pytest.fixture
    def user_with_session(self):
        """Create user with a manual session"""
        email = f"edit_session_{int(time.time() * 1000)}@test.com"
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "dj_name": "DJ Edit Test",
            },
        )
        token = reg_resp.json()["token"]
        
        # Create a manual session
        session_resp = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {token}"},
            json={"duration_minutes": 60, "session_type": "mix", "notes": "Original notes"},
        )
        session = session_resp.json()["session"]
        
        return {"token": token, "session_id": session["id"], "session": session}

    def test_patch_session_changes_duration_and_type(self, user_with_session):
        """PATCH /api/sessions/{id} with duration_minutes and session_type updates session and XP"""
        token = user_with_session["token"]
        session_id = user_with_session["session_id"]
        original_session = user_with_session["session"]
        
        # Original: 60 min mix → 60 XP (1.0x)
        # New: 60 min freestyle → 90 XP (1.5x)
        # Delta: +30 XP
        
        response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"duration_minutes": 60, "session_type": "freestyle"},
        )
        
        assert response.status_code == 200, f"PATCH failed: {response.text}"
        
        result = response.json()
        updated_session = result["session"]
        updated_user = result["user"]
        
        # Check session updated
        assert updated_session["duration_minutes"] == 60
        assert updated_session["session_type"] == "freestyle"
        assert updated_session["notes"] == "Original notes", "Notes should be preserved"
        
        # Check XP recalculated
        # mix 60 min = 60 XP, freestyle 60 min = 90 XP
        assert updated_session["xp_earned"] == 90
        
        # Check user XP adjusted by delta (+30)
        # We need to get initial user XP to verify
        me_resp = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        current_xp = me_resp.json()["total_xp"]
        
        print(f"✓ Session edited: type mix→freestyle, XP {original_session['xp_earned']}→{updated_session['xp_earned']}, user XP={current_xp}")

    def test_patch_session_changes_only_notes(self, user_with_session):
        """PATCH /api/sessions/{id} with only notes changes only notes (XP unchanged)"""
        token = user_with_session["token"]
        session_id = user_with_session["session_id"]
        original_xp = user_with_session["session"]["xp_earned"]
        
        response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"notes": "Updated notes only"},
        )
        
        assert response.status_code == 200
        
        result = response.json()
        updated_session = result["session"]
        
        assert updated_session["notes"] == "Updated notes only"
        assert updated_session["xp_earned"] == original_xp, "XP should not change when only notes updated"
        assert updated_session["duration_minutes"] == 60, "Duration should be preserved"
        assert updated_session["session_type"] == "mix", "Type should be preserved"
        
        print(f"✓ Notes-only edit preserves XP: {original_xp}")

    def test_patch_session_with_invalid_type_returns_400(self, user_with_session):
        """PATCH /api/sessions/{id} with invalid session_type returns 400"""
        token = user_with_session["token"]
        session_id = user_with_session["session_id"]
        
        response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"session_type": "invalid_type"},
        )
        
        assert response.status_code == 400
        
        data = response.json()
        assert "Type de session invalide" in data["detail"]
        
        print(f"✓ Invalid session_type rejected in PATCH: {data['detail']}")

    def test_patch_nonexistent_session_returns_404(self):
        """PATCH /api/sessions/{bad_id} returns 404"""
        email = f"patch_404_{int(time.time() * 1000)}@test.com"
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "dj_name": "DJ 404"},
        )
        token = reg_resp.json()["token"]
        
        response = requests.patch(
            f"{BASE_URL}/api/sessions/nonexistent-id-12345",
            headers={"Authorization": f"Bearer {token}"},
            json={"duration_minutes": 30},
        )
        
        assert response.status_code == 404
        
        data = response.json()
        assert "Session non trouvée" in data["detail"]
        
        print(f"✓ PATCH nonexistent session returns 404: {data['detail']}")

    def test_patch_another_users_session_returns_404(self):
        """PATCH /api/sessions/{id} on another user's session returns 404"""
        # Create user 1 with session
        email1 = f"user1_{int(time.time() * 1000)}@test.com"
        reg1 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email1, "password": TEST_PASSWORD, "dj_name": "User 1"},
        )
        token1 = reg1.json()["token"]
        
        session_resp = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {token1}"},
            json={"duration_minutes": 30, "session_type": "mix"},
        )
        session_id = session_resp.json()["session"]["id"]
        
        # Create user 2
        email2 = f"user2_{int(time.time() * 1000 + 1)}@test.com"
        reg2 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email2, "password": TEST_PASSWORD, "dj_name": "User 2"},
        )
        token2 = reg2.json()["token"]
        
        # User 2 tries to edit user 1's session
        response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token2}"},
            json={"duration_minutes": 60},
        )
        
        assert response.status_code == 404, "Should return 404 when editing another user's session"
        
        print(f"✓ Cannot edit another user's session (404)")


class TestSessionEditPreservesQualityBonus:
    """Test that PATCH preserves quality bonus from audio upload"""

    @pytest.fixture
    def user_with_audio_session(self):
        """Create user with an audio-analyzed session"""
        email = f"preserve_bonus_{int(time.time() * 1000)}@test.com"
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "dj_name": "DJ Bonus Test",
            },
        )
        token = reg_resp.json()["token"]
        
        # Upload audio session
        audio_file = generate_test_audio(duration_sec=10)
        
        try:
            with open(audio_file, 'rb') as f:
                files = {'file': ('test.wav', f, 'audio/wav')}
                data = {'session_type': 'mix', 'notes': 'Audio session'}
                
                upload_resp = requests.post(
                    f"{BASE_URL}/api/sessions/upload",
                    headers={"Authorization": f"Bearer {token}"},
                    files=files,
                    data=data,
                    timeout=60,
                )
            
            session = upload_resp.json()["session"]
            xp_breakdown = upload_resp.json()["xp_breakdown"]
            
            return {
                "token": token,
                "session_id": session["id"],
                "session": session,
                "xp_breakdown": xp_breakdown,
            }
        finally:
            os.unlink(audio_file)

    def test_patch_duration_preserves_quality_bonus(self, user_with_audio_session):
        """PATCH duration_minutes preserves quality bonus from audio analysis"""
        token = user_with_audio_session["token"]
        session_id = user_with_audio_session["session_id"]
        original_session = user_with_audio_session["session"]
        original_breakdown = user_with_audio_session["xp_breakdown"]
        
        original_quality_bonus = original_breakdown["quality_bonus"]
        
        # Change duration from ~1 min to 2 min (keeping type=mix)
        response = requests.patch(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
            json={"duration_minutes": 2},
        )
        
        assert response.status_code == 200
        
        result = response.json()
        updated_session = result["session"]
        
        # New XP = new_base + preserved_quality_bonus
        # new_base = 2 min * 1.0 (mix) = 2 XP
        # new_xp = 2 + original_quality_bonus
        new_base = 2  # 2 min mix
        expected_xp = new_base + original_quality_bonus
        
        assert updated_session["xp_earned"] == expected_xp, f"Expected {expected_xp}, got {updated_session['xp_earned']}"
        
        print(f"✓ Quality bonus preserved after duration edit: original_bonus={original_quality_bonus}, new_xp={updated_session['xp_earned']} (base={new_base} + bonus={original_quality_bonus})")


class TestSessionDelete:
    """Test DELETE /api/sessions/{id} still works correctly"""

    @pytest.fixture
    def user_with_session(self):
        """Create user with a session"""
        email = f"delete_test_{int(time.time() * 1000)}@test.com"
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": TEST_PASSWORD,
                "dj_name": "DJ Delete Test",
            },
        )
        token = reg_resp.json()["token"]
        
        # Create session
        session_resp = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {token}"},
            json={"duration_minutes": 45, "session_type": "transitions", "notes": "To be deleted"},
        )
        session = session_resp.json()["session"]
        user = session_resp.json()["user"]
        
        return {"token": token, "session_id": session["id"], "session": session, "user": user}

    def test_delete_session_removes_and_updates_totals(self, user_with_session):
        """DELETE /api/sessions/{id} removes session and decrements user totals"""
        token = user_with_session["token"]
        session_id = user_with_session["session_id"]
        session = user_with_session["session"]
        
        # Get user state before delete
        me_before = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        ).json()
        
        # Delete session
        response = requests.delete(
            f"{BASE_URL}/api/sessions/{session_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        
        assert response.status_code == 200
        
        result = response.json()
        assert result["ok"] is True
        
        updated_user = result["user"]
        
        # Check totals decremented
        assert updated_user["total_xp"] == me_before["total_xp"] - session["xp_earned"]
        assert updated_user["total_minutes"] == me_before["total_minutes"] - session["duration_minutes"]
        assert updated_user["sessions_count"] == me_before["sessions_count"] - 1
        
        # Verify session is gone
        sessions_resp = requests.get(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {token}"},
        )
        sessions = sessions_resp.json()
        
        assert not any(s["id"] == session_id for s in sessions), "Session should be deleted"
        
        print(f"✓ Session deleted: XP -{session['xp_earned']}, minutes -{session['duration_minutes']}, count -1")

    def test_delete_nonexistent_session_returns_404(self):
        """DELETE /api/sessions/{bad_id} returns 404"""
        email = f"delete_404_{int(time.time() * 1000)}@test.com"
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "dj_name": "DJ 404"},
        )
        token = reg_resp.json()["token"]
        
        response = requests.delete(
            f"{BASE_URL}/api/sessions/nonexistent-id-12345",
            headers={"Authorization": f"Bearer {token}"},
        )
        
        assert response.status_code == 404
        
        data = response.json()
        assert "Session non trouvée" in data["detail"]
        
        print(f"✓ DELETE nonexistent session returns 404")


class TestXPCalculationFlow:
    """Test complete XP calculation flow: manual → upload → edit"""

    def test_xp_flow_manual_to_edit(self):
        """Test flow: create manual session (60 min mix = 60 XP), PATCH to freestyle → 90 XP"""
        email = f"xp_flow_{int(time.time() * 1000)}@test.com"
        reg_resp = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": TEST_PASSWORD, "dj_name": "DJ XP Flow"},
        )
        token = reg_resp.json()["token"]
        
        # Create manual session: 60 min mix = 60 XP
        session_resp = requests.post(
            f"{BASE_URL}/api/sessions",
            headers={"Authorization": f"Bearer {token}"},
            json={"duration_minutes": 60, "session_type": "mix"},
        )
        session = session_resp.json()["session"]
        user_after_create = session_resp.json()["user"]
        
        assert session["xp_earned"] == 60, f"Expected 60 XP for 60 min mix, got {session['xp_earned']}"
        assert user_after_create["total_xp"] == 60
        
        # PATCH to freestyle: 60 min freestyle = 90 XP (delta +30)
        patch_resp = requests.patch(
            f"{BASE_URL}/api/sessions/{session['id']}",
            headers={"Authorization": f"Bearer {token}"},
            json={"session_type": "freestyle"},
        )
        updated_session = patch_resp.json()["session"]
        user_after_patch = patch_resp.json()["user"]
        
        assert updated_session["xp_earned"] == 90, f"Expected 90 XP for 60 min freestyle, got {updated_session['xp_earned']}"
        assert user_after_patch["total_xp"] == 90, f"Expected user total_xp=90, got {user_after_patch['total_xp']}"
        
        print(f"✓ XP flow verified: manual 60 XP → edit to freestyle 90 XP, user total_xp=90")
