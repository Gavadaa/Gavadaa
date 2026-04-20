import React, { useState } from "react";
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
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../src/auth";
import { api, errMsg } from "../src/api";

const MUSIC_STYLES = [
  "House", "Techno", "Tech House", "Minimal", "Trance", "Progressive",
  "Drum & Bass", "Dubstep", "Hip-Hop", "R&B", "Afro House", "Deep House",
  "EDM", "Reggaeton", "Ambient", "Hardstyle", "Disco", "Funk",
];

const SOCIAL_FIELDS: { key: string; label: string; icon: any; placeholder: string }[] = [
  { key: "instagram", label: "Instagram", icon: "logo-instagram", placeholder: "@toncompte" },
  { key: "tiktok", label: "TikTok", icon: "logo-tiktok", placeholder: "@toncompte" },
  { key: "facebook", label: "Facebook", icon: "logo-facebook", placeholder: "tonprofil" },
  { key: "twitter", label: "X / Twitter", icon: "logo-twitter", placeholder: "@toncompte" },
  { key: "youtube", label: "YouTube", icon: "logo-youtube", placeholder: "@tonchaîne" },
  { key: "spotify", label: "Spotify", icon: "musical-notes", placeholder: "user ID" },
  { key: "soundcloud", label: "SoundCloud", icon: "cloud", placeholder: "tonartiste" },
];

export default function ProfileEdit() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState(user?.avatar_base64 || "");
  const [age, setAge] = useState(user?.age ? String(user.age) : "");
  const [city, setCity] = useState(user?.city || "");
  const [styles2, setStyles2] = useState<string[]>(user?.music_styles || []);
  const [socials, setSocials] = useState<Record<string, string>>(user?.socials || {});
  const [saving, setSaving] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(false);

  const toggleStyle = (s: string) => {
    setStyles2((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s].slice(0, 10)));
  };

  const pickAvatar = async () => {
    try {
      if (Platform.OS !== "web") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission refusée", "Autorise l'accès aux photos pour changer ton avatar.");
          return;
        }
      }
      setLoadingAvatar(true);
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets[0]) {
        const b64 = res.assets[0].base64;
        const mime = res.assets[0].mimeType || "image/jpeg";
        if (b64) setAvatar(`data:${mime};base64,${b64}`);
      }
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de charger l'image");
    } finally {
      setLoadingAvatar(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {
        bio,
        music_styles: styles2,
        city,
        socials: Object.fromEntries(Object.entries(socials).filter(([, v]) => v && v.trim())),
      };
      if (avatar) payload.avatar_base64 = avatar;
      if (age) payload.age = parseInt(age, 10);
      const { data } = await api.put("/profile", payload);
      setUser({ ...(user as any), ...data });
      router.back();
    } catch (e: any) {
      Alert.alert("Erreur", errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={s.h1}>MODIFIER LE PROFIL</Text>
          <TouchableOpacity testID="save-profile-btn" onPress={save} disabled={saving} style={s.saveBtn}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={s.saveTxt}>SAVE</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <TouchableOpacity testID="avatar-picker" onPress={pickAvatar} style={s.avatarBox} activeOpacity={0.85}>
            {loadingAvatar ? (
              <ActivityIndicator color="#00E5FF" />
            ) : avatar ? (
              <Image source={{ uri: avatar }} style={s.avatarImg} />
            ) : (
              <>
                <Ionicons name="camera" size={32} color="#00E5FF" />
                <Text style={s.avatarHint}>TAP POUR AJOUTER UNE PHOTO</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Bio */}
          <Label>BIO ({bio.length}/300)</Label>
          <TextInput
            testID="input-bio"
            style={[s.input, { minHeight: 80 }]}
            value={bio}
            onChangeText={(t) => setBio(t.slice(0, 300))}
            multiline
            placeholder="Parle-nous de toi, ton style, ton parcours..."
            placeholderTextColor="#555"
          />

          {/* Age + city */}
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Label>ÂGE</Label>
              <TextInput
                testID="input-age"
                style={s.input}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor="#555"
                maxLength={3}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Label>VILLE</Label>
              <TextInput
                testID="input-city"
                style={s.input}
                value={city}
                onChangeText={setCity}
                placeholder="Paris, NYC, Berlin..."
                placeholderTextColor="#555"
              />
            </View>
          </View>

          {/* Music styles */}
          <Label>STYLES MUSICAUX ({styles2.length}/10)</Label>
          <View style={s.chipsRow}>
            {MUSIC_STYLES.map((ms) => {
              const active = styles2.includes(ms);
              return (
                <TouchableOpacity
                  key={ms}
                  testID={`style-${ms}`}
                  onPress={() => toggleStyle(ms)}
                  style={[s.chip, active && s.chipActive]}
                  activeOpacity={0.85}
                >
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>{ms}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Socials */}
          <Label>RÉSEAUX (tous optionnels)</Label>
          {SOCIAL_FIELDS.map((f) => (
            <View key={f.key} style={s.socialRow}>
              <Ionicons name={f.icon} size={18} color="#A0A0A0" style={{ width: 26 }} />
              <TextInput
                testID={`social-${f.key}`}
                style={[s.input, { flex: 1, marginTop: 0 }]}
                value={socials[f.key] || ""}
                onChangeText={(t) => setSocials({ ...socials, [f.key]: t })}
                placeholder={`${f.label} : ${f.placeholder}`}
                placeholderTextColor="#555"
                autoCapitalize="none"
              />
            </View>
          ))}
          <Text style={s.privacy}>
            <Ionicons name="eye-outline" size={12} color="#A0A0A0" /> Toutes ces infos sont publiques et visibles par tout le monde.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Label = ({ children }: any) => <Text style={s.label}>{children}</Text>;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0A0A0A" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  h1: { color: "#fff", fontWeight: "900", letterSpacing: 1.5, fontSize: 14 },
  saveBtn: { backgroundColor: "#00E5FF", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, minWidth: 60, alignItems: "center" },
  saveTxt: { color: "#000", fontWeight: "900", letterSpacing: 1, fontSize: 12 },
  scroll: { padding: 16, paddingBottom: 40 },
  avatarBox: {
    alignSelf: "center", width: 130, height: 130, borderRadius: 65,
    backgroundColor: "#121212", borderWidth: 2, borderColor: "#00E5FF",
    alignItems: "center", justifyContent: "center", marginBottom: 24, overflow: "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },
  avatarHint: { color: "#00E5FF", fontSize: 9, fontWeight: "800", letterSpacing: 1, marginTop: 6, textAlign: "center", paddingHorizontal: 10 },
  label: { color: "#555", letterSpacing: 2, fontSize: 10, fontWeight: "800", marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#121212", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    color: "#fff", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", fontSize: 14, marginTop: 4,
  },
  row2: { flexDirection: "row", gap: 10 },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  chipActive: { backgroundColor: "#00E5FF", borderColor: "#00E5FF" },
  chipTxt: { color: "#A0A0A0", fontSize: 11, fontWeight: "700" },
  chipTxtActive: { color: "#000", fontWeight: "900" },
  socialRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  privacy: { color: "#A0A0A0", fontSize: 11, textAlign: "center", marginTop: 20 },
});
