import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../src/auth";
import { api, errMsg } from "../../src/api";

const TYPES = [
  { id: "mix", label: "Mix", icon: "albums", xpMult: "x1.0" },
  { id: "transitions", label: "Transitions", icon: "git-merge", xpMult: "x1.2" },
  { id: "freestyle", label: "Freestyle", icon: "flash", xpMult: "x1.5" },
];

export default function Sessions() {
  const { user, setUser } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<"manual" | "audio">("manual");

  // manual form
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState("mix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // edit modal
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/sessions");
      setSessions(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const showMsg = (t: string, m: string) => {
    if (Platform.OS === "web") window.alert(`${t}\n\n${m}`);
    else Alert.alert(t, m);
  };

  const submitManual = async () => {
    const d = parseInt(duration, 10);
    if (!d || d < 1) { showMsg("Erreur", "Durée invalide"); return; }
    setSaving(true);
    try {
      const { data } = await api.post("/sessions", {
        duration_minutes: d, session_type: type, notes,
      });
      setUser(data.user);
      setSessions((s) => [data.session, ...s]);
      setNotes(""); setDuration("30");
      showMsg("✓ Session loggée", `+${data.session.xp_earned} XP !`);
    } catch (e: any) {
      showMsg("Erreur", errMsg(e));
    } finally { setSaving(false); }
  };

  const submitAudio = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setSaving(true);
      setUploadProgress(10);
      const form = new FormData();
      form.append("session_type", type);
      form.append("notes", notes);
      if (Platform.OS === "web") {
        const r = await fetch(asset.uri);
        const blob = await r.blob();
        form.append("file", blob, asset.name || "audio.mp3");
      } else {
        form.append("file", {
          uri: asset.uri,
          name: asset.name || "audio.mp3",
          type: asset.mimeType || "audio/mpeg",
        } as any);
      }
      setUploadProgress(30);
      const { data } = await api.post("/sessions/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 240000,
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(30 + Math.round((e.loaded / e.total) * 50));
        },
      });
      setUploadProgress(100);
      setUser(data.user);
      setSessions((s) => [data.session, ...s]);
      setNotes("");
      const s = data.session;
      showMsg(
        `🎛️ Mix analysé : ${s.audio_quality_score}/100`,
        `Durée : ${s.duration_minutes} min\nBPM : ${s.audio_bpm}\nBonus qualité : +${data.xp_breakdown.quality_bonus} XP\nTotal : +${s.xp_earned} XP\n\n${s.audio_feedback.join("\n")}`,
      );
    } catch (e: any) {
      showMsg("Analyse échouée", errMsg(e));
    } finally { setSaving(false); setUploadProgress(0); }
  };

  const deleteSession = async (id: string) => {
    const go = async () => {
      try {
        const { data } = await api.delete(`/sessions/${id}`);
        setUser(data.user);
        setSessions((s) => s.filter((x) => x.id !== id));
        setEditing(null);
      } catch (e: any) { showMsg("Erreur", errMsg(e)); }
    };
    if (Platform.OS === "web") {
      if (window.confirm("Supprimer cette session ? Les XP seront retirés.")) await go();
    } else {
      Alert.alert("Supprimer", "Les XP seront retirés. Confirmer ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: go },
      ]);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const d = parseInt(String(editing.duration_minutes), 10);
    if (!d || d < 1) { showMsg("Erreur", "Durée invalide"); return; }
    try {
      const { data } = await api.patch(`/sessions/${editing.id}`, {
        duration_minutes: d,
        session_type: editing.session_type,
        notes: editing.notes,
      });
      setUser(data.user);
      setSessions((s) => s.map((x) => (x.id === editing.id ? data.session : x)));
      setEditing(null);
      showMsg("✓ Session modifiée", `XP ajusté → ${data.session.xp_earned}`);
    } catch (e: any) {
      showMsg("Erreur", errMsg(e));
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl tintColor="#00E5FF" refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.h1}>SESSIONS</Text>

          {/* Mode switcher */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              testID="mode-manual"
              onPress={() => setMode("manual")}
              style={[styles.modeBtn, mode === "manual" && styles.modeBtnActive]}
            >
              <Ionicons name="create" size={14} color={mode === "manual" ? "#000" : "#A0A0A0"} />
              <Text style={[styles.modeTxt, mode === "manual" && styles.modeTxtActive]}>LOG MANUEL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="mode-audio"
              onPress={() => setMode("audio")}
              style={[styles.modeBtn, mode === "audio" && styles.modeBtnActive]}
            >
              <Ionicons name="cloud-upload" size={14} color={mode === "audio" ? "#000" : "#A0A0A0"} />
              <Text style={[styles.modeTxt, mode === "audio" && styles.modeTxtActive]}>UPLOAD MIX</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {mode === "manual" ? "NOUVELLE SESSION" : "ANALYSE AUTO DU MIX"}
            </Text>
            {mode === "audio" && (
              <Text style={styles.desc}>
                Upload ton enregistrement → l'algo vérifie la durée, le BPM, la stabilité et les transitions brusques. Bonus XP si le mix est propre.
              </Text>
            )}

            <Text style={styles.label}>TYPE</Text>
            <View style={styles.typesRow}>
              {TYPES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  testID={`type-${t.id}`}
                  onPress={() => setType(t.id)}
                  style={[styles.typeBtn, type === t.id && styles.typeBtnActive]}
                  activeOpacity={0.85}
                >
                  <Ionicons name={t.icon as any} size={18} color={type === t.id ? "#000" : "#A0A0A0"} />
                  <Text style={[styles.typeTxt, type === t.id && styles.typeTxtActive]}>{t.label}</Text>
                  <Text style={[styles.typeMult, type === t.id && { color: "#000" }]}>{t.xpMult}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {mode === "manual" && (
              <>
                <Text style={styles.label}>DURÉE (minutes)</Text>
                <View style={styles.durationRow}>
                  {[15, 30, 45, 60, 90, 120].map((d) => (
                    <TouchableOpacity
                      key={d}
                      testID={`quick-dur-${d}`}
                      style={[styles.quickDur, duration === String(d) && styles.quickDurActive]}
                      onPress={() => setDuration(String(d))}
                    >
                      <Text style={[styles.quickDurTxt, duration === String(d) && { color: "#000" }]}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  testID="input-duration"
                  style={styles.input}
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                />
              </>
            )}

            <Text style={styles.label}>NOTES (optionnel)</Text>
            <TextInput
              testID="input-notes"
              style={[styles.input, { minHeight: 60 }]}
              value={notes}
              onChangeText={setNotes}
              multiline
              placeholder="Ce que tu as travaillé..."
              placeholderTextColor="#555"
            />

            {uploadProgress > 0 && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
            )}

            <TouchableOpacity
              testID={mode === "manual" ? "save-session-btn" : "upload-session-btn"}
              style={styles.submitBtn}
              onPress={mode === "manual" ? submitManual : submitAudio}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#00E5FF", "#FF007F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGrad}
              >
                {saving ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Ionicons name={mode === "manual" ? "checkmark-circle" : "cloud-upload"} size={18} color="#000" />
                    <Text style={styles.submitTxt}>
                      {mode === "manual" ? "LOGGER LA SESSION" : "UPLOADER & ANALYSER"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>HISTORIQUE</Text>
          {sessions.length === 0 ? (
            <Text style={styles.empty}>Aucune session. Log ta première 🎧</Text>
          ) : (
            sessions.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.sessionItem}
                testID={`session-${s.id}`}
                onPress={() => setEditing({ ...s })}
                activeOpacity={0.85}
              >
                <View style={[styles.sessionIcon, { backgroundColor: sessionColor(s.session_type) }]}>
                  <Ionicons name={sessionIcon(s.session_type)} size={18} color="#000" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.sessionHead}>
                    <Text style={styles.sessionType}>{s.session_type.toUpperCase()}</Text>
                    {s.audio_analyzed && (
                      <View style={styles.qualityPill}>
                        <Ionicons name="musical-note" size={10} color="#FFD700" />
                        <Text style={styles.qualityTxt}>{s.audio_quality_score}/100</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sessionMeta}>
                    {s.duration_minutes} min · +{s.xp_earned} XP · {s.date || s.created_at.slice(0,10)}
                  </Text>
                  {s.notes ? <Text style={styles.sessionNotes}>{s.notes}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Edit Modal */}
      <Modal
        visible={!!editing}
        transparent
        animationType="slide"
        onRequestClose={() => setEditing(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>MODIFIER LA SESSION</Text>
              <TouchableOpacity testID="close-edit" onPress={() => setEditing(null)}>
                <Ionicons name="close" size={22} color="#A0A0A0" />
              </TouchableOpacity>
            </View>
            {editing && (
              <ScrollView keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>TYPE</Text>
                <View style={styles.typesRow}>
                  {TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      testID={`edit-type-${t.id}`}
                      onPress={() => setEditing({ ...editing, session_type: t.id })}
                      style={[styles.typeBtn, editing.session_type === t.id && styles.typeBtnActive]}
                    >
                      <Ionicons name={t.icon as any} size={16} color={editing.session_type === t.id ? "#000" : "#A0A0A0"} />
                      <Text style={[styles.typeTxt, editing.session_type === t.id && styles.typeTxtActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>DURÉE (minutes)</Text>
                <TextInput
                  testID="edit-duration"
                  style={styles.input}
                  value={String(editing.duration_minutes)}
                  onChangeText={(t) => setEditing({ ...editing, duration_minutes: t.replace(/\D/g, "") })}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>NOTES</Text>
                <TextInput
                  testID="edit-notes"
                  style={[styles.input, { minHeight: 60 }]}
                  value={editing.notes || ""}
                  onChangeText={(t) => setEditing({ ...editing, notes: t })}
                  multiline
                />

                {editing.audio_analyzed && (
                  <View style={styles.audioBox}>
                    <Text style={styles.audioTitle}>ANALYSE AUDIO</Text>
                    <Text style={styles.audioLine}>Score : {editing.audio_quality_score}/100</Text>
                    <Text style={styles.audioLine}>BPM : {editing.audio_bpm}</Text>
                    <Text style={styles.audioLine}>Stabilité : {Math.round((editing.audio_stability||0)*100)}%</Text>
                    <Text style={styles.audioLine}>Transitions brusques : {editing.audio_rough_transitions}</Text>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    testID="delete-session-btn"
                    onPress={() => deleteSession(editing.id)}
                    style={styles.dangerBtn}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="trash" size={16} color="#FF3B5B" />
                    <Text style={styles.dangerTxt}>SUPPRIMER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="save-edit-btn"
                    onPress={saveEdit}
                    style={styles.saveBtn}
                    activeOpacity={0.85}
                  >
                    <LinearGradient
                      colors={["#00E5FF", "#FF007F"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.saveBtnGrad}
                    >
                      <Text style={styles.saveTxt}>ENREGISTRER</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function sessionColor(t: string) {
  return t === "freestyle" ? "#39FF14" : t === "transitions" ? "#FF007F" : "#00E5FF";
}
function sessionIcon(t: string): any {
  return t === "freestyle" ? "flash" : t === "transitions" ? "git-merge" : "albums";
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 16 },
  modeSwitch: { flexDirection: "row", gap: 6, marginBottom: 14 },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    paddingVertical: 10, borderRadius: 10, backgroundColor: "#121212",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  modeBtnActive: { backgroundColor: "#00E5FF", borderColor: "#00E5FF" },
  modeTxt: { color: "#A0A0A0", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  modeTxtActive: { color: "#000" },
  card: { backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 10 },
  desc: { color: "#A0A0A0", fontSize: 12, marginBottom: 12, lineHeight: 17 },
  label: { color: "#555", letterSpacing: 2, fontSize: 10, fontWeight: "800", marginBottom: 8, marginTop: 12 },
  typesRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1, padding: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  typeBtnActive: { backgroundColor: "#00E5FF", borderColor: "#00E5FF" },
  typeTxt: { color: "#A0A0A0", fontWeight: "800", fontSize: 12, marginTop: 4 },
  typeTxtActive: { color: "#000" },
  typeMult: { color: "#555", fontSize: 9, marginTop: 2, fontWeight: "700" },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  quickDur: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  quickDurActive: { backgroundColor: "#00E5FF", borderColor: "#00E5FF" },
  quickDurTxt: { color: "#A0A0A0", fontWeight: "800", fontSize: 12 },
  input: {
    backgroundColor: "#0A0A0A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", fontSize: 15, marginTop: 4,
  },
  progressBar: { height: 6, backgroundColor: "rgba(0,229,255,0.1)", borderRadius: 999, marginTop: 12, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#00E5FF", borderRadius: 999 },
  submitBtn: { marginTop: 18, borderRadius: 12, overflow: "hidden" },
  submitGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, gap: 8 },
  submitTxt: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 13 },
  sectionTitle: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 2, marginBottom: 10 },
  empty: { color: "#555", textAlign: "center", padding: 20 },
  sessionItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#121212", padding: 12,
    borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", gap: 12,
  },
  sessionIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sessionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionType: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  qualityPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(255,215,0,0.1)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  qualityTxt: { color: "#FFD700", fontSize: 9, fontWeight: "900" },
  sessionMeta: { color: "#A0A0A0", fontSize: 11, marginTop: 2 },
  sessionNotes: { color: "#555", fontSize: 11, marginTop: 4, fontStyle: "italic" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#121212", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", maxHeight: "85%",
  },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalTitle: { color: "#fff", letterSpacing: 2, fontWeight: "900", fontSize: 13 },
  audioBox: { marginTop: 14, padding: 12, backgroundColor: "#0A0A0A", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,215,0,0.3)" },
  audioTitle: { color: "#FFD700", fontWeight: "900", fontSize: 10, letterSpacing: 1.5, marginBottom: 6 },
  audioLine: { color: "#fff", fontSize: 12, marginVertical: 2 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  dangerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: "#FF3B5B", backgroundColor: "rgba(255,59,91,0.08)" },
  dangerTxt: { color: "#FF3B5B", fontWeight: "900", letterSpacing: 1.5, fontSize: 11 },
  saveBtn: { flex: 1, borderRadius: 12, overflow: "hidden" },
  saveBtnGrad: { alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  saveTxt: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 13 },
});
