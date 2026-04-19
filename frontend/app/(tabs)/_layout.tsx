import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../../src/auth";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#00E5FF" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0A0A0A",
          borderTopColor: "rgba(255,255,255,0.08)",
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: "#00E5FF",
        tabBarInactiveTintColor: "#555",
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "DASH",
          tabBarIcon: ({ color }) => <Ionicons name="speedometer" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: "SESSIONS",
          tabBarIcon: ({ color }) => <Ionicons name="musical-notes" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: "DÉFIS",
          tabBarIcon: ({ color }) => <Ionicons name="flame" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "STATS",
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFIL",
          tabBarIcon: ({ color }) => <Ionicons name="person" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0A0A0A" },
});
