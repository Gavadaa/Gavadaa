import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../src/auth";
import { api, errMsg } from "../../src/api";
import { RankBadge } from "../../src/RankBadge";

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendCode, setFriendCode] = useState<string>("");
  const [myCode, setMyCode] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"friends" | "global">("friends");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [lb, fr, me] = await Promise.all([
        api.get("/leaderboard"),
        api.get("/friends"),
        api.get("/friends/me"),
      ]);
      setLeaderboard(lb.data);
      setFriends(fr.data);
      setMyCode(me.data.friend_code);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), load()]);
    setRefreshing(false);
  };

  const showMsg = (title: string, msg: string) => {
    if (Platform.OS === "web") window.alert(`${title}\n\n${msg}`);
    else Alert.alert(title, msg);
  };

  const addFriend = async () => {
    const code = friendCode.trim().toUpperCase();
    if (code.length !== 6) { showMsg("Code invalide", "Le code doit faire 6 caractères"); return; }
    setAdding(true);
    try {
      const { data } = await api.post("/friends/add", { friend_code: code });
      setFriendCode("");
      await load();
      showMsg("Ami ajouté", `${data.friend.dj_name} a rejoint tes amis !`);
    } catch (e: any) {
      showMsg("Erreur", errMsg(e));
    } finally { setAdding(false); }
  };

  const copyCode = async () => {
    try {
      await Clipboard.setStringAsync(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showMsg("Ton code", myCode);
    }
  };

  const removeFriend = async (fid: string, name: string) => {
    const go = async () => {
      try { await api.delete(`/friends/${fid}`); await load(); } catch {}
    };
    if (Platform.OS === "web") {
      if (window.confirm(`Retirer ${name} de tes amis ?`)) await go();
    } else {
      Alert.alert("Retirer l'ami", `Retirer ${name} ?`, [
        { text: "Annuler", style: "cancel" },
        { text: "Retirer", style: "destructive", onPress: go },
      ]);
    }
  };

  const doLogout = async () => { await logout(); router.replace("/auth"); };
  const confirmLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Confirmer la déconnexion ?")) doLogout();
    } else {
      Alert.alert("Déconnexion", "Confirmer la déconnexion ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnecter", style: "destructive", onPress: doLogout },
      ]);
    }
  };

  if (!user) return null;
  const r = user.rank_info;
  const currentList = view === "friends" ? friends : leaderboard.slice(0, 20);
  const myRank = leaderboard.findIndex((u) => u.dj_name === user.dj_name) + 1;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor="#00E5FF" refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.h1Row}>
          <Text style={styles.h1}>PROFIL</Text>
          <TouchableOpacity
            testID="edit-profile-btn"
            onPress={() => router.push("/profile-edit")}
            style={styles.editBtn}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={16} color="#00E5FF" />
            <Text style={styles.editTxt}>MODIFIER</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.profileCard}>
          {user.avatar_base64 ? (
            <Image source={{ uri: user.avatar_base64 }} style={styles.avatar} />
          ) : (
            <RankBadge rank={r.rank} division={r.division} size={90} />
          )}
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.djName}>{user.dj_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.rankLine}>{r.rank_label} · {r.total_xp} XP</Text>
            {!!user.bio && <Text style={styles.bio} numberOfLines={2}>{user.bio}</Text>}
          </View>
        </View>

        {user.music_styles && user.music_styles.length > 0 && (
          <View style={styles.stylesRow}>
            {user.music_styles.slice(0, 6).map((ms) => (
              <View key={ms} style={styles.styleChip}><Text style={styles.styleTxt}>{ms}</Text></View>
            ))}
          </View>
        )}

        {/* Friend code */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MON CODE D'INVITATION</Text>
          <TouchableOpacity testID="share-code-btn" onPress={copyCode} activeOpacity={0.8} style={styles.codeBox}>
            <Text style={styles.codeTxt} testID="my-friend-code">{myCode || "———"}</Text>
            <View style={styles.copyPill}>
              <Ionicons name={copied ? "checkmark-circle" : "copy"} size={14} color={copied ? "#39FF14" : "#00E5FF"} />
              <Text style={[styles.copyTxt, copied && { color: "#39FF14" }]}>
                {copied ? "COPIÉ !" : "COPIER"}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.codeHint}>Tape sur le code pour le copier et le partager à tes potes</Text>
        </View>

        {/* Add friend */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>AJOUTER UN AMI</Text>
          <View style={styles.addRow}>
            <TextInput
              testID="input-friend-code"
              style={styles.codeInput}
              value={friendCode}
              onChangeText={(t) => setFriendCode(t.toUpperCase())}
              placeholder="ABC123"
              placeholderTextColor="#555"
              maxLength={6}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              testID="add-friend-btn"
              onPress={addFriend}
              disabled={adding}
              style={styles.addBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add" size={18} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={styles.card}>
          <View style={styles.tabsSwitch}>
            <TouchableOpacity
              testID="tab-friends"
              style={[styles.switchBtn, view === "friends" && styles.switchBtnActive]}
              onPress={() => setView("friends")}
            >
              <Text style={[styles.switchTxt, view === "friends" && styles.switchTxtActive]}>AMIS ({friends.length})</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tab-global"
              style={[styles.switchBtn, view === "global" && styles.switchBtnActive]}
              onPress={() => setView("global")}
            >
              <Text style={[styles.switchTxt, view === "global" && styles.switchTxtActive]}>MONDIAL</Text>
            </TouchableOpacity>
          </View>
          {view === "global" && myRank > 0 && <Text style={styles.myRank} testID="my-rank">Tu es #{myRank}</Text>}
          {currentList.length === 0 ? (
            <Text style={styles.empty}>
              {view === "friends" ? "Aucun ami pour le moment. Ajoute-en via leur code." : "Classement indisponible"}
            </Text>
          ) : (
            currentList.map((u: any, idx: number) => {
              const isMe = u.dj_name === user.dj_name;
              const pos = view === "global" ? u.rank_position : idx + 1;
              const clickable = !!u.id && !isMe;
              const Row: any = clickable ? TouchableOpacity : View;
              return (
                <Row
                  key={u.id || idx}
                  style={[styles.lbRow, isMe && styles.lbRowMe]}
                  testID={`lb-row-${idx}`}
                  onPress={clickable ? () => router.push(`/user/${u.id}`) : undefined}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.lbPos, pos <= 3 && { color: ["#FFD700", "#C0C0C0", "#CD7F32"][pos - 1] }]}>#{pos}</Text>
                  {u.avatar_base64 ? (
                    <Image source={{ uri: u.avatar_base64 }} style={styles.lbAvatar} />
                  ) : (
                    <View style={[styles.lbAvatar, styles.lbAvatarFallback]}>
                      <Ionicons name="person" size={14} color="#555" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbName, isMe && { color: "#00E5FF" }]}>{u.dj_name}</Text>
                    <Text style={styles.lbSub}>
                      {u.rank_info.rank_label} · {u.streak_days ?? 0}j · {u.sessions_count ?? 0} sessions
                    </Text>
                  </View>
                  <Text style={styles.lbXp}>{u.total_xp} XP</Text>
                  {view === "friends" && !isMe && (
                    <TouchableOpacity
                      onPress={(e: any) => { e?.stopPropagation?.(); removeFriend(u.id, u.dj_name); }}
                      testID={`remove-friend-${u.id}`}
                      style={{ marginLeft: 6 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#555" />
                    </TouchableOpacity>
                  )}
                </Row>
              );
            })
          )}
        </View>

        <TouchableOpacity
          testID="logout-btn"
          style={styles.logoutBtn}
          onPress={confirmLogout}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#FF3B5B" />
          <Text style={styles.logoutTxt}>DÉCONNEXION</Text>
        </TouchableOpacity>

        <Text style={styles.version}>DJ Skill Tracker v1.2 · Cuivre → Maître</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 16, paddingBottom: 32 },
  h1Row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "900" },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "rgba(0,229,255,0.1)", borderWidth: 1, borderColor: "rgba(0,229,255,0.4)" },
  editTxt: { color: "#00E5FF", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  profileCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#121212",
    padding: 16, borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: "#00E5FF" },
  djName: { color: "#fff", fontSize: 22, fontWeight: "900" },
  email: { color: "#A0A0A0", fontSize: 12, marginTop: 2 },
  rankLine: { color: "#00E5FF", marginTop: 6, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  bio: { color: "#A0A0A0", fontSize: 12, marginTop: 6, lineHeight: 16 },
  stylesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  styleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(0,229,255,0.1)", borderWidth: 1, borderColor: "rgba(0,229,255,0.3)" },
  styleTxt: { color: "#00E5FF", fontSize: 10, fontWeight: "800" },
  card: {
    backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 12 },
  codeBox: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0A0A0A", padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: "rgba(0,229,255,0.4)",
  },
  codeTxt: { color: "#00E5FF", fontSize: 24, fontWeight: "900", letterSpacing: 8 },
  copyPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(0,229,255,0.1)" },
  copyTxt: { color: "#00E5FF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  codeHint: { color: "#555", fontSize: 11, marginTop: 10, textAlign: "center" },
  addRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1, backgroundColor: "#0A0A0A", paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", textAlign: "center",
  },
  addBtn: { backgroundColor: "#00E5FF", width: 50, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  tabsSwitch: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3, marginBottom: 12 },
  switchBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  switchBtnActive: { backgroundColor: "#00E5FF" },
  switchTxt: { color: "#A0A0A0", fontWeight: "800", letterSpacing: 1, fontSize: 11 },
  switchTxtActive: { color: "#000" },
  myRank: { color: "#00E5FF", fontWeight: "900", fontSize: 12, letterSpacing: 1, marginBottom: 10 },
  lbRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)", gap: 10,
  },
  lbRowMe: { backgroundColor: "rgba(0,229,255,0.06)", marginHorizontal: -16, paddingHorizontal: 16 },
  lbPos: { color: "#A0A0A0", fontWeight: "900", width: 32, fontSize: 13 },
  lbAvatar: { width: 32, height: 32, borderRadius: 16 },
  lbAvatarFallback: { backgroundColor: "#0A0A0A", alignItems: "center", justifyContent: "center" },
  lbName: { color: "#fff", fontWeight: "800", fontSize: 13 },
  lbSub: { color: "#555", fontSize: 10, marginTop: 2 },
  lbXp: { color: "#00E5FF", fontWeight: "900", fontSize: 12, textAlign: "right", minWidth: 60 },
  empty: { color: "#555", textAlign: "center", paddingVertical: 12 },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#FF3B5B",
    backgroundColor: "rgba(255,59,91,0.08)", marginTop: 8,
  },
  logoutTxt: { color: "#FF3B5B", fontWeight: "900", letterSpacing: 2, fontSize: 13 },
  version: { color: "#555", textAlign: "center", marginTop: 24, fontSize: 10, letterSpacing: 1 },
});
