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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
  const [duration, setDuration] = useState("30");
  const [type, setType] = useState("mix");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/sessions");
      setSessions(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    const d = parseInt(duration, 10);
    if (!d || d < 1) {
      Alert.alert("Durée invalide");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post("/sessions", {
        duration_minutes: d,
        session_type: type,
        notes,
      });
      setUser(data.user);
      setSessions((s) => [data.session, ...s]);
      setNotes("");
      setDuration("30");
      Alert.alert("✓ Session loggée", `+${data.session.xp_earned} XP gagnés !`);
    } catch (e: any) {
      Alert.alert("Erreur", errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    try {
      const { data } = await api.delete(`/sessions/${id}`);
      setUser(data.user);
      setSessions((s) => s.filter((x) => x.id !== id));
    } catch (e: any) {
      Alert.alert("Erreur", errMsg(e));
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

          <View style={styles.card}>
            <Text style={styles.cardTitle}>NOUVELLE SESSION</Text>

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
              placeholder="Durée en minutes"
              placeholderTextColor="#555"
            />

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

            <TouchableOpacity
              testID="save-session-btn"
              style={styles.submitBtn}
              onPress={submit}
              disabled={saving}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#00E5FF", "#FF007F"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGrad}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#000" />
                    <Text style={styles.submitTxt}>LOGGER LA SESSION</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>HISTORIQUE</Text>
          {sessions.length === 0 ? (
            <Text style={styles.empty}>Aucune session pour le moment. Log ta première 🎧</Text>
          ) : (
            sessions.map((s) => (
              <View key={s.id} style={styles.sessionItem} testID={`session-${s.id}`}>
                <View style={[styles.sessionIcon, { backgroundColor: sessionColor(s.session_type) }]}>
                  <Ionicons name={sessionIcon(s.session_type)} size={18} color="#000" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sessionType}>{s.session_type.toUpperCase()}</Text>
                  <Text style={styles.sessionMeta}>
                    {s.duration_minutes} min · +{s.xp_earned} XP · {s.created_at.slice(0, 10)}
                  </Text>
                  {s.notes ? <Text style={styles.sessionNotes}>{s.notes}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => del(s.id)} testID={`delete-${s.id}`}>
                  <Ionicons name="trash-outline" size={18} color="#555" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  card: { backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 14 },
  label: { color: "#555", letterSpacing: 2, fontSize: 10, fontWeight: "800", marginBottom: 8, marginTop: 8 },
  typesRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1, padding: 10, borderRadius: 10, alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  typeBtnActive: { backgroundColor: "#00E5FF", borderColor: "#00E5FF" },
  typeTxt: { color: "#A0A0A0", fontWeight: "800", fontSize: 12, marginTop: 4 },
  typeTxtActive: { color: "#000" },
  typeMult: { color: "#555", fontSize: 9, marginTop: 2, fontWeight: "700" },
  durationRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  quickDur: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  quickDurActive: { backgroundColor: "#00E5FF", borderColor: "#00E5FF" },
  quickDurTxt: { color: "#A0A0A0", fontWeight: "800", fontSize: 12 },
  input: {
    backgroundColor: "#0A0A0A", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", fontSize: 15, marginTop: 4,
  },
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
  sessionType: { color: "#fff", fontWeight: "900", fontSize: 13, letterSpacing: 1 },
  sessionMeta: { color: "#A0A0A0", fontSize: 11, marginTop: 2 },
  sessionNotes: { color: "#555", fontSize: 11, marginTop: 4, fontStyle: "italic" },
});
