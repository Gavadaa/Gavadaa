import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../src/api";
import { RankBadge } from "../../src/RankBadge";

const SOCIAL_ICONS: Record<string, any> = {
  instagram: "logo-instagram",
  tiktok: "logo-tiktok",
  facebook: "logo-facebook",
  twitter: "logo-twitter",
  youtube: "logo-youtube",
  spotify: "musical-notes",
  soundcloud: "cloud",
};

const SOCIAL_URL: Record<string, (v: string) => string> = {
  instagram: (v) => `https://instagram.com/${v.replace(/^@/, "")}`,
  tiktok: (v) => `https://www.tiktok.com/@${v.replace(/^@/, "")}`,
  facebook: (v) => `https://facebook.com/${v.replace(/^@/, "")}`,
  twitter: (v) => `https://x.com/${v.replace(/^@/, "")}`,
  youtube: (v) => `https://youtube.com/${v.replace(/^@/, "")}`,
  spotify: (v) => `https://open.spotify.com/user/${v.replace(/^@/, "")}`,
  soundcloud: (v) => `https://soundcloud.com/${v.replace(/^@/, "")}`,
};

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [u, setU] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/users/${id}`);
        setU(data);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <View style={st.center}><ActivityIndicator color="#00E5FF" /></View>;
  }
  if (!u) {
    return <View style={st.center}><Text style={{ color: "#fff" }}>Profil introuvable</Text></View>;
  }

  const r = u.rank_info;
  const hours = Math.floor(u.total_minutes / 60);
  const mins = u.total_minutes % 60;

  return (
    <SafeAreaView style={st.safe} edges={["top"]}>
      <View style={st.header}>
        <TouchableOpacity testID="close-user-profile" onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={st.h1}>PROFIL</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={st.scroll}>
        {/* Hero */}
        <View style={st.hero}>
          <LinearGradient
            colors={["rgba(0,229,255,0.15)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
          {u.avatar_base64 ? (
            <Image source={{ uri: u.avatar_base64 }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, st.avatarFallback]}>
              <Ionicons name="person" size={42} color="#555" />
            </View>
          )}
          <Text style={st.djName} testID="profile-dj-name">{u.dj_name}</Text>
          <RankBadge rank={r.rank} division={r.division} size={64} />
          <Text style={st.rankLabel}>{r.rank_label} · {u.total_xp} XP</Text>
          {(u.city || u.age) && (
            <Text style={st.meta}>
              {u.age ? `${u.age} ans` : ""}{u.age && u.city ? " · " : ""}{u.city || ""}
            </Text>
          )}
        </View>

        {/* Bio */}
        {!!u.bio && (
          <View style={st.card}>
            <Text style={st.cardTitle}>BIO</Text>
            <Text style={st.bio}>{u.bio}</Text>
          </View>
        )}

        {/* Styles */}
        {u.music_styles?.length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>STYLES MUSICAUX</Text>
            <View style={st.chips}>
              {u.music_styles.map((s: string) => (
                <View key={s} style={st.chip}>
                  <Text style={st.chipTxt}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Socials */}
        {u.socials && Object.keys(u.socials).length > 0 && (
          <View style={st.card}>
            <Text style={st.cardTitle}>RÉSEAUX</Text>
            <View style={{ gap: 8 }}>
              {Object.entries(u.socials).map(([k, v]: any) => (
                <TouchableOpacity
                  key={k}
                  testID={`social-link-${k}`}
                  style={st.socialRow}
                  onPress={() => SOCIAL_URL[k] && Linking.openURL(SOCIAL_URL[k](v)).catch(() => {})}
                  activeOpacity={0.85}
                >
                  <Ionicons name={SOCIAL_ICONS[k] || "link"} size={18} color="#00E5FF" />
                  <Text style={st.socialTxt}>{v}</Text>
                  <Ionicons name="open-outline" size={14} color="#555" style={{ marginLeft: "auto" }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Stats */}
        <View style={st.card}>
          <Text style={st.cardTitle}>PROGRESSION</Text>
          <View style={st.statsGrid}>
            <Stat label="TEMPS" value={`${hours}h${mins}m`} />
            <Stat label="SESSIONS" value={u.sessions_count} />
            <Stat label="STREAK" value={`${u.streak_days}j`} />
            <Stat label="DÉFIS" value={u.completed_challenges} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: any) {
  return (
    <View style={st.stat}>
      <Text style={st.statVal}>{value}</Text>
      <Text style={st.statLbl}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  h1: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 32 },
  hero: {
    alignItems: "center", padding: 24, borderRadius: 20, backgroundColor: "#121212",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", marginBottom: 14, overflow: "hidden",
  },
  avatar: { width: 110, height: 110, borderRadius: 55, marginBottom: 12, borderWidth: 2, borderColor: "#00E5FF" },
  avatarFallback: { backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
  djName: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 10 },
  rankLabel: { color: "#00E5FF", fontWeight: "900", marginTop: 10, letterSpacing: 1 },
  meta: { color: "#A0A0A0", fontSize: 12, marginTop: 6 },
  card: { backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 10 },
  bio: { color: "#fff", fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(0,229,255,0.1)", borderWidth: 1, borderColor: "rgba(0,229,255,0.3)" },
  chipTxt: { color: "#00E5FF", fontSize: 11, fontWeight: "800" },
  socialRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#0A0A0A",
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  socialTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "47%", padding: 12, backgroundColor: "#0A0A0A", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  statVal: { color: "#fff", fontSize: 20, fontWeight: "900" },
  statLbl: { color: "#555", fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginTop: 2 },
});
