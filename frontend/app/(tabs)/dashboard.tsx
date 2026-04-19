import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ImageBackground,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { RankBadge } from "../../src/RankBadge";
import { NeonProgressBar } from "../../src/NeonProgressBar";

export default function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/stats");
      setStats(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), load()]);
    setRefreshing(false);
  };

  if (!user) return null;
  const r = user.rank_info;
  const hours = Math.floor(user.total_minutes / 60);
  const mins = user.total_minutes % 60;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        refreshControl={<RefreshControl tintColor="#00E5FF" refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>YO</Text>
            <Text testID="dj-name-text" style={styles.djName}>{user.dj_name}</Text>
          </View>
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={14} color="#FF007F" />
            <Text style={styles.streakTxt}>{user.streak_days}J</Text>
          </View>
        </View>

        <ImageBackground
          source={{ uri: "https://images.unsplash.com/photo-1697301439935-fe7160f4e3bb" }}
          style={styles.rankCard}
          imageStyle={{ borderRadius: 20, opacity: 0.35 }}
        >
          <LinearGradient
            colors={["rgba(10,10,10,0.4)", "rgba(10,10,10,0.95)"]}
            style={StyleSheet.absoluteFill}
            // @ts-ignore
            pointerEvents="none"
          />
          <View style={styles.rankInner}>
            <RankBadge rank={r.rank} division={r.division} size={110} />
            <View style={styles.rankInfo}>
              <Text style={styles.rankLabel} testID="rank-label">{r.rank_label}</Text>
              <Text style={styles.xpTxt}>{r.total_xp} XP · Niveau {r.level + 1}/40</Text>
              <View style={{ marginTop: 10 }}>
                <NeonProgressBar progress={r.progress_pct} height={8} />
                <Text style={styles.rankSub}>
                  {r.at_max_rank
                    ? "⚡ Rang maximum atteint"
                    : `${r.xp_in_division}/${r.xp_for_next_division} XP → division suivante`}
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={styles.grid}>
          <Stat icon="time" label="TEMPS TOTAL" value={`${hours}h ${mins}m`} color="#00E5FF" />
          <Stat icon="musical-notes" label="SESSIONS" value={`${user.sessions_count}`} color="#FF007F" />
          <Stat icon="flame" label="STREAK" value={`${user.streak_days}j`} color="#39FF14" />
          <Stat
            icon="trophy"
            label="DÉFIS"
            value={`${user.completed_challenges.length}`}
            color="#FFD700"
          />
        </View>

        <TouchableOpacity
          testID="quick-log-btn"
          style={styles.quickBtn}
          onPress={() => router.push("/(tabs)/sessions")}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#00E5FF", "#FF007F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quickBtnGrad}
          >
            <Ionicons name="add-circle" size={22} color="#000" />
            <Text style={styles.quickBtnTxt}>LOGGER UNE SESSION</Text>
          </LinearGradient>
        </TouchableOpacity>

        {stats && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ACTIVITÉ (7 jours)</Text>
            <View style={styles.barsRow}>
              {stats.by_day.map((d: any) => {
                const max = Math.max(...stats.by_day.map((x: any) => x.minutes), 1);
                const h = Math.max(4, (d.minutes / max) * 80);
                return (
                  <View key={d.date} style={styles.barCol}>
                    <View style={[styles.bar, { height: h }]} />
                    <Text style={styles.barLbl}>{d.date.slice(5)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>PROGRESSION DES RANGS</Text>
          <View style={styles.ranksLadder}>
            {["Cuivre", "Bronze", "Argent", "Or", "Platine", "Diamant", "Champion", "Maître"].map((rn) => (
              <View key={rn} style={[styles.ladderItem, r.rank === rn && styles.ladderItemActive]}>
                <Text style={[styles.ladderTxt, r.rank === rn && styles.ladderTxtActive]}>{rn}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, color }: any) {
  return (
    <View style={styles.statCard} testID={`stat-${label.toLowerCase()}`}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  hello: { color: "#555", letterSpacing: 4, fontSize: 11, fontWeight: "800" },
  djName: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 2 },
  premiumBadge: {
    flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,229,255,0.12)",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(0,229,255,0.4)",
  },
  premiumTxt: { color: "#00E5FF", fontSize: 10, fontWeight: "800", letterSpacing: 1, marginLeft: 4 },
  streakBadge: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,0,127,0.1)",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,0,127,0.4)",
  },
  streakTxt: { color: "#FF007F", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  rankCard: { borderRadius: 20, overflow: "hidden", marginBottom: 14 },
  rankInner: { padding: 18, flexDirection: "row", alignItems: "center" },
  rankInfo: { flex: 1, marginLeft: 18 },
  rankLabel: { color: "#fff", fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  xpTxt: { color: "#A0A0A0", marginTop: 4, fontSize: 12 },
  rankSub: { color: "#A0A0A0", fontSize: 11, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  statCard: {
    flexGrow: 1, flexBasis: "47%", backgroundColor: "#121212", padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  statVal: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 8 },
  statLbl: { color: "#555", fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 2 },
  quickBtn: { marginBottom: 14, borderRadius: 14, overflow: "hidden" },
  quickBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, gap: 10 },
  quickBtnTxt: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  card: {
    backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 12 },
  barsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 100 },
  barCol: { alignItems: "center", flex: 1 },
  bar: { width: 16, backgroundColor: "#00E5FF", borderRadius: 4, shadowColor: "#00E5FF", shadowOpacity: 0.5, shadowRadius: 4 },
  barLbl: { color: "#555", fontSize: 9, marginTop: 4 },
  ranksLadder: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  ladderItem: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  ladderItemActive: { backgroundColor: "rgba(0,229,255,0.15)", borderColor: "#00E5FF" },
  ladderTxt: { color: "#555", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  ladderTxtActive: { color: "#00E5FF" },
});
