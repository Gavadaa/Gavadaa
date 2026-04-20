import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../../src/auth";
import { api, errMsg } from "../../src/api";

type Challenge = {
  id: string;
  category: "daily" | "weekly" | "permanent";
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  difficulty: string;
  completed: boolean;
  meets_requirements: boolean;
  progress: string;
  resets_in?: string;
};

export default function Challenges() {
  const { setUser } = useAuth();
  const [data, setData] = useState<{ daily: Challenge[]; weekly: Challenge[]; permanent: Challenge[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"daily" | "weekly" | "permanent">("daily");

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/challenges");
      setData(data);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const showMsg = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const complete = async (c: Challenge) => {
    try {
      const { data: r } = await api.post("/challenges/complete", { challenge_id: c.id, category: c.category });
      setUser(r.user);
      await load();
      showMsg("🏆 Défi complété", `+${r.xp_earned} XP !`);
    } catch (e: any) {
      showMsg("Critères non remplis", errMsg(e));
    }
  };

  const diffColor = (d: string) => d === "hard" ? "#FF3B5B" : d === "medium" ? "#FFEA00" : "#39FF14";
  const catIcon: Record<string, any> = { daily: "sunny", weekly: "calendar", permanent: "trophy" };
  const catColor: Record<string, string> = { daily: "#39FF14", weekly: "#FFD700", permanent: "#00E5FF" };

  const list = data ? data[tab] : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor="#00E5FF" refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.h1}>DÉFIS</Text>
        <Text style={styles.subtitle}>Quotidiens, hebdo et permanents — difficulté qui monte avec ton niveau</Text>

        <View style={styles.tabs}>
          {(["daily", "weekly", "permanent"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              testID={`tab-${t}`}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive, tab === t && { borderColor: catColor[t] }]}
              activeOpacity={0.85}
            >
              <Ionicons name={catIcon[t]} size={16} color={tab === t ? catColor[t] : "#555"} />
              <Text style={[styles.tabTxt, tab === t && { color: catColor[t] }]}>
                {t === "daily" ? "JOUR" : t === "weekly" ? "SEMAINE" : "LÉGENDES"}
              </Text>
              {data && (
                <View style={[styles.badge, tab === t && { backgroundColor: catColor[t] }]}>
                  <Text style={[styles.badgeTxt, tab === t && { color: "#000" }]}>
                    {data[t].filter((c) => !c.completed && c.meets_requirements).length || data[t].length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {data && list[0]?.resets_in && (
          <Text style={styles.resetInfo}>
            <Ionicons name="time-outline" size={12} color="#A0A0A0" /> Reset : {list[0].resets_in}
          </Text>
        )}

        {list.map((c) => (
          <View
            key={c.id}
            style={[styles.card, c.completed && styles.cardDone, !c.completed && c.meets_requirements && styles.cardReady]}
            testID={`challenge-${c.id}`}
          >
            <View style={styles.cardHead}>
              <View style={[styles.iconBox, { backgroundColor: diffColor(c.difficulty) }]}>
                <Ionicons name={c.icon as any} size={20} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{c.title}</Text>
                  <View style={[styles.diffPill, { borderColor: diffColor(c.difficulty) }]}>
                    <Text style={[styles.diffTxt, { color: diffColor(c.difficulty) }]}>
                      {c.difficulty.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.desc}>{c.description}</Text>
              </View>
            </View>

            {!c.completed && (
              <View style={[styles.progressBox, c.meets_requirements && styles.progressBoxOk]}>
                <Ionicons
                  name={c.meets_requirements ? "checkmark-circle" : "information-circle"}
                  size={14}
                  color={c.meets_requirements ? "#39FF14" : "#FFEA00"}
                />
                <Text style={[styles.progressTxt, c.meets_requirements && { color: "#39FF14" }]}>
                  {c.meets_requirements ? "Critères validés — clique pour réclamer !" : c.progress}
                </Text>
              </View>
            )}

            <View style={styles.footer}>
              <Text style={styles.xp}>+{c.xp_reward} XP</Text>
              {c.completed ? (
                <View style={styles.doneBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#39FF14" />
                  <Text style={styles.doneTxt}>COMPLÉTÉ</Text>
                </View>
              ) : (
                <TouchableOpacity
                  testID={`complete-${c.id}`}
                  onPress={() => complete(c)}
                  activeOpacity={0.85}
                  disabled={!c.meets_requirements}
                  style={!c.meets_requirements ? { opacity: 0.45 } : undefined}
                >
                  <LinearGradient
                    colors={c.meets_requirements ? ["#00E5FF", "#FF007F"] : ["#333", "#555"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.claimBtn}
                  >
                    <Text style={styles.claimTxt}>{c.meets_requirements ? "RÉCLAMER" : "VERROUILLÉ"}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
        {data && list.length === 0 && <Text style={styles.empty}>Aucun défi dans cette catégorie.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 16, paddingBottom: 32 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "900" },
  subtitle: { color: "#A0A0A0", marginBottom: 16, marginTop: 4, fontSize: 13 },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4,
    paddingVertical: 10, borderRadius: 10, backgroundColor: "#121212",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  tabActive: { backgroundColor: "#0A0A0A" },
  tabTxt: { color: "#555", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  badge: { backgroundColor: "#222", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, minWidth: 16, alignItems: "center" },
  badgeTxt: { color: "#A0A0A0", fontSize: 10, fontWeight: "900" },
  resetInfo: { color: "#A0A0A0", fontSize: 11, marginBottom: 10 },
  card: {
    backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  cardDone: { opacity: 0.65, borderColor: "#39FF14" },
  cardReady: { borderColor: "rgba(0,229,255,0.5)" },
  cardHead: { flexDirection: "row", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { color: "#fff", fontWeight: "900", fontSize: 15, flex: 1 },
  diffPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  diffTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  desc: { color: "#A0A0A0", marginTop: 4, fontSize: 12, lineHeight: 17 },
  progressBox: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12,
    backgroundColor: "rgba(255,234,0,0.06)", padding: 8, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(255,234,0,0.2)",
  },
  progressBoxOk: { backgroundColor: "rgba(57,255,20,0.08)", borderColor: "rgba(57,255,20,0.3)" },
  progressTxt: { color: "#FFEA00", fontSize: 11, fontWeight: "700", flex: 1 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 },
  xp: { color: "#00E5FF", fontWeight: "900", fontSize: 14, letterSpacing: 1 },
  claimBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999 },
  claimTxt: { color: "#000", fontWeight: "900", letterSpacing: 1.5, fontSize: 11 },
  doneBadge: { flexDirection: "row", alignItems: "center", gap: 5 },
  doneTxt: { color: "#39FF14", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  empty: { color: "#555", textAlign: "center", padding: 20 },
});
