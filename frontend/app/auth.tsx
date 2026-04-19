import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth";

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [djName, setDjName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuth();
  const router = useRouter();

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        if (djName.trim().length < 2) throw new Error("Nom DJ trop court");
        await register(email.trim(), password, djName.trim());
      }
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      setError(e.message || "Erreur");
      if (Platform.OS !== "web") Alert.alert("Erreur", e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={{ uri: "https://images.pexels.com/photos/19181687/pexels-photo-19181687.jpeg" }}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(10,10,10,0.6)", "rgba(10,10,10,0.88)", "#0A0A0A"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandBox}>
            <Text style={styles.brandSmall}>DJ SKILL</Text>
            <Text style={styles.brandBig}>TRACKER</Text>
            <Text style={styles.brandTag}>Cuivre → Maître · Gamifie ta pratique</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabsRow}>
              <TouchableOpacity
                testID="tab-login"
                style={[styles.tabBtn, mode === "login" && styles.tabBtnActive]}
                onPress={() => setMode("login")}
              >
                <Text style={[styles.tabTxt, mode === "login" && styles.tabTxtActive]}>Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="tab-register"
                style={[styles.tabBtn, mode === "register" && styles.tabBtnActive]}
                onPress={() => setMode("register")}
              >
                <Text style={[styles.tabTxt, mode === "register" && styles.tabTxtActive]}>Inscription</Text>
              </TouchableOpacity>
            </View>

            {mode === "register" && (
              <View style={styles.field}>
                <Text style={styles.label}>NOM DJ</Text>
                <TextInput
                  testID="input-dj-name"
                  style={styles.input}
                  value={djName}
                  onChangeText={setDjName}
                  placeholder="DJ Phoenix"
                  placeholderTextColor="#555"
                  autoCapitalize="none"
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                testID="input-email"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="toi@exemple.com"
                placeholderTextColor="#555"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>MOT DE PASSE</Text>
              <TextInput
                testID="input-password"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#555"
                secureTextEntry
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity
              testID="submit-btn"
              style={styles.primaryBtn}
              onPress={submit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryBtnTxt}>
                  {mode === "login" ? "SE CONNECTER" : "CRÉER LE COMPTE"}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.helperTxt}>
              {mode === "login" ? "Nouveau ?" : "Déjà un compte ?"}{" "}
              <Text
                style={styles.helperLink}
                onPress={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Crée ton profil DJ" : "Connecte-toi"}
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0A0A0A" },
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 80 },
  brandBox: { marginBottom: 32 },
  brandSmall: { color: "#00E5FF", letterSpacing: 6, fontSize: 12, fontWeight: "800" },
  brandBig: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: -1, marginTop: 2 },
  brandTag: { color: "#A0A0A0", marginTop: 6, fontSize: 13 },
  card: {
    backgroundColor: "rgba(18,18,18,0.92)",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabBtnActive: { backgroundColor: "#00E5FF" },
  tabTxt: { color: "#A0A0A0", fontWeight: "700", letterSpacing: 1, fontSize: 12 },
  tabTxtActive: { color: "#000" },
  field: { marginBottom: 14 },
  label: { color: "#A0A0A0", fontSize: 11, letterSpacing: 2, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: "#0A0A0A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    fontSize: 15,
  },
  error: { color: "#FF3B5B", marginBottom: 10, fontSize: 13 },
  primaryBtn: {
    backgroundColor: "#00E5FF",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#00E5FF",
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  primaryBtnTxt: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  helperTxt: { color: "#A0A0A0", textAlign: "center", marginTop: 18, fontSize: 13 },
  helperLink: { color: "#00E5FF", fontWeight: "700" },
});
