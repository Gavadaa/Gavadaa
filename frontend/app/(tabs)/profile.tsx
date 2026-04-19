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
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
    if (code.length !== 6) {
      showMsg("Code invalide", "Le code doit faire 6 caractères");
      return;
    }
    setAdding(true);
    try {
      const { data } = await api.post("/friends/add", { friend_code: code });
      setFriendCode("");
      await load();
      showMsg("Ami ajouté", `${data.friend.dj_name} a rejoint tes amis !`);
    } catch (e: any) {
      showMsg("Erreur", errMsg(e));
    } finally {
      setAdding(false);
    }
  };

  const shareCode = async () => {
    const msg = `Rejoins-moi sur DJ Skill Tracker ! Mon code d'ami : ${myCode}`;
    try {
      if (Platform.OS === "web") {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(msg);
          showMsg("Copié", "Code d'invitation copié dans le presse-papier");
        } else {
          showMsg("Ton code", myCode);
        }
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
  };

  const removeFriend = async (fid: string, name: string) => {
    const go = async () => {
      try {
        await api.delete(`/friends/${fid}`);
        await load();
      } catch {}
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

  const doLogout = async () => {
    await logout();
    router.replace("/auth");
  };

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
        <Text style={styles.h1}>PROFIL</Text>

        <View style={styles.profileCard}>
          <RankBadge rank={r.rank} division={r.division} size={90} />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.djName}>{user.dj_name}</Text>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.rankLine}>{r.rank_label} · {r.total_xp} XP</Text>
          </View>
        </View>

        {/* My friend code */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>MON CODE D'INVITATION</Text>
          <View style={styles.codeRow}>
            <View style={styles.codeBox} testID="my-friend-code">
              <Text style={styles.codeTxt}>{myCode || "———"}</Text>
            </View>
            <TouchableOpacity testID="share-code-btn" onPress={shareCode} style={styles.shareBtn} activeOpacity={0.85}>
              <Ionicons name="share-social" size={18} color="#00E5FF" />
              <Text style={styles.shareTxt}>PARTAGER</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.codeHint}>Partage ce code avec tes potes pour suivre leur progression</Text>
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

        {/* Leaderboard toggle */}
        <View style={styles.card}>
          <View style={styles.tabsSwitch}>
            <TouchableOpacity
              testID="tab-friends"
              style={[styles.switchBtn, view === "friends" && styles.switchBtnActive]}
              onPress={() => setView("friends")}
            >
              <Text style={[styles.switchTxt, view === "friends" && styles.switchTxtActive]}>
                AMIS ({friends.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="tab-global"
              style={[styles.switchBtn, view === "global" && styles.switchBtnActive]}
              onPress={() => setView("global")}
            >
              <Text style={[styles.switchTxt, view === "global" && styles.switchTxtActive]}>
                MONDIAL
              </Text>
            </TouchableOpacity>
          </View>
          {view === "global" && myRank > 0 && (
            <Text style={styles.myRank} testID="my-rank">Tu es #{myRank}</Text>
          )}
          {currentList.length === 0 ? (
            <Text style={styles.empty}>
              {view === "friends" ? "Aucun ami pour le moment. Ajoute-en via leur code." : "Classement indisponible"}
            </Text>
          ) : (
            currentList.map((u: any, idx: number) => {
              const isMe = u.dj_name === user.dj_name;
              const pos = view === "global" ? u.rank_position : idx + 1;
              return (
                <View key={u.id || idx} style={[styles.lbRow, isMe && styles.lbRowMe]} testID={`lb-row-${idx}`}>
                  <Text style={[styles.lbPos, pos <= 3 && { color: ["#FFD700", "#C0C0C0", "#CD7F32"][pos - 1] }]}>
                    #{pos}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lbName, isMe && { color: "#00E5FF" }]}>{u.dj_name}</Text>
                    <Text style={styles.lbSub}>
                      {u.rank_info.rank_label} · {u.streak_days ?? 0}j streak · {u.sessions_count ?? 0} sessions
                    </Text>
                  </View>
                  <Text style={styles.lbXp}>{u.total_xp} XP</Text>
                  {view === "friends" && !isMe && (
                    <TouchableOpacity
                      onPress={() => removeFriend(u.id, u.dj_name)}
                      testID={`remove-friend-${u.id}`}
                      style={{ marginLeft: 6 }}
                    >
                      <Ionicons name="close-circle" size={18} color="#555" />
                    </TouchableOpacity>
                  )}
                </View>
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

        <Text style={styles.version}>DJ Skill Tracker v1.1 · Cuivre → Maître · Full access</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { padding: 16, paddingBottom: 32 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "900", marginBottom: 16 },
  profileCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#121212",
    padding: 16, borderRadius: 14, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  djName: { color: "#fff", fontSize: 22, fontWeight: "900" },
  email: { color: "#A0A0A0", fontSize: 12, marginTop: 2 },
  rankLine: { color: "#00E5FF", marginTop: 6, fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  card: {
    backgroundColor: "#121212", padding: 16, borderRadius: 14, marginBottom: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: { color: "#A0A0A0", letterSpacing: 2, fontSize: 11, fontWeight: "800", marginBottom: 12 },
  codeRow: { flexDirection: "row", gap: 10 },
  codeBox: {
    flex: 1, backgroundColor: "#0A0A0A", padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: "rgba(0,229,255,0.4)", alignItems: "center",
  },
  codeTxt: { color: "#00E5FF", fontSize: 22, fontWeight: "900", letterSpacing: 6 },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14,
    backgroundColor: "rgba(0,229,255,0.08)", borderWidth: 1, borderColor: "#00E5FF", borderRadius: 10,
  },
  shareTxt: { color: "#00E5FF", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  codeHint: { color: "#555", fontSize: 11, marginTop: 10, textAlign: "center" },
  addRow: { flexDirection: "row", gap: 10 },
  codeInput: {
    flex: 1, backgroundColor: "#0A0A0A", paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 10, color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 4,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", textAlign: "center",
  },
  addBtn: {
    backgroundColor: "#00E5FF", width: 50, alignItems: "center", justifyContent: "center",
    borderRadius: 10,
  },
  tabsSwitch: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 10, padding: 3, marginBottom: 12,
  },
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
  lbPos: { color: "#A0A0A0", fontWeight: "900", width: 36, fontSize: 13 },
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
