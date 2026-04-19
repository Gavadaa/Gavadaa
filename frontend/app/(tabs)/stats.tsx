import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useAuth } from "../../src/auth";
import { api, errMsg } from "../../src/api";

export default function Stats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [audioResult, setAudioResult] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/stats");
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const pickAndAnalyze = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.length) return;
      const asset = res.assets[0];
      setAnalyzing(true);
      setAudioResult(null);
      const form = new FormData();
      if (Platform.OS === "web") {
        const resp = await fetch(asset.uri);
        const blob = await resp.blob();
        form.append("file", blob, asset.name || "audio.mp3");
      } else {
        form.append("file", {
          uri: asset.uri,
          name: asset.name || "audio.mp3",
          type: asset.mimeType || "audio/mpeg",
        } as any);
      }
      const { data } = await api.post("/audio/analyze", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180000,
      });
      setAudioResult(data);
    } catch (e: any) {
      Alert.alert("Analyse échouée", errMsg(e));
    } finally {
      setAnalyzing(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor="#00E5FF" refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.h1}>STATS</Text>

        <View style={styles.grid}>
          <Mini label="SESSIONS 30J" value={stats?.total_sessions_30d ?? "—"} color="#00E5FF" />
          <Mini label="MIN 30J" value={stats?.total_minutes_30d ?? "—"} color="#FF007F" />
          <Mini label="STREAK" value={`${stats?.streak_days ?? 0}j`} color="#39FF14" />
          <Mini label="NIVEAU" value={(user.rank_info.level + 1)} color="#FFD700" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>RÉPARTITION PAR TYPE</Text>
          {stats && (
            <View style={{ gap: 10 }}>
              {Object.entries(stats.by_type).map(([k, v]: any) => {
                const total = Object.values(stats.by_type).reduce((a: any, b: any) => a + b, 0) as number;
                const pct = total ? ((v / total) * 100).toFixed(0) : "0";
                return (
                  <View key={k}>
                    <View style={styles.typeRow}>
                      <Text style={styles.typeLbl}>{k.toUpperCase()}</Text>
                      <Text style={styles.typeVal}>{v} min · {pct}%</Text>
                    </View>
                    <View style={styles.progTrack}>
                      <View style={[styles.progFill, {
                        width: `${pct}%`,
                        backgroundColor: k === "freestyle" ? "#39FF14" : k === "transitions" ? "#FF007F" : "#00E5FF",
                      }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>ANALYSE AUDIO</Text>
          <Text style={styles.desc}>
            Importe un enregistrement de ton mix. On détecte le BPM, la stabilité et les transitions brusques.
          </Text>
          <TouchableOpacity
            testID="pick-audio-btn"
            style={styles.uploadBtn}
            onPress={pickAndAnalyze}
            disabled={analyzing}
            activeOpacity={0.85}
          >
            {analyzing ? (
              <ActivityIndicator color="#00E5FF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#00E5FF" />
                <Text style={styles.uploadTxt}>IMPORTER UN FICHIER AUDIO</Text>
              </>
            )}
          </TouchableOpacity>

          {audioResult && (
            <View style={styles.audioResult} testID="audio-result">
              <View style={styles.audioRow}>
                <Metric label="BPM" value={audioResult.bpm} />
                <Metric label="STABILITÉ" value={`${Math.round(audioResult.bpm_stability * 100)}%`} />
                <Metric label="SCORE" value={`${audioResult.score}/100`} highlight />
              </View>
              <View style={styles.audioRow}>
                <Metric label="DURÉE" value={`${Math.round(audioResult.duration_sec)}s`} />
                <Metric label="TRANSITIONS" value={audioResult.transitions_detected} />
                <Metric label="BRUSQUES" value={audioResult.rough_transitions} warn />
              </View>
              <View style={{ marginTop: 10 }}>
                {audioResult.feedback.map((f: string, i: number) => (
                  <Text key={i} style={styles.feedback}>• {f}</Text>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Advanced stats (now free for everyone) */}
        <View style={[styles.card, { overflow: "hidden" }]}>
          <Text style={styles.cardTitle}>STATS AVANCÉES</Text>
          <View style={{ gap: 8 }}>
            <Text style={styles.advRow}>Moyenne quotidienne : {Math.round((stats?.total_minutes_30d ?? 0) / 30)} min</Text>
            <Text style={styles.advRow}>Type préféré : {bestType(stats?.by_type)}</Text>
            <Text style={styles.advRow}>Régularité : {regularityLabel(stats?.streak_days ?? 0)}</Text>
            <Text style={styles.advRow}>Prévision rang suivant : ~{daysToNext(user.rank_info, stats)} jours</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Mini({ label, value, color }: any) {
  return (
    <View style={styles.mini}>
      <View style={[styles.miniDot, { backgroundColor: color }]} />
      <Text style={styles.miniVal}>{value}</Text>
      <Text style={styles.miniLbl}>{label}</Text>
    </View>
  );
}

function Metric({ label, value, highlight, warn }: any) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricVal, highlight && { color: "#00E5FF" }, warn && { color: "#FF3B5B" }]}>{value}</Text>
      <Text style={styles.metricLbl}>{label}</Text>
    </View>
  );
}

function bestType(t: any) {
  if (!t) return "—";
  const entries = Object.entries(t) as [string, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0] && entries[0][1] > 0 ? entries[0][0] : "—";
}
function regularityLabel(streak: number) {
  if (streak >= 14) return "🔥 Excellente";
  if (streak >= 7) return "💪 Bonne";
  if (streak >= 3) return "⚡ Correcte";
  return "📉 À améliorer";
}
function daysToNext(r: any, stats: any) {
  if (!r || r.at_max_rank) return "∞";
  const avg = Math.max(1, Math.round((stats?.total_minutes_30d ?? 0) / 30));
  const xpPerDay = avg * 1.2;
  const needed = r.xp_for_next_division - r.xp_in_division;
  return Math.max(1, Math.round(needed / xpPerDay));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 16, paddingBottom: 40 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  mini: {
    flexGrow: 1, flexBasis: "47%", backgroundColor: "#121212", padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  miniDot: { width: 8, height: 8, borderRadius: 4 },
  miniVal: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 8 },
  miniLbl: { color: "#555", fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 2 },
  card: { backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 12 },
  typeRow: { flexDirection: "row", justifyContent: "space-between" },
  typeLbl: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  typeVal: { color: "#A0A0A0", fontSize: 12 },
  progTrack: { height: 6, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 999, marginTop: 5, overflow: "hidden" },
  progFill: { height: "100%", borderRadius: 999 },
  desc: { color: "#A0A0A0", fontSize: 12, marginBottom: 12, lineHeight: 17 },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#00E5FF",
    backgroundColor: "rgba(0,229,255,0.08)",
  },
  uploadTxt: { color: "#00E5FF", fontWeight: "900", letterSpacing: 1.5, fontSize: 12 },
  audioResult: { marginTop: 14, padding: 12, backgroundColor: "#0A0A0A", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  audioRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  metric: { flex: 1, alignItems: "center" },
  metricVal: { color: "#fff", fontSize: 18, fontWeight: "900" },
  metricLbl: { color: "#555", fontSize: 9, letterSpacing: 1.5, fontWeight: "800", marginTop: 2 },
  feedback: { color: "#A0A0A0", fontSize: 12, marginTop: 4, lineHeight: 17 },
  premiumHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lockPill: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,215,0,0.1)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,215,0,0.4)", marginBottom: 12,
  },
  lockTxt: { color: "#FFD700", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  advRow: { color: "#fff", fontSize: 13 },
  lockOverlay: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  lockBig: { color: "#FFD700", fontWeight: "900", letterSpacing: 2, fontSize: 13 },
  lockSub: { color: "#A0A0A0", fontSize: 11 },
});
