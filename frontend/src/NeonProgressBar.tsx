import React from "react";
import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Props = {
  progress: number; // 0-100
  height?: number;
};

export function NeonProgressBar({ progress, height = 10 }: Props) {
  const clamped = Math.max(0, Math.min(100, progress));
  return (
    <View style={[styles.track, { height }]}>
      <LinearGradient
        colors={["#00E5FF", "#FF007F"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${clamped}%`, height }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  fill: {
    borderRadius: 999,
    shadowColor: "#00E5FF",
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
});
